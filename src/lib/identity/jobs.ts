import type { IdentitySubmissionStatus } from './types'
import { and, asc, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm'
import { IdentityPrivacyRepository } from '@/lib/db/queries/identity-privacy'
import {
  identity_data_exports,
  identity_document_access_tokens,
  identity_documents,
  identity_erasure_requests,
  identity_legal_holds,
  identity_operation_rate_limits,
  identity_outbox_events,
  identity_program_versions,
  identity_provider_cases,
  identity_provider_configs,
  identity_submissions,
} from '@/lib/db/schema/identity/tables'
import { db } from '@/lib/drizzle'
import { deletePrivateIdentityObject } from '@/lib/storage'
import { recalculateIdentityGrants } from './access'
import { decryptIdentityValue } from './encryption'
import { getIdentityProviderAdapter } from './providers/registry'
import { IdentityAccessPolicySchema, IdentityRetentionPolicySchema } from './schemas'
import { assertIdentityStatusTransition } from './state-machine'
import 'server-only'

const BATCH_SIZE = 50

async function processExpiredApprovals(now: Date) {
  const rows = await db.select({ id: identity_submissions.id })
    .from(identity_submissions)
    .where(and(eq(identity_submissions.status, 'approved'), lte(identity_submissions.expires_at, now)))
    .limit(BATCH_SIZE)
  for (const row of rows) {
    await db.update(identity_submissions).set({
      status: 'expired',
      decision_reason_code: 'APPROVAL_EXPIRED',
      revision: sql`${identity_submissions.revision} + 1`,
    }).where(and(eq(identity_submissions.id, row.id), eq(identity_submissions.status, 'approved')))
    await recalculateIdentityGrants(row.id)
  }
  return rows.length
}

async function deleteExpiredDocumentsAndExports(now: Date) {
  const documents = await db.select().from(identity_documents).where(lte(identity_documents.retention_expires_at, now)).limit(BATCH_SIZE)
  let documentsDeleted = 0
  for (const document of documents) {
    const result = await deletePrivateIdentityObject(document.object_key)
    if (!result.error) {
      await db.delete(identity_documents).where(eq(identity_documents.id, document.id))
      documentsDeleted += 1
    }
  }

  const exports = await db.select().from(identity_data_exports).where(and(eq(identity_data_exports.status, 'ready'), lte(identity_data_exports.expires_at, now))).limit(BATCH_SIZE)
  let exportsDeleted = 0
  for (const item of exports) {
    const result = item.object_key ? await deletePrivateIdentityObject(item.object_key) : { error: null }
    if (!result.error) {
      await db.update(identity_data_exports).set({ status: 'deleted', object_key: null }).where(eq(identity_data_exports.id, item.id))
      exportsDeleted += 1
    }
  }
  await db.delete(identity_document_access_tokens).where(or(
    lte(identity_document_access_tokens.expires_at, now),
    lte(identity_document_access_tokens.used_at, now),
  ))
  await db.delete(identity_operation_rate_limits).where(lte(
    identity_operation_rate_limits.window_started_at,
    new Date(now.getTime() - 48 * 60 * 60 * 1000),
  ))
  return { documentsDeleted, exportsDeleted }
}

async function deleteExpiredSubmissions(now: Date) {
  const rows = await db.select({ submission: identity_submissions, retention: identity_program_versions.retention_policy })
    .from(identity_submissions)
    .innerJoin(identity_program_versions, eq(identity_program_versions.id, identity_submissions.program_version_id))
    .where(inArray(identity_submissions.status, ['draft', 'rejected', 'needs_resubmission', 'expired']))
    .orderBy(asc(identity_submissions.updated_at))
    .limit(BATCH_SIZE)
  let deleted = 0
  for (const row of rows) {
    const retention = IdentityRetentionPolicySchema.safeParse(row.retention)
    if (!retention.success) {
      continue
    }
    const days = row.submission.status === 'draft'
      ? retention.data.draftDays
      : row.submission.status === 'expired'
        ? retention.data.expiredDays
        : retention.data.rejectedDays
    if (row.submission.updated_at.getTime() + days * 86_400_000 > now.getTime()) {
      continue
    }
    const [hold] = await db.select({ id: identity_legal_holds.id }).from(identity_legal_holds).where(and(
      eq(identity_legal_holds.user_id, row.submission.user_id),
      isNull(identity_legal_holds.released_at),
      or(isNull(identity_legal_holds.expires_at), gte(identity_legal_holds.expires_at, now)),
    )).limit(1)
    if (hold) {
      continue
    }
    const documents = await db.select().from(identity_documents).where(eq(identity_documents.submission_id, row.submission.id))
    let objectFailure = false
    for (const document of documents) {
      const result = await deletePrivateIdentityObject(document.object_key)
      objectFailure ||= Boolean(result.error)
    }
    if (!objectFailure) {
      await db.delete(identity_submissions).where(eq(identity_submissions.id, row.submission.id))
      deleted += 1
    }
  }
  return deleted
}

async function processErasures() {
  const rows = await db.select({ id: identity_erasure_requests.id })
    .from(identity_erasure_requests)
    .where(inArray(identity_erasure_requests.status, ['pending', 'failed_retryable', 'needs_attention', 'blocked_legal_hold']))
    .orderBy(asc(identity_erasure_requests.updated_at))
    .limit(10)
  for (const row of rows) {
    await IdentityPrivacyRepository.processErasure(row.id)
  }
  return rows.length
}

async function reconcileProviderCases(now: Date) {
  const staleAt = new Date(now.getTime() - 15 * 60_000)
  const rows = await db.select({ providerCase: identity_provider_cases, provider: identity_provider_configs })
    .from(identity_provider_cases)
    .innerJoin(identity_provider_configs, eq(identity_provider_configs.id, identity_provider_cases.provider_config_id))
    .where(and(
      inArray(identity_provider_cases.status, ['created', 'pending', 'under_review']),
      or(isNull(identity_provider_cases.last_reconciled_at), lte(identity_provider_cases.last_reconciled_at, staleAt)),
    ))
    .limit(BATCH_SIZE)
  let reconciled = 0
  for (const row of rows) {
    if (!row.provider.encrypted_secret) {
      continue
    }
    try {
      const adapter = getIdentityProviderAdapter(row.provider.adapter)
      if (!adapter.getCase) {
        continue
      }
      const config = adapter.validateConfig(row.provider.public_config, row.provider.environment as 'sandbox' | 'production')
      const secret = decryptIdentityValue<string>(row.provider.encrypted_secret, `identity-provider-config:${row.provider.id}`)
      const result = await adapter.getCase({ config, secret, externalReference: row.providerCase.external_reference })
      await db.update(identity_provider_cases).set({
        last_reconciled_at: now,
        // Provider-specific raw statuses are intentionally not persisted in the
        // canonical status column, which is protected by a database constraint.
        ...(result.decision ? { status: result.decision } : {}),
      }).where(eq(identity_provider_cases.id, row.providerCase.id))
      if (result.decision) {
        const [submission] = await db.select({
          id: identity_submissions.id,
          status: identity_submissions.status,
          versionId: identity_submissions.program_version_id,
        }).from(identity_submissions).where(eq(identity_submissions.id, row.providerCase.submission_id)).limit(1)
        if (submission && ['pending', 'under_review'].includes(submission.status) && submission.status !== result.decision) {
          const [version] = await db.select({
            decisionPolicy: identity_program_versions.decision_policy,
            accessPolicy: identity_program_versions.access_policy,
          })
            .from(identity_program_versions)
            .where(eq(identity_program_versions.id, submission.versionId))
            .limit(1)
          const decision = result.decision === 'approved' && version?.decisionPolicy === 'provider_plus_manual'
            ? 'under_review'
            : result.decision
          if (decision !== submission.status) {
            assertIdentityStatusTransition(submission.status as IdentitySubmissionStatus, decision)
            const accessPolicy = version ? IdentityAccessPolicySchema.parse(version.accessPolicy) : null
            const expiresAt = decision === 'approved' && accessPolicy?.approvalValidityDays
              ? new Date(now.getTime() + accessPolicy.approvalValidityDays * 86_400_000)
              : null
            await db.update(identity_submissions).set({
              status: decision,
              evidence_level: result.decision === 'approved' ? 'provider_verified' : undefined,
              decision_reason_code: 'PROVIDER_RECONCILIATION',
              decided_at: ['approved', 'rejected', 'suspended'].includes(decision) ? now : null,
              expires_at: expiresAt,
              revision: sql`${identity_submissions.revision} + 1`,
            }).where(and(eq(identity_submissions.id, submission.id), eq(identity_submissions.status, submission.status)))
            await recalculateIdentityGrants(submission.id)
          }
        }
      }
      reconciled += 1
    }
    catch {
      await db.update(identity_provider_cases).set({ last_reconciled_at: now }).where(eq(identity_provider_cases.id, row.providerCase.id))
    }
  }
  return reconciled
}

async function processOutbox(now: Date) {
  const rows = await db.select().from(identity_outbox_events).where(and(inArray(identity_outbox_events.status, ['pending', 'failed_retryable']), lte(identity_outbox_events.available_at, now))).orderBy(asc(identity_outbox_events.available_at)).limit(BATCH_SIZE)
  let completed = 0
  for (const row of rows) {
    const [reserved] = await db.update(identity_outbox_events).set({ status: 'processing' }).where(and(eq(identity_outbox_events.id, row.id), inArray(identity_outbox_events.status, ['pending', 'failed_retryable']))).returning({ id: identity_outbox_events.id })
    if (!reserved) {
      continue
    }
    try {
      if (row.event_type === 'identity.program.published') {
        const submissions = await db.select({ id: identity_submissions.id })
          .from(identity_submissions)
          .where(eq(identity_submissions.program_id, row.aggregate_id))
          .limit(BATCH_SIZE)
        for (const submission of submissions) {
          await recalculateIdentityGrants(submission.id)
        }
      }
      await db.update(identity_outbox_events).set({ status: 'completed', processed_at: now, last_error_code: null }).where(eq(identity_outbox_events.id, row.id))
      completed += 1
    }
    catch {
      const attempts = row.attempt_count + 1
      await db.update(identity_outbox_events).set({
        status: attempts >= 8 ? 'failed_permanent' : 'failed_retryable',
        attempt_count: attempts,
        available_at: new Date(now.getTime() + Math.min(60 * 60_000, 2 ** attempts * 30_000)),
        last_error_code: 'IDENTITY_OUTBOX_PROCESSING_FAILED',
      }).where(eq(identity_outbox_events.id, row.id))
    }
  }
  return completed
}

export async function runIdentityMaintenance(now = new Date()) {
  const expiredApprovals = await processExpiredApprovals(now)
  const expiredObjects = await deleteExpiredDocumentsAndExports(now)
  const expiredSubmissions = await deleteExpiredSubmissions(now)
  const erasures = await processErasures()
  const reconciledCases = await reconcileProviderCases(now)
  const outboxEvents = await processOutbox(now)
  return { expiredApprovals, ...expiredObjects, expiredSubmissions, erasures, reconciledCases, outboxEvents }
}
