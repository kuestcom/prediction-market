import type { IdentityFieldInput, IdentitySubmissionStatus } from '@/lib/identity/types'
import { createHash } from 'node:crypto'
import { and, desc, eq, inArray, ne, sql } from 'drizzle-orm'
import { z } from 'zod'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/i18n/locales'
import {
  identity_audit_events,
  identity_consents,
  identity_documents,
  identity_program_versions,
  identity_programs,
  identity_submission_values,
  identity_submissions,
} from '@/lib/db/schema/identity/tables'
import { db } from '@/lib/drizzle'
import { assertIdentityCollectionEnabled, recalculateIdentityGrants } from '@/lib/identity/access'
import { createIdentityBlindIndex, decryptIdentityValue, encryptIdentityValue } from '@/lib/identity/encryption'
import { isIdentityFieldVisible, validateIdentityFieldValue } from '@/lib/identity/field-validation'
import { IdentityAccessPolicySchema, IdentityAssignmentRulesSchema } from '@/lib/identity/schemas'
import { assertIdentityStatusTransition } from '@/lib/identity/state-machine'
import { assertNoActiveIdentityErasure } from './identity-privacy'
import { IdentityProgramRepository } from './identity-program'
import 'server-only'

const CreateSubmissionSchema = z.object({
  programId: z.string().length(26),
  countryCode: z.string().trim().regex(/^[A-Z]{2}$/).refine(value => !['XX', 'T1'].includes(value)).nullable(),
}).strict()

const SaveAnswersSchema = z.object({
  submissionId: z.string().length(26),
  expectedRevision: z.number().int().positive(),
  answers: z.record(z.string().regex(/^[a-z][a-z0-9_]{1,63}$/), z.unknown()),
  finalize: z.boolean(),
  consentAccepted: z.boolean().default(false),
  locale: z.enum(SUPPORTED_LOCALES),
}).strict()

function valueEncryptionContext(submissionId: string, fieldId: string) {
  return `identity-submission:${submissionId}:field:${fieldId}`
}

async function loadStoredAnswers(submissionId: string, fields: IdentityFieldInput[]) {
  const rows = await db.select().from(identity_submission_values).where(eq(identity_submission_values.submission_id, submissionId))
  const fieldsById = new Map(fields.map(field => [field.id, field]))
  const answers: Record<string, unknown> = {}
  for (const row of rows) {
    const field = fieldsById.get(row.field_id)
    if (!field?.id) {
      continue
    }
    answers[field.key] = decryptIdentityValue(
      row.encrypted_value,
      valueEncryptionContext(submissionId, field.id),
    )
  }
  return answers
}

function getLocalizedField(field: IdentityFieldInput, locale: string) {
  const translation = field.translations.find(candidate => candidate.locale === locale)
    ?? field.translations.find(candidate => candidate.locale === DEFAULT_LOCALE)
    ?? field.translations[0]
  const {
    validatorKey: _validatorKey,
    providerMapping: _providerMapping,
    duplicateDetection: _duplicateDetection,
    ...publicConfig
  } = field.config
  return {
    id: field.id,
    key: field.key,
    type: field.type,
    storageMode: field.storageMode,
    sensitivity: field.sensitivity,
    section: field.section,
    displayOrder: field.displayOrder,
    required: field.required,
    config: publicConfig,
    conditions: field.conditions,
    label: translation?.label ?? field.key,
    description: translation?.description ?? '',
    helpText: translation?.helpText ?? '',
    placeholder: translation?.placeholder ?? '',
    options: field.options.map((option) => {
      const optionTranslation = option.translations.find(candidate => candidate.locale === locale)
        ?? option.translations.find(candidate => candidate.locale === DEFAULT_LOCALE)
        ?? option.translations[0]
      return { value: option.valueKey, label: optionTranslation?.label ?? option.valueKey }
    }),
  }
}

