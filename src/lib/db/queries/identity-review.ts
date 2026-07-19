import type { IdentitySubmissionStatus } from '@/lib/identity/types'
import { and, asc, count, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm'
import { z } from 'zod'
import {
  identity_audit_events,
  identity_documents,
  identity_erasure_requests,
  identity_field_translations,
  identity_fields,
  identity_outbox_events,
  identity_program_versions,
  identity_programs,
  identity_provider_events,
  identity_reviews,
  identity_submission_values,
  identity_submissions,
} from '@/lib/db/schema/identity/tables'
import { db } from '@/lib/drizzle'
import { recalculateIdentityGrants } from '@/lib/identity/access'
import { decryptIdentityValue, encryptIdentityValue } from '@/lib/identity/encryption'
import { IdentityAccessPolicySchema } from '@/lib/identity/schemas'
import { assertIdentityStatusTransition } from '@/lib/identity/state-machine'
import 'server-only'

const ReviewDecisionSchema = z.object({
  submissionId: z.string().length(26),
  expectedRevision: z.number().int().positive(),
  decision: z.enum(['approved', 'rejected', 'needs_resubmission', 'suspended']),
  reasonCode: z.string().trim().regex(/^[A-Z][A-Z0-9_]{2,63}$/),
  internalNote: z.string().trim().max(4_000),
}).strict()

function valueContext(submissionId: string, fieldId: string) {
  return `identity-submission:${submissionId}:field:${fieldId}`
}

export const IdentityReviewRepository = {
  async getMetrics() {
    const [statusCounts, averageReview, pendingErasures, failedOutboxEvents, failedProviderEvents] = await Promise.all([
      db.select({ status: identity_submissions.status, count: count() })
        .from(identity_submissions)
        .groupBy(identity_submissions.status),
      db.select({
        minutes: sql<number>`COALESCE(AVG(EXTRACT(EPOCH FROM (${identity_submissions.decided_at} - ${identity_submissions.submitted_at})) / 60), 0)`,
      }).from(identity_submissions).where(and(
        isNotNull(identity_submissions.submitted_at),
        isNotNull(identity_submissions.decided_at),
      )),
      db.select({ count: count() }).from(identity_erasure_requests).where(inArray(identity_erasure_requests.status, ['pending', 'processing', 'needs_attention', 'blocked_legal_hold'])),
      db.select({ count: count() }).from(identity_outbox_events).where(inArray(identity_outbox_events.status, ['failed_retryable', 'failed_permanent'])),
      db.select({ count: count() }).from(identity_provider_events).where(inArray(identity_provider_events.status, ['failed_retryable', 'failed_permanent'])),
    ])
    return {
      statusCounts: statusCounts.map(item => ({ status: item.status, count: item.count })),
      averageReviewMinutes: Number(averageReview[0]?.minutes ?? 0),
      pendingErasures: pendingErasures[0]?.count ?? 0,
      failedOutboxEvents: failedOutboxEvents[0]?.count ?? 0,
      failedProviderEvents: failedProviderEvents[0]?.count ?? 0,
    }
  },

  async listQueue(limit = 50) {
    return db.select({
      id: identity_submissions.id,
      programId: identity_submissions.program_id,
      programName: identity_programs.name,
      countryCode: identity_submissions.country_code,
      status: identity_submissions.status,
      evidenceLevel: identity_submissions.evidence_level,
      attemptNumber: identity_submissions.attempt_number,
      revision: identity_submissions.revision,
      submittedAt: identity_submissions.submitted_at,
      updatedAt: identity_submissions.updated_at,
    }).from(identity_submissions).innerJoin(identity_programs, eq(identity_programs.id, identity_submissions.program_id)).where(inArray(identity_submissions.status, ['pending', 'under_review', 'needs_resubmission'])).orderBy(asc(identity_submissions.submitted_at), asc(identity_submissions.created_at)).limit(Math.min(Math.max(limit, 1), 100))
  },

  async getSubmissionDetail(submissionId: string) {
    const [submission] = await db.select({
      id: identity_submissions.id,
      userId: identity_submissions.user_id,
      programId: identity_submissions.program_id,
      programName: identity_programs.name,
      programVersionId: identity_submissions.program_version_id,
      countryCode: identity_submissions.country_code,
      status: identity_submissions.status,
      evidenceLevel: identity_submissions.evidence_level,
      attemptNumber: identity_submissions.attempt_number,
      revision: identity_submissions.revision,
      reasonCode: identity_submissions.decision_reason_code,
      submittedAt: identity_submissions.submitted_at,
      decidedAt: identity_submissions.decided_at,
      expiresAt: identity_submissions.expires_at,
    }).from(identity_submissions).innerJoin(identity_programs, eq(identity_programs.id, identity_submissions.program_id)).where(eq(identity_submissions.id, submissionId)).limit(1)
    if (!submission) {
      return null
    }

    const fields = (await db.select({
      id: identity_fields.id,
      key: identity_fields.key,
      type: identity_fields.type,
      sensitivity: identity_fields.sensitivity,
      section: identity_fields.section,
      displayOrder: identity_fields.display_order,
      config: identity_fields.config,
    }).from(identity_fields).where(eq(identity_fields.program_version_id, submission.programVersionId)).orderBy(asc(identity_fields.display_order)))
      .filter(field => field.config?.adminVisibility !== 'none')
    const fieldIds = fields.map(field => field.id)
    const [translations, values, documents, reviews] = await Promise.all([
      fieldIds.length > 0
        ? db.select().from(identity_field_translations).where(inArray(identity_field_translations.field_id, fieldIds))
        : [],
      db.select().from(identity_submission_values).where(eq(identity_submission_values.submission_id, submissionId)),
      db.select({
        id: identity_documents.id,
        fieldId: identity_documents.field_id,
        contentType: identity_documents.content_type,
        sizeBytes: identity_documents.size_bytes,
        scanStatus: identity_documents.scan_status,
        createdAt: identity_documents.created_at,
      }).from(identity_documents).where(eq(identity_documents.submission_id, submissionId)),
      db.select({
        id: identity_reviews.id,
        reviewerUserId: identity_reviews.reviewer_user_id,
        decision: identity_reviews.decision,
        reasonCode: identity_reviews.reason_code,
        createdAt: identity_reviews.created_at,
      }).from(identity_reviews).where(eq(identity_reviews.submission_id, submissionId)).orderBy(desc(identity_reviews.created_at)),
    ])
    const valueByField = new Map(values.map(value => [value.field_id, value]))

    return {
      ...submission,
      fields: fields.map((field) => {
        const value = valueByField.get(field.id)
        const translation = translations.find(candidate => candidate.field_id === field.id && candidate.locale === 'en')
          ?? translations.find(candidate => candidate.field_id === field.id)
        return {
          ...field,
          label: translation?.label ?? field.key,
          value: value
            ? decryptIdentityValue(value.encrypted_value, valueContext(submissionId, field.id))
            : null,
        }
      }),
      documents,
      reviews,
    }
  },

  async decide(actorUserId: string, rawInput: z.input<typeof ReviewDecisionSchema>) {
    const input = ReviewDecisionSchema.parse(rawInput)
    const now = new Date()
    const result = await db.transaction(async (tx) => {
      const [submission] = await tx.select().from(identity_submissions).where(and(
        eq(identity_submissions.id, input.submissionId),
        eq(identity_submissions.revision, input.expectedRevision),
      )).for('update')
      if (!submission) {
        throw new Error('IDENTITY_REVIEW_STALE')
      }
      if (submission.user_id === actorUserId) {
        throw new Error('IDENTITY_SELF_REVIEW_FORBIDDEN')
      }
      assertIdentityStatusTransition(
        submission.status as IdentitySubmissionStatus,
        input.decision,
      )
      const encryptedNote = input.internalNote
        ? encryptIdentityValue(input.internalNote, `identity-review:${submission.id}:${submission.revision + 1}`)
        : null
      const [version] = await tx.select({ accessPolicy: identity_program_versions.access_policy })
        .from(identity_program_versions)
        .where(eq(identity_program_versions.id, submission.program_version_id))
        .limit(1)
      const accessPolicy = version ? IdentityAccessPolicySchema.parse(version.accessPolicy) : null
      const expiresAt = input.decision === 'approved' && accessPolicy?.approvalValidityDays
        ? new Date(now.getTime() + accessPolicy.approvalValidityDays * 24 * 60 * 60 * 1000)
        : null

      await tx.insert(identity_reviews).values({
        submission_id: submission.id,
        reviewer_user_id: actorUserId,
        decision: input.decision,
        reason_code: input.reasonCode,
        encrypted_note: encryptedNote?.encryptedValue ?? null,
        encryption_key_id: encryptedNote?.keyId ?? null,
      })
      await tx.update(identity_submissions).set({
        status: input.decision,
        decision_reason_code: input.reasonCode,
        evidence_level: input.decision === 'approved' ? 'manual_verified' : submission.evidence_level,
        decided_at: ['approved', 'rejected', 'suspended'].includes(input.decision) ? now : null,
        expires_at: expiresAt,
        revision: submission.revision + 1,
      }).where(and(
        eq(identity_submissions.id, submission.id),
        eq(identity_submissions.revision, submission.revision),
      ))
      await tx.insert(identity_outbox_events).values({
        event_type: 'identity.submission.status_changed',
        aggregate_type: 'identity_submission',
        aggregate_id: submission.id,
        idempotency_key: `identity-review:${submission.id}:${submission.revision + 1}`,
        payload: {
          contractVersion: 1,
          submissionId: submission.id,
          userId: submission.user_id,
          status: input.decision,
          revision: submission.revision + 1,
        },
      }).onConflictDoNothing()
      await tx.insert(identity_audit_events).values({
        actor_user_id: actorUserId,
        subject_user_id: submission.user_id,
        action: 'identity.review.decided',
        target_type: 'identity_submission',
        target_id: submission.id,
        reason_code: input.reasonCode,
        result: 'success',
        metadata: { decision: input.decision, revision: submission.revision + 1, hasInternalNote: Boolean(input.internalNote) },
      })
      return { submissionId: submission.id, status: input.decision }
    })
    await recalculateIdentityGrants(result.submissionId)
    return result
  },
}
