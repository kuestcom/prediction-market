import type { SUPPORTED_LOCALES } from '@/i18n/locales'
import { createHash, randomUUID } from 'node:crypto'
import { and, eq, gt, sql } from 'drizzle-orm'
import { z } from 'zod'
import { DEFAULT_LOCALE } from '@/i18n/locales'
import {
  identity_audit_events,
  identity_consents,
  identity_outbox_events,
  identity_program_versions,
  identity_provider_cases,
  identity_provider_configs,
  identity_provider_events,
  identity_submissions,
} from '@/lib/db/schema/identity/tables'
import { db } from '@/lib/drizzle'
import { assertIdentityCollectionEnabled, recalculateIdentityGrants } from '@/lib/identity/access'
import { decryptIdentityValue, encryptIdentityValue } from '@/lib/identity/encryption'
import { canStartIdentityProviderSession } from '@/lib/identity/lifecycle'
import { getIdentityProviderAdapter } from '@/lib/identity/providers/registry'
import { IdentityAccessPolicySchema, IdentityAssignmentRulesSchema } from '@/lib/identity/schemas'
import { assertIdentityStatusTransition } from '@/lib/identity/state-machine'
import { assertNoActiveIdentityErasure } from './identity-privacy'
import 'server-only'

const ProviderConfigInputSchema = z.object({
  id: z.string().length(26).optional(),
  key: z.string().trim().regex(/^[a-z][a-z0-9_]{1,63}$/),
  displayName: z.string().trim().min(1).max(160),
  adapter: z.literal('generic_webhook'),
  environment: z.enum(['sandbox', 'production']),
  enabled: z.boolean(),
  publicConfig: z.record(z.string(), z.unknown()),
  secret: z.string().min(32).max(512).optional(),
  removeSecret: z.boolean().default(false),
}).strict().refine(input => !(input.secret && input.removeSecret), { message: 'IDENTITY_PROVIDER_SECRET_INPUT_CONFLICT' })

export type IdentityProviderConfigInput = z.input<typeof ProviderConfigInputSchema>

function providerSecretContext(providerId: string) {
  return `identity-provider-config:${providerId}`
}

