import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import { and, desc, eq, gt, inArray, isNull, lt, or } from 'drizzle-orm'
import {
  identity_access_grants,
  identity_audit_events,
  identity_consents,
  identity_data_exports,
  identity_documents,
  identity_erasure_requests,
  identity_fields,
  identity_legal_holds,
  identity_provider_cases,
  identity_provider_configs,
  identity_submission_values,
  identity_submissions,
} from '@/lib/db/schema/identity/tables'
import { db } from '@/lib/drizzle'
import { decryptIdentityBytes, decryptIdentityValue, encryptIdentityBytes } from '@/lib/identity/encryption'
import { getIdentityProviderAdapter } from '@/lib/identity/providers/registry'
import {
  deletePrivateIdentityObject,
  downloadPrivateIdentityObject,
  uploadPrivateIdentityObject,
} from '@/lib/storage'
import 'server-only'

function safeUserPath(userId: string) {
  return userId.replace(/[^\w-]/g, '_')
}

async function activeLegalHold(userId: string) {
  const [hold] = await db.select({ id: identity_legal_holds.id })
    .from(identity_legal_holds)
    .where(and(
      eq(identity_legal_holds.user_id, userId),
      isNull(identity_legal_holds.released_at),
      or(isNull(identity_legal_holds.expires_at), gt(identity_legal_holds.expires_at, new Date())),
    ))
    .limit(1)
  return hold ?? null
}

export async function assertNoActiveIdentityErasure(userId: string) {
  const [request] = await db.select({ id: identity_erasure_requests.id })
    .from(identity_erasure_requests)
    .where(and(
      eq(identity_erasure_requests.user_id, userId),
      inArray(identity_erasure_requests.status, ['pending', 'processing', 'needs_attention', 'blocked_legal_hold']),
    ))
    .limit(1)
  if (request) {
    throw new Error('IDENTITY_ERASURE_IN_PROGRESS')
  }
}

async function buildUserExport(userId: string) {
  const submissions = await db.select().from(identity_submissions).where(eq(identity_submissions.user_id, userId)).orderBy(desc(identity_submissions.created_at))
  const submissionIds = submissions.map(submission => submission.id)
  const values = submissionIds.length > 0
    ? await db.select({
        submissionId: identity_submission_values.submission_id,
        fieldId: identity_submission_values.field_id,
        fieldKey: identity_fields.key,
        fieldType: identity_fields.type,
        encryptedValue: identity_submission_values.encrypted_value,
      }).from(identity_submission_values).innerJoin(identity_fields, eq(identity_fields.id, identity_submission_values.field_id)).where(inArray(identity_submission_values.submission_id, submissionIds))
    : []
  const consents = submissionIds.length > 0
    ? await db.select().from(identity_consents).where(inArray(identity_consents.submission_id, submissionIds))
    : []
  const providerCases = submissionIds.length > 0
    ? await db.select({
        submissionId: identity_provider_cases.submission_id,
        status: identity_provider_cases.status,
        mappedDecision: identity_provider_cases.mapped_decision,
        createdAt: identity_provider_cases.created_at,
        updatedAt: identity_provider_cases.updated_at,
      }).from(identity_provider_cases).where(inArray(identity_provider_cases.submission_id, submissionIds))
    : []

  return {
    schema: 'kuest.identity.user-export.v1',
    generatedAt: new Date().toISOString(),
    userId,
    submissions: submissions.map(submission => ({
      id: submission.id,
      programId: submission.program_id,
      programVersionId: submission.program_version_id,
      countryCode: submission.country_code,
      status: submission.status,
      evidenceLevel: submission.evidence_level,
      attemptNumber: submission.attempt_number,
      reasonCode: submission.decision_reason_code,
      submittedAt: submission.submitted_at?.toISOString() ?? null,
      decidedAt: submission.decided_at?.toISOString() ?? null,
      expiresAt: submission.expires_at?.toISOString() ?? null,
      values: values.filter(value => value.submissionId === submission.id).map(value => ({
        fieldKey: value.fieldKey,
        fieldType: value.fieldType,
        value: decryptIdentityValue(value.encryptedValue, `identity-submission:${submission.id}:field:${value.fieldId}`),
      })),
      consents: consents.filter(consent => consent.submission_id === submission.id).map(consent => ({
        key: consent.consent_key,
        documentVersion: consent.document_version,
        locale: consent.locale,
        accepted: consent.accepted,
        acceptedAt: consent.accepted_at?.toISOString() ?? null,
        withdrawnAt: consent.withdrawn_at?.toISOString() ?? null,
        contentHash: consent.content_hash,
      })),
      providerCases: providerCases.filter(providerCase => providerCase.submissionId === submission.id),
    })),
  }
}