export const IdentitySubmissionRepository = {
  async requestCorrection(userId: string, rawInput: unknown) {
    const input = z.object({
      submissionId: z.string().length(26),
      expectedRevision: z.number().int().positive(),
    }).strict().parse(rawInput)
    const result = await db.transaction(async (tx) => {
      const [submission] = await tx.select().from(identity_submissions).where(and(
        eq(identity_submissions.id, input.submissionId),
        eq(identity_submissions.user_id, userId),
        eq(identity_submissions.revision, input.expectedRevision),
      )).for('update')
      if (!submission) {
        throw new Error('IDENTITY_SUBMISSION_STALE')
      }
      if (!['approved', 'rejected', 'expired', 'suspended'].includes(submission.status)) {
        throw new Error('IDENTITY_CORRECTION_NOT_AVAILABLE')
      }
      assertIdentityStatusTransition(submission.status as IdentitySubmissionStatus, 'needs_resubmission')
      await tx.update(identity_submissions).set({
        status: 'needs_resubmission',
        decision_reason_code: 'USER_CORRECTION_REQUESTED',
        attempt_number: submission.attempt_number + 1,
        decided_at: null,
        expires_at: null,
        revision: submission.revision + 1,
      }).where(and(
        eq(identity_submissions.id, submission.id),
        eq(identity_submissions.revision, submission.revision),
      ))
      await tx.insert(identity_audit_events).values({
        actor_user_id: userId,
        subject_user_id: userId,
        action: 'identity.submission.correction_requested',
        target_type: 'identity_submission',
        target_id: submission.id,
        reason_code: 'USER_CORRECTION_REQUESTED',
        result: 'success',
        metadata: { attemptNumber: submission.attempt_number + 1 },
      })
      return { submissionId: submission.id, status: 'needs_resubmission' as const }
    })
    await recalculateIdentityGrants(result.submissionId)
    return result
  },

  async getUserOverview(userId: string, locale: string) {
    const programs = await db.select({
      id: identity_programs.id,
      key: identity_programs.key,
      name: identity_programs.name,
      description: identity_programs.description,
      activeVersionId: identity_programs.active_version_id,
    }).from(identity_programs).where(eq(identity_programs.status, 'published'))

    const submissions = programs.length > 0
      ? await db.select().from(identity_submissions).where(and(
          eq(identity_submissions.user_id, userId),
          inArray(identity_submissions.program_id, programs.map(program => program.id)),
        )).orderBy(desc(identity_submissions.updated_at))
      : []

    const programDtos = []
    for (const program of programs) {
      if (!program.activeVersionId) {
        continue
      }
      const version = await IdentityProgramRepository.getVersionForm(program.activeVersionId)
      if (!version || version.status !== 'published') {
        continue
      }
      const assignment = IdentityAssignmentRulesSchema.safeParse(version.assignmentRules)
      if (!assignment.success) {
        continue
      }
      const latestSubmission = submissions.find(submission => submission.program_id === program.id)
      const canResume = latestSubmission && ['draft', 'needs_resubmission'].includes(latestSubmission.status)
      const answers = canResume
        ? await loadStoredAnswers(latestSubmission.id, version.fields)
        : {}
      const documents = latestSubmission
        ? await db.select({
            id: identity_documents.id,
            fieldId: identity_documents.field_id,
            contentType: identity_documents.content_type,
            sizeBytes: identity_documents.size_bytes,
            scanStatus: identity_documents.scan_status,
          }).from(identity_documents).where(eq(identity_documents.submission_id, latestSubmission.id))
        : []
      const consent = assignment.data.consent
      const localizedConsentContent = consent?.contentByLocale as Record<string, string> | undefined
      const consentContent = consent
        ? (localizedConsentContent?.[locale] ?? localizedConsentContent?.[DEFAULT_LOCALE] ?? '')
        : ''
      programDtos.push({
        id: program.id,
        key: program.key,
        name: program.name,
        description: program.description,
        versionId: version.id,
        mode: version.mode,
        countries: assignment.data.countries,
        providerConfigId: assignment.data.providerConfigId,
        consent: consent
          ? { key: consent.key, documentVersion: consent.documentVersion, content: consentContent }
          : null,
        fields: version.fields.map(field => getLocalizedField(field, locale)),
        submission: latestSubmission
          ? {
              id: latestSubmission.id,
              status: latestSubmission.status,
              revision: latestSubmission.revision,
              countryCode: latestSubmission.country_code,
              reasonCode: latestSubmission.decision_reason_code,
              submittedAt: latestSubmission.submitted_at?.toISOString() ?? null,
              decidedAt: latestSubmission.decided_at?.toISOString() ?? null,
              expiresAt: latestSubmission.expires_at?.toISOString() ?? null,
              answers,
              documents,
            }
          : null,
      })
    }

    return programDtos
  },

  async createOrResume(userId: string, rawInput: z.input<typeof CreateSubmissionSchema>) {
    await assertIdentityCollectionEnabled()
    await assertNoActiveIdentityErasure(userId)
    const input = CreateSubmissionSchema.parse(rawInput)
    const [program] = await db.select().from(identity_programs).where(and(eq(identity_programs.id, input.programId), eq(identity_programs.status, 'published'))).limit(1)
    if (!program?.active_version_id) {
      throw new Error('IDENTITY_PROGRAM_NOT_AVAILABLE')
    }
    const [version] = await db.select().from(identity_program_versions).where(and(
      eq(identity_program_versions.id, program.active_version_id),
      eq(identity_program_versions.status, 'published'),
    )).limit(1)
    if (!version) {
      throw new Error('IDENTITY_PROGRAM_NOT_AVAILABLE')
    }
    const assignment = IdentityAssignmentRulesSchema.parse(version.assignment_rules)
    if (assignment.countries.length > 0 && (!input.countryCode || !assignment.countries.includes(input.countryCode))) {
      throw new Error('IDENTITY_COUNTRY_NOT_SUPPORTED')
    }
    if (input.countryCode) {
      const [existingCountry] = await db.select({ countryCode: identity_submissions.country_code })
        .from(identity_submissions)
        .where(and(
          eq(identity_submissions.user_id, userId),
          ne(identity_submissions.country_code, input.countryCode),
        ))
        .limit(1)
      if (existingCountry?.countryCode) {
        throw new Error('IDENTITY_COUNTRY_CONFLICT')
      }
    }

    const [active] = await db.select().from(identity_submissions).where(and(
      eq(identity_submissions.user_id, userId),
      eq(identity_submissions.program_id, program.id),
      inArray(identity_submissions.status, ['draft', 'pending', 'under_review', 'needs_resubmission']),
    )).orderBy(desc(identity_submissions.updated_at)).limit(1)
    if (active) {
      return { id: active.id, status: active.status }
    }

    const [latest] = await db.select({ attemptNumber: identity_submissions.attempt_number })
      .from(identity_submissions)
      .where(and(eq(identity_submissions.user_id, userId), eq(identity_submissions.program_id, program.id)))
      .orderBy(desc(identity_submissions.attempt_number))
      .limit(1)
    const [submission] = await db.insert(identity_submissions).values({
      user_id: userId,
      program_id: program.id,
      program_version_id: version.id,
      country_code: input.countryCode,
      status: 'draft',
      evidence_level: 'self_declared',
      source: version.mode,
      attempt_number: (latest?.attemptNumber ?? 0) + 1,
    }).returning({ id: identity_submissions.id, status: identity_submissions.status })
    if (!submission) {
      throw new Error('IDENTITY_SUBMISSION_CREATE_FAILED')
    }
    await db.insert(identity_audit_events).values({
      actor_user_id: userId,
      subject_user_id: userId,
      action: 'identity.submission.created',
      target_type: 'identity_submission',
      target_id: submission.id,
      result: 'success',
      metadata: { programId: program.id, countryCode: input.countryCode },
    })
    return submission
  },

  async saveAnswers(userId: string, rawInput: z.input<typeof SaveAnswersSchema>) {
    await assertIdentityCollectionEnabled()
    await assertNoActiveIdentityErasure(userId)
    const input = SaveAnswersSchema.parse(rawInput)
    const [submission] = await db.select().from(identity_submissions).where(and(
      eq(identity_submissions.id, input.submissionId),
      eq(identity_submissions.user_id, userId),
    )).limit(1)
    if (!submission || !['draft', 'needs_resubmission'].includes(submission.status)) {
      throw new Error('IDENTITY_SUBMISSION_NOT_EDITABLE')
    }
    if (submission.revision !== input.expectedRevision) {
      throw new Error('IDENTITY_SUBMISSION_STALE')
    }
    const version = await IdentityProgramRepository.getVersionForm(submission.program_version_id)
    if (!version) {
      throw new Error('IDENTITY_PROGRAM_VERSION_NOT_FOUND')
    }
    const assignment = IdentityAssignmentRulesSchema.parse(version.assignmentRules)
    const existingAnswers = await loadStoredAnswers(submission.id, version.fields)
    const mergedAnswers = { ...existingAnswers, ...input.answers }
    const normalizedAnswers: Record<string, unknown> = { ...existingAnswers }
    const fieldErrors: Record<string, string> = {}
    const preparedValues: Array<{
      field: IdentityFieldInput
      value: unknown
      normalizedText: string | null
    }> = []

    for (const field of version.fields.sort((left, right) => left.displayOrder - right.displayOrder)) {
      if (!field.id || !isIdentityFieldVisible(field, normalizedAnswers)) {
        continue
      }
      if (field.storageMode === 'provider_only' || field.storageMode === 'derived_result_only') {
        continue
      }
      const hasInput = Object.hasOwn(input.answers, field.key)
      if (!input.finalize && !hasInput) {
        continue
      }
      if (field.type === 'file' || field.type === 'document') {
        if (input.finalize && field.required) {
          const [document] = await db.select({ id: identity_documents.id })
            .from(identity_documents)
            .where(and(
              eq(identity_documents.submission_id, submission.id),
              eq(identity_documents.field_id, field.id),
              eq(identity_documents.scan_status, 'clean'),
            ))
            .limit(1)
          if (!document) {
            fieldErrors[field.key] = 'FIELD_DOCUMENT_REQUIRED'
          }
        }
        continue
      }
      const validation = validateIdentityFieldValue(field, mergedAnswers[field.key])
      if (validation.error) {
        fieldErrors[field.key] = validation.error
        continue
      }
      normalizedAnswers[field.key] = validation.value
      if (hasInput && field.storageMode === 'local_encrypted') {
        preparedValues.push({ field, value: validation.value, normalizedText: validation.normalizedText })
      }
    }

    if (Object.keys(fieldErrors).length > 0) {
      return { error: 'IDENTITY_FIELDS_INVALID', fieldErrors, status: submission.status }
    }
    if (input.finalize && assignment.consent && !input.consentAccepted) {
      return { error: 'IDENTITY_CONSENT_REQUIRED', fieldErrors: {}, status: submission.status }
    }

    await db.transaction(async (tx) => {
      const [lockedSubmission] = await tx.select({ revision: identity_submissions.revision })
        .from(identity_submissions)
        .where(and(
          eq(identity_submissions.id, submission.id),
          eq(identity_submissions.user_id, userId),
          eq(identity_submissions.revision, input.expectedRevision),
        ))
        .for('update')
      if (!lockedSubmission) {
        throw new Error('IDENTITY_SUBMISSION_STALE')
      }
      for (const prepared of preparedValues) {
        const fieldId = prepared.field.id!
        if (prepared.value === null) {
          await tx.delete(identity_submission_values).where(and(
            eq(identity_submission_values.submission_id, submission.id),
            eq(identity_submission_values.field_id, fieldId),
          ))
          continue
        }
        const encrypted = encryptIdentityValue(prepared.value, valueEncryptionContext(submission.id, fieldId))
        const duplicateDetection = prepared.field.config.duplicateDetection === true
        const blindIndex = duplicateDetection && prepared.normalizedText
          ? createIdentityBlindIndex(prepared.field.key, prepared.normalizedText)
          : null
        if (blindIndex) {
          const [duplicate] = await tx.select({ id: identity_submission_values.id })
            .from(identity_submission_values)
            .where(and(
              eq(identity_submission_values.field_id, fieldId),
              eq(identity_submission_values.blind_index, blindIndex),
              ne(identity_submission_values.submission_id, submission.id),
            ))
            .limit(1)
          if (duplicate) {
            throw new Error('IDENTITY_DUPLICATE_VALUE')
          }
        }
        await tx.insert(identity_submission_values).values({
          submission_id: submission.id,
          field_id: fieldId,
          value_type: prepared.field.type,
          encrypted_value: encrypted.encryptedValue,
          encryption_key_id: encrypted.keyId,
          blind_index: blindIndex,
          normalization_version: 1,
        }).onConflictDoUpdate({
          target: [identity_submission_values.submission_id, identity_submission_values.field_id],
          set: {
            value_type: prepared.field.type,
            encrypted_value: encrypted.encryptedValue,
            encryption_key_id: encrypted.keyId,
            blind_index: blindIndex,
            normalization_version: 1,
          },
        })
      }

      let nextStatus = submission.status as IdentitySubmissionStatus
      let decidedAt: Date | null = submission.decided_at
      let expiresAt: Date | null = submission.expires_at
      if (input.finalize) {
        if (version.decisionPolicy === 'auto_on_valid_submission'
          || (version.decisionPolicy === 'rules' && version.requiredEvidence === 'self_declared')) {
          nextStatus = 'approved'
          decidedAt = new Date()
          const accessPolicy = IdentityAccessPolicySchema.parse(version.accessPolicy)
          expiresAt = accessPolicy.approvalValidityDays
            ? new Date(Date.now() + accessPolicy.approvalValidityDays * 24 * 60 * 60 * 1000)
            : null
        }
        else if (version.decisionPolicy === 'manual_review') {
          nextStatus = 'under_review'
        }
        else {
          nextStatus = 'pending'
        }
        assertIdentityStatusTransition(submission.status as IdentitySubmissionStatus, nextStatus)
        if (assignment.consent) {
          const content = assignment.consent.contentByLocale[input.locale]
            ?? assignment.consent.contentByLocale[DEFAULT_LOCALE]
            ?? ''
          const contentHash = createHash('sha256').update(content, 'utf8').digest('base64url')
          await tx.insert(identity_consents).values({
            submission_id: submission.id,
            consent_key: assignment.consent.key,
            document_version: assignment.consent.documentVersion,
            locale: input.locale,
            content_hash: contentHash,
            accepted: true,
            accepted_at: new Date(),
          }).onConflictDoNothing()
        }
      }
      await tx.update(identity_submissions).set({
        status: nextStatus,
        submitted_at: input.finalize ? new Date() : submission.submitted_at,
        decided_at: decidedAt,
        expires_at: expiresAt,
        revision: sql`${identity_submissions.revision} + 1`,
      }).where(and(
        eq(identity_submissions.id, submission.id),
        eq(identity_submissions.revision, input.expectedRevision),
      ))
      await tx.insert(identity_audit_events).values({
        actor_user_id: userId,
        subject_user_id: userId,
        action: input.finalize ? 'identity.submission.finalized' : 'identity.submission.draft_saved',
        target_type: 'identity_submission',
        target_id: submission.id,
        result: 'success',
        metadata: {
          status: nextStatus,
          fieldCount: preparedValues.length,
          decisionPolicy: version.decisionPolicy,
          requiredEvidence: version.requiredEvidence,
          programVersionId: version.id,
        },
      })
    })

    if (input.finalize) {
      await recalculateIdentityGrants(submission.id)
    }
    const [updated] = await db.select({ status: identity_submissions.status })
      .from(identity_submissions)
      .where(eq(identity_submissions.id, submission.id))
      .limit(1)
    return { error: null, fieldErrors: {}, status: updated?.status ?? submission.status }
  },
}