export const IdentityProviderRepository = {
  async listSafeConfigs() {
    const rows = await db.select({
      id: identity_provider_configs.id,
      key: identity_provider_configs.key,
      displayName: identity_provider_configs.display_name,
      adapter: identity_provider_configs.adapter,
      environment: identity_provider_configs.environment,
      enabled: identity_provider_configs.enabled,
      capabilities: identity_provider_configs.capabilities,
      publicConfig: identity_provider_configs.public_config,
      encryptedSecret: identity_provider_configs.encrypted_secret,
      secretRotatedAt: identity_provider_configs.secret_rotated_at,
      updatedAt: identity_provider_configs.updated_at,
    }).from(identity_provider_configs)

    return rows.map(row => ({
      id: row.id,
      key: row.key,
      displayName: row.displayName,
      adapter: row.adapter,
      environment: row.environment,
      enabled: row.enabled,
      capabilities: row.capabilities,
      publicConfig: row.publicConfig,
      secretConfigured: Boolean(row.encryptedSecret),
      secretRotatedAt: row.secretRotatedAt?.toISOString() ?? null,
      updatedAt: row.updatedAt.toISOString(),
    }))
  },

  async saveConfig(rawInput: IdentityProviderConfigInput, actorUserId: string) {
    const input = ProviderConfigInputSchema.parse(rawInput)
    const adapter = getIdentityProviderAdapter(input.adapter)
    const publicConfig = adapter.validateConfig(input.publicConfig, input.environment)

    return db.transaction(async (tx) => {
      let providerId = input.id
      let existing: typeof identity_provider_configs.$inferSelect | undefined
      if (providerId) {
        ;[existing] = await tx.select().from(identity_provider_configs).where(eq(identity_provider_configs.id, providerId)).limit(1)
        if (!existing) {
          throw new Error('IDENTITY_PROVIDER_NOT_FOUND')
        }
      }
      else {
        const [created] = await tx.insert(identity_provider_configs).values({
          key: input.key,
          display_name: input.displayName,
          adapter: input.adapter,
          environment: input.environment,
          enabled: false,
          capabilities: Object.entries(adapter.capabilities).filter(([, supported]) => supported).map(([key]) => key),
          public_config: publicConfig,
          created_by_user_id: actorUserId,
        }).returning()
        if (!created) {
          throw new Error('IDENTITY_PROVIDER_CREATE_FAILED')
        }
        existing = created
        providerId = created.id
      }

      let encryptedSecret = existing.encrypted_secret
      let encryptionKeyId = existing.encryption_key_id
      let secretRotatedAt = existing.secret_rotated_at
      if (input.removeSecret) {
        encryptedSecret = null
        encryptionKeyId = null
        secretRotatedAt = null
      }
      if (input.secret) {
        const encrypted = encryptIdentityValue(input.secret, providerSecretContext(providerId))
        encryptedSecret = encrypted.encryptedValue
        encryptionKeyId = encrypted.keyId
        secretRotatedAt = new Date()
      }
      if (input.enabled && !encryptedSecret) {
        throw new Error('IDENTITY_PROVIDER_SECRET_REQUIRED')
      }

      await tx.update(identity_provider_configs).set({
        key: input.key,
        display_name: input.displayName,
        adapter: input.adapter,
        environment: input.environment,
        enabled: input.enabled,
        capabilities: Object.entries(adapter.capabilities).filter(([, supported]) => supported).map(([key]) => key),
        public_config: publicConfig,
        encrypted_secret: encryptedSecret,
        encryption_key_id: encryptionKeyId,
        secret_rotated_at: secretRotatedAt,
      }).where(eq(identity_provider_configs.id, providerId))
      await tx.insert(identity_audit_events).values({
        actor_user_id: actorUserId,
        action: 'identity.provider.saved',
        target_type: 'identity_provider_config',
        target_id: providerId,
        result: 'success',
        metadata: { adapter: input.adapter, environment: input.environment, enabled: input.enabled },
      })

      return { id: providerId }
    })
  },

  async createSession(input: {
    providerConfigId: string
    submissionId: string
    userId: string
    returnUrl: string
    locale: (typeof SUPPORTED_LOCALES)[number]
    consentAccepted: boolean
  }) {
    await assertIdentityCollectionEnabled()
    await assertNoActiveIdentityErasure(input.userId)
    const [provider] = await db.select().from(identity_provider_configs).where(and(
      eq(identity_provider_configs.id, input.providerConfigId),
      eq(identity_provider_configs.enabled, true),
    )).limit(1)
    if (!provider?.encrypted_secret) {
      throw new Error('IDENTITY_PROVIDER_NOT_AVAILABLE')
    }
    const [submission] = await db.select().from(identity_submissions).where(and(
      eq(identity_submissions.id, input.submissionId),
      eq(identity_submissions.user_id, input.userId),
    )).limit(1)
    if (!submission) {
      throw new Error('IDENTITY_SUBMISSION_NOT_FOUND')
    }
    const [version] = await db.select().from(identity_program_versions).where(eq(identity_program_versions.id, submission.program_version_id)).limit(1)
    if (!version) {
      throw new Error('IDENTITY_PROGRAM_VERSION_NOT_FOUND')
    }
    if (!canStartIdentityProviderSession(
      version.mode as Parameters<typeof canStartIdentityProviderSession>[0],
      submission.status as Parameters<typeof canStartIdentityProviderSession>[1],
    )) {
      throw new Error(version.mode === 'hybrid'
        ? 'IDENTITY_LOCAL_EVIDENCE_REQUIRED'
        : 'IDENTITY_PROVIDER_NOT_ASSIGNED')
    }
    const assignment = IdentityAssignmentRulesSchema.parse(version.assignment_rules)
    if (![assignment.providerConfigId, ...assignment.fallbackProviderConfigIds].includes(provider.id)) {
      throw new Error('IDENTITY_PROVIDER_NOT_ASSIGNED')
    }
    if (assignment.consent) {
      const [existingConsent] = await db.select({ id: identity_consents.id }).from(identity_consents).where(and(
        eq(identity_consents.submission_id, submission.id),
        eq(identity_consents.consent_key, assignment.consent.key),
        eq(identity_consents.document_version, assignment.consent.documentVersion),
      )).limit(1)
      if (!existingConsent && !input.consentAccepted) {
        throw new Error('IDENTITY_CONSENT_REQUIRED')
      }
      if (!existingConsent) {
        const content = assignment.consent.contentByLocale[input.locale]
          ?? assignment.consent.contentByLocale[DEFAULT_LOCALE]
          ?? ''
        await db.insert(identity_consents).values({
          submission_id: submission.id,
          consent_key: assignment.consent.key,
          document_version: assignment.consent.documentVersion,
          locale: input.locale,
          content_hash: createHash('sha256').update(content, 'utf8').digest('base64url'),
          accepted: true,
          accepted_at: new Date(),
        }).onConflictDoNothing()
      }
    }

    const adapter = getIdentityProviderAdapter(provider.adapter)
    const config = adapter.validateConfig(provider.public_config, provider.environment as 'sandbox' | 'production')
    const secret = decryptIdentityValue<string>(provider.encrypted_secret, providerSecretContext(provider.id))
    const [existingCase] = await db.select().from(identity_provider_cases).where(and(
      eq(identity_provider_cases.provider_config_id, provider.id),
      eq(identity_provider_cases.submission_id, submission.id),
      eq(identity_provider_cases.status, 'pending'),
      gt(identity_provider_cases.session_expires_at, new Date()),
    )).limit(1)
    if (existingCase?.session_reference_encrypted && existingCase.session_expires_at) {
      return {
        sessionUrl: decryptIdentityValue<string>(existingCase.session_reference_encrypted, `identity-provider-session:${existingCase.id}`),
        expiresAt: existingCase.session_expires_at.toISOString(),
      }
    }
    const externalReference = randomUUID()
    const [providerCase] = await db.insert(identity_provider_cases).values({
      provider_config_id: provider.id,
      submission_id: submission.id,
      external_reference: externalReference,
      status: 'created',
    }).returning({ id: identity_provider_cases.id })
    if (!providerCase) {
      throw new Error('IDENTITY_PROVIDER_CASE_CREATE_FAILED')
    }

    const session = await adapter.createSession({
      config,
      secret,
      caseId: providerCase.id,
      submissionId: submission.id,
      userId: input.userId,
      externalReference,
      returnUrl: input.returnUrl,
    })
    const encryptedSession = encryptIdentityValue(session.sessionUrl, `identity-provider-session:${providerCase.id}`)
    await db.transaction(async (tx) => {
      await tx.update(identity_provider_cases).set({
        status: 'pending',
        session_reference_encrypted: encryptedSession.encryptedValue,
        session_expires_at: session.expiresAt,
      }).where(eq(identity_provider_cases.id, providerCase.id))
      if (submission.status === 'draft' || submission.status === 'needs_resubmission') {
        assertIdentityStatusTransition(
          submission.status as Parameters<typeof assertIdentityStatusTransition>[0],
          'pending',
        )
        await tx.update(identity_submissions).set({
          status: 'pending',
          submitted_at: new Date(),
          revision: sql`${identity_submissions.revision} + 1`,
        }).where(eq(identity_submissions.id, submission.id))
      }
      await tx.insert(identity_audit_events).values({
        actor_user_id: input.userId,
        subject_user_id: input.userId,
        action: 'identity.provider.session_created',
        target_type: 'identity_provider_case',
        target_id: providerCase.id,
        result: 'success',
        metadata: { providerKey: provider.key, environment: provider.environment },
      })
    })
    return { sessionUrl: session.sessionUrl, expiresAt: session.expiresAt.toISOString() }
  },

  async processWebhook(input: { providerKey: string, headers: Headers, rawBody: string }) {
    const [provider] = await db.select().from(identity_provider_configs).where(eq(identity_provider_configs.key, input.providerKey)).limit(1)
    if (!provider?.encrypted_secret) {
      throw new Error('IDENTITY_PROVIDER_NOT_FOUND')
    }
    const adapter = getIdentityProviderAdapter(provider.adapter)
    const config = adapter.validateConfig(provider.public_config, provider.environment as 'sandbox' | 'production')
    const secret = decryptIdentityValue<string>(provider.encrypted_secret, providerSecretContext(provider.id))
    const event = adapter.parseWebhook({ config, secret, headers: input.headers, rawBody: input.rawBody })
    const payloadHash = createHash('sha256').update(input.rawBody).digest('base64url')

    const processed = await db.transaction(async (tx) => {
      const insertedEvent = await tx.insert(identity_provider_events).values({
        provider_config_id: provider.id,
        external_event_id: event.eventId,
        event_type: event.eventType,
        payload_hash: payloadHash,
      }).onConflictDoNothing().returning({ id: identity_provider_events.id })
      if (insertedEvent.length === 0) {
        return { duplicate: true, submissionId: null as string | null }
      }

      const [providerCase] = await tx.select().from(identity_provider_cases).where(and(
        eq(identity_provider_cases.provider_config_id, provider.id),
        eq(identity_provider_cases.external_reference, event.externalReference),
      )).for('update')
      if (!providerCase) {
        await tx.update(identity_provider_events).set({ status: 'ignored', error_code: 'CASE_NOT_FOUND', processed_at: new Date() }).where(eq(identity_provider_events.id, insertedEvent[0]!.id))
        return { duplicate: false, submissionId: null as string | null }
      }

      const [submission] = await tx.select().from(identity_submissions).where(eq(identity_submissions.id, providerCase.submission_id)).for('update')
      if (!submission) {
        throw new Error('IDENTITY_SUBMISSION_NOT_FOUND')
      }
      const [version] = await tx.select({
        decisionPolicy: identity_program_versions.decision_policy,
        accessPolicy: identity_program_versions.access_policy,
      })
        .from(identity_program_versions)
        .where(eq(identity_program_versions.id, submission.program_version_id))
        .limit(1)
      const nextDecision = event.decision === 'approved' && version?.decisionPolicy === 'provider_plus_manual'
        ? 'under_review'
        : event.decision
      assertIdentityStatusTransition(
        submission.status as Parameters<typeof assertIdentityStatusTransition>[0],
        nextDecision,
      )
      const now = new Date()
      const accessPolicy = version ? IdentityAccessPolicySchema.parse(version.accessPolicy) : null
      const expiresAt = nextDecision === 'approved' && accessPolicy?.approvalValidityDays
        ? new Date(now.getTime() + accessPolicy.approvalValidityDays * 24 * 60 * 60 * 1000)
        : null
      await tx.update(identity_provider_cases).set({
        status: event.decision,
        mapped_decision: nextDecision,
        last_reconciled_at: now,
      }).where(eq(identity_provider_cases.id, providerCase.id))
      await tx.update(identity_submissions).set({
        status: nextDecision,
        evidence_level: event.decision === 'approved' ? 'provider_verified' : submission.evidence_level,
        decision_reason_code: event.reasonCode,
        decided_at: ['approved', 'rejected', 'suspended'].includes(nextDecision) ? now : null,
        expires_at: expiresAt,
        revision: sql`${identity_submissions.revision} + 1`,
      }).where(eq(identity_submissions.id, submission.id))
      await tx.update(identity_provider_events).set({ status: 'processed', processed_at: now }).where(eq(identity_provider_events.id, insertedEvent[0]!.id))
      await tx.insert(identity_outbox_events).values({
        event_type: 'identity.submission.status_changed',
        aggregate_type: 'identity_submission',
        aggregate_id: submission.id,
        idempotency_key: `identity-provider-event:${provider.id}:${event.eventId}`,
        payload: { contractVersion: 1, submissionId: submission.id, userId: submission.user_id, status: nextDecision },
      }).onConflictDoNothing()
      await tx.insert(identity_audit_events).values({
        subject_user_id: submission.user_id,
        action: 'identity.provider.status_changed',
        target_type: 'identity_submission',
        target_id: submission.id,
        reason_code: event.reasonCode,
        result: 'success',
        metadata: { providerKey: provider.key, eventType: event.eventType, providerDecision: event.decision, decision: nextDecision },
      })
      return { duplicate: false, submissionId: submission.id }
    })

    if (processed.submissionId) {
      await recalculateIdentityGrants(processed.submissionId)
    }
    return processed
  },
}