export const IdentityPrivacyRepository = {
  async hasUserFootprint(userId: string) {
    const [submission, dataExport, erasure] = await Promise.all([
      db.select({ id: identity_submissions.id }).from(identity_submissions).where(eq(identity_submissions.user_id, userId)).limit(1),
      db.select({ id: identity_data_exports.id }).from(identity_data_exports).where(eq(identity_data_exports.user_id, userId)).limit(1),
      db.select({ id: identity_erasure_requests.id }).from(identity_erasure_requests).where(eq(identity_erasure_requests.user_id, userId)).limit(1),
    ])
    return submission.length > 0 || dataExport.length > 0 || erasure.length > 0
  },

  async listUserPrivacyState(userId: string) {
    const [exports, requests, hold] = await Promise.all([
      db.select({
        id: identity_data_exports.id,
        status: identity_data_exports.status,
        expiresAt: identity_data_exports.expires_at,
        createdAt: identity_data_exports.created_at,
        completedAt: identity_data_exports.completed_at,
      }).from(identity_data_exports).where(eq(identity_data_exports.user_id, userId)).orderBy(desc(identity_data_exports.created_at)).limit(10),
      db.select({
        id: identity_erasure_requests.id,
        scope: identity_erasure_requests.scope,
        status: identity_erasure_requests.status,
        reasonCode: identity_erasure_requests.reason_code,
        progress: identity_erasure_requests.progress,
        requestedAt: identity_erasure_requests.requested_at,
        completedAt: identity_erasure_requests.completed_at,
      }).from(identity_erasure_requests).where(eq(identity_erasure_requests.user_id, userId)).orderBy(desc(identity_erasure_requests.requested_at)).limit(10),
      activeLegalHold(userId),
    ])
    return { exports, requests, legalHoldActive: Boolean(hold) }
  },

  async createExport(userId: string) {
    const [recent] = await db.select({ createdAt: identity_data_exports.created_at })
      .from(identity_data_exports)
      .where(eq(identity_data_exports.user_id, userId))
      .orderBy(desc(identity_data_exports.created_at))
      .limit(1)
    if (recent && Date.now() - recent.createdAt.getTime() < 60 * 60 * 1000) {
      throw new Error('IDENTITY_EXPORT_RATE_LIMITED')
    }
    const [created] = await db.insert(identity_data_exports).values({ user_id: userId }).returning({ id: identity_data_exports.id })
    if (!created) {
      throw new Error('IDENTITY_EXPORT_CREATE_FAILED')
    }
    try {
      const payload = Buffer.from(JSON.stringify(await buildUserExport(userId), null, 2), 'utf8')
      const objectKey = `identity-private/${safeUserPath(userId)}/exports/${randomUUID()}.enc`
      const encrypted = encryptIdentityBytes(payload, `identity-export:${objectKey}`)
      const upload = await uploadPrivateIdentityObject(objectKey, encrypted.encryptedValue)
      if (upload.error) {
        throw new Error('IDENTITY_EXPORT_UPLOAD_FAILED')
      }
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000)
      await db.update(identity_data_exports).set({
        status: 'ready',
        object_key: objectKey,
        encryption_key_id: encrypted.keyId,
        expires_at: expiresAt,
        completed_at: new Date(),
      }).where(eq(identity_data_exports.id, created.id))
      await db.insert(identity_audit_events).values({
        actor_user_id: userId,
        subject_user_id: userId,
        action: 'identity.export.created',
        target_type: 'identity_data_export',
        target_id: created.id,
        result: 'success',
        metadata: { expiresAt: expiresAt.toISOString() },
      })
      return { id: created.id, status: 'ready' as const, expiresAt: expiresAt.toISOString() }
    }
    catch (error) {
      await db.update(identity_data_exports).set({ status: 'failed' }).where(eq(identity_data_exports.id, created.id))
      throw error
    }
  },

  async downloadExport(userId: string, exportId: string) {
    const [record] = await db.select().from(identity_data_exports).where(and(
      eq(identity_data_exports.id, exportId),
      eq(identity_data_exports.user_id, userId),
      eq(identity_data_exports.status, 'ready'),
      gt(identity_data_exports.expires_at, new Date()),
      lt(identity_data_exports.download_count, 3),
    )).limit(1)
    if (!record?.object_key) {
      return null
    }
    const stored = await downloadPrivateIdentityObject(record.object_key)
    if (!stored.data || stored.error) {
      throw new Error('IDENTITY_EXPORT_DOWNLOAD_FAILED')
    }
    const bytes = decryptIdentityBytes(stored.data.toString('utf8'), `identity-export:${record.object_key}`)
    const consumed = await db.update(identity_data_exports).set({ download_count: record.download_count + 1 }).where(and(eq(identity_data_exports.id, record.id), eq(identity_data_exports.download_count, record.download_count))).returning({ id: identity_data_exports.id })
    if (consumed.length === 0) {
      throw new Error('IDENTITY_EXPORT_DOWNLOAD_LIMIT_REACHED')
    }
    return { bytes, filename: `identity-export-${record.id}.json` }
  },

  async requestErasure(userId: string, requestedByUserId = userId, scope = 'identity_only') {
    const [existing] = await db.select({ id: identity_erasure_requests.id, status: identity_erasure_requests.status })
      .from(identity_erasure_requests)
      .where(and(
        eq(identity_erasure_requests.user_id, userId),
        inArray(identity_erasure_requests.status, ['pending', 'processing', 'needs_attention', 'blocked_legal_hold']),
      ))
      .limit(1)
    if (existing) {
      return existing
    }
    const [request] = await db.insert(identity_erasure_requests).values({
      user_id: userId,
      requested_by_user_id: requestedByUserId,
      scope,
      status: 'pending',
      progress: { providers: 'pending', objectStorage: 'pending', database: 'pending' },
    }).returning({ id: identity_erasure_requests.id, status: identity_erasure_requests.status })
    if (!request) {
      throw new Error('IDENTITY_ERASURE_CREATE_FAILED')
    }
    return request
  },

  async processErasure(requestId: string) {
    const [request] = await db.select().from(identity_erasure_requests).where(eq(identity_erasure_requests.id, requestId)).limit(1)
    if (!request?.user_id || request.status === 'completed') {
      return request ? { id: request.id, status: request.status } : null
    }
    const userId = request.user_id
    const hold = await activeLegalHold(userId)
    if (hold) {
      await db.update(identity_erasure_requests).set({
        status: 'blocked_legal_hold',
        reason_code: 'LEGAL_HOLD_ACTIVE',
        progress: { providers: 'blocked_by_retention', objectStorage: 'blocked_by_retention', database: 'blocked_by_retention', legalHoldId: hold.id },
      }).where(eq(identity_erasure_requests.id, request.id))
      return { id: request.id, status: 'blocked_legal_hold' }
    }
    await db.update(identity_erasure_requests).set({ status: 'processing', started_at: request.started_at ?? new Date() }).where(eq(identity_erasure_requests.id, request.id))
    await db.update(identity_access_grants).set({ revoked_at: new Date() }).where(and(
      eq(identity_access_grants.user_id, userId),
      isNull(identity_access_grants.revoked_at),
    ))

    const submissions = await db.select({ id: identity_submissions.id })
      .from(identity_submissions)
      .where(eq(identity_submissions.user_id, userId))
    const submissionIds = submissions.map(submission => submission.id)
    const providerCases = submissionIds.length > 0
      ? await db.select({ case: identity_provider_cases, provider: identity_provider_configs })
          .from(identity_provider_cases)
          .innerJoin(identity_provider_configs, eq(identity_provider_configs.id, identity_provider_cases.provider_config_id))
          .where(inArray(identity_provider_cases.submission_id, submissionIds))
      : []
    const providerFailures: string[] = []
    const unsupportedProviders: string[] = []
    for (const row of providerCases) {
      const adapter = getIdentityProviderAdapter(row.provider.adapter)
      if (!adapter.deleteCase || !row.provider.encrypted_secret) {
        unsupportedProviders.push(row.provider.key)
        continue
      }
      try {
        const config = adapter.validateConfig(row.provider.public_config, row.provider.environment as 'sandbox' | 'production')
        const secret = decryptIdentityValue<string>(row.provider.encrypted_secret, `identity-provider-config:${row.provider.id}`)
        const result = await adapter.deleteCase({ config, secret, externalReference: row.case.external_reference })
        if (!result.deleted) {
          providerFailures.push(row.provider.key)
        }
      }
      catch {
        providerFailures.push(row.provider.key)
      }
    }
    if (providerFailures.length > 0 || unsupportedProviders.length > 0) {
      await db.update(identity_erasure_requests).set({
        status: 'needs_attention',
        reason_code: unsupportedProviders.length > 0 ? 'PROVIDER_ERASURE_UNSUPPORTED' : 'PROVIDER_ERASURE_FAILED',
        progress: {
          providers: unsupportedProviders.length > 0 ? 'unsupported_by_provider' : 'failed_retryable',
          objectStorage: 'pending',
          database: 'pending',
          providerFailures: [...new Set(providerFailures)],
          unsupportedProviders: [...new Set(unsupportedProviders)],
        },
      }).where(eq(identity_erasure_requests.id, request.id))
      return { id: request.id, status: 'needs_attention' }
    }

    const [documents, exports] = await Promise.all([
      submissionIds.length > 0
        ? db.select().from(identity_documents).where(inArray(identity_documents.submission_id, submissionIds))
        : [],
      db.select().from(identity_data_exports).where(eq(identity_data_exports.user_id, userId)),
    ])
    const objectFailures: string[] = []
    for (const objectKey of [...documents.map(document => document.object_key), ...exports.flatMap(item => item.object_key ? [item.object_key] : [])]) {
      const result = await deletePrivateIdentityObject(objectKey)
      if (result.error) {
        objectFailures.push(objectKey)
      }
    }
    if (objectFailures.length > 0) {
      await db.update(identity_erasure_requests).set({
        status: 'needs_attention',
        reason_code: 'OBJECT_ERASURE_FAILED',
        progress: { providers: 'completed', objectStorage: 'failed_retryable', database: 'pending', failedObjectCount: objectFailures.length },
      }).where(eq(identity_erasure_requests.id, request.id))
      return { id: request.id, status: 'needs_attention' }
    }

    await db.transaction(async (tx) => {
      await tx.delete(identity_data_exports).where(eq(identity_data_exports.user_id, userId))
      await tx.delete(identity_access_grants).where(eq(identity_access_grants.user_id, userId))
      await tx.delete(identity_submissions).where(eq(identity_submissions.user_id, userId))
      await tx.update(identity_audit_events).set({
        subject_user_id: null,
        target_id: null,
        metadata: {},
      }).where(eq(identity_audit_events.subject_user_id, userId))
      await tx.update(identity_erasure_requests).set({
        status: 'completed',
        reason_code: null,
        progress: { providers: 'completed', objectStorage: 'completed', database: 'completed' },
        completed_at: new Date(),
      }).where(eq(identity_erasure_requests.id, request.id))
      await tx.insert(identity_audit_events).values({
        action: 'identity.erasure.completed',
        target_type: 'identity_erasure_request',
        target_id: request.id,
        result: 'success',
        metadata: { scope: request.scope },
      })
    })
    return { id: request.id, status: 'completed' }
  },

  async eraseForAccountDeletion(userId: string) {
    const request = await this.requestErasure(userId, userId, 'full_account')
    const result = await this.processErasure(request.id)
    if (!result || result.status !== 'completed') {
      throw new Error(result?.status === 'blocked_legal_hold' ? 'IDENTITY_ERASURE_LEGAL_HOLD' : 'IDENTITY_ERASURE_INCOMPLETE')
    }
    return result
  },
}
