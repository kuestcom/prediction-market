import type { SumsubStatus } from '@/lib/sumsub/types'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { sumsub_access_token_rate_limits, sumsub_applicants, sumsub_webhook_events } from '@/lib/db/schema/sumsub/tables'
import { db } from '@/lib/drizzle'

export interface SumsubApplicantUpdate {
  applicantId: string
  externalUserId: string
  levelName: string
  status: SumsubStatus
  reviewStatus?: string | null
  reviewAnswer?: string | null
  eventCreatedAt?: Date | null
}

function buildSumsubExternalUserId(userId: string) {
  return `kuest:${userId}`
}

export const SumsubRepository = {
  async ensureUser(userId: string, levelName: string) {
    const externalUserId = buildSumsubExternalUserId(userId)
    const [row] = await db.insert(sumsub_applicants).values({
      user_id: userId,
      external_user_id: externalUserId,
      level_name: levelName,
    }).onConflictDoUpdate({
      target: sumsub_applicants.user_id,
      set: {
        level_name: levelName,
        status: sql`CASE WHEN ${sumsub_applicants.level_name} = ${levelName} THEN ${sumsub_applicants.status} ELSE 'not_started' END`,
        review_status: sql`CASE WHEN ${sumsub_applicants.level_name} = ${levelName} THEN ${sumsub_applicants.review_status} ELSE NULL END`,
        review_answer: sql`CASE WHEN ${sumsub_applicants.level_name} = ${levelName} THEN ${sumsub_applicants.review_answer} ELSE NULL END`,
        approved_at: sql`CASE WHEN ${sumsub_applicants.level_name} = ${levelName} THEN ${sumsub_applicants.approved_at} ELSE NULL END`,
        updated_at: new Date(),
      },
    }).returning()
    return row!
  },

  async attachApplicant(userId: string, levelName: string, applicantId: string) {
    const [row] = await db.update(sumsub_applicants).set({
      applicant_id: applicantId,
      level_name: levelName,
      updated_at: new Date(),
      last_synced_at: new Date(),
    }).where(and(eq(sumsub_applicants.user_id, userId), eq(sumsub_applicants.level_name, levelName))).returning()
    return row ?? null
  },

  async syncApplicantStatus(userId: string, levelName: string, status: SumsubStatus, reviewStatus?: string | null, reviewAnswer?: string | null) {
    await db.update(sumsub_applicants).set({
      status,
      review_status: reviewStatus,
      review_answer: reviewAnswer,
      last_synced_at: new Date(),
      approved_at: status === 'approved'
        ? sql`CASE WHEN ${sumsub_applicants.status} = 'approved' THEN COALESCE(${sumsub_applicants.approved_at}, NOW()) ELSE NOW() END`
        : null,
      updated_at: new Date(),
    }).where(and(eq(sumsub_applicants.user_id, userId), eq(sumsub_applicants.level_name, levelName)))
  },

  async getForUser(userId: string) {
    const [row] = await db.select().from(sumsub_applicants).where(eq(sumsub_applicants.user_id, userId)).limit(1)
    return row ?? null
  },

  async getStatusesForUsers(userIds: string[], levelName: string) {
    if (userIds.length === 0) {
      return new Map<string, SumsubStatus>()
    }
    const rows = await db.select({
      userId: sumsub_applicants.user_id,
      status: sumsub_applicants.status,
    }).from(sumsub_applicants).where(and(
      inArray(sumsub_applicants.user_id, userIds),
      eq(sumsub_applicants.level_name, levelName),
    ))
    return new Map(rows.map(row => [row.userId, row.status as SumsubStatus]))
  },

  async consumeRateLimit(userId: string, scope: 'access_token' | 'status' | 'test_connection', limit: number, windowSeconds = 60) {
    const [row] = await db.insert(sumsub_access_token_rate_limits).values({
      user_id: userId,
      scope,
      request_count: 1,
    }).onConflictDoUpdate({
      target: [sumsub_access_token_rate_limits.user_id, sumsub_access_token_rate_limits.scope],
      set: {
        window_started_at: sql`CASE WHEN ${sumsub_access_token_rate_limits.window_started_at} < NOW() - (${windowSeconds} * INTERVAL '1 second') THEN NOW() ELSE ${sumsub_access_token_rate_limits.window_started_at} END`,
        request_count: sql`CASE WHEN ${sumsub_access_token_rate_limits.window_started_at} < NOW() - (${windowSeconds} * INTERVAL '1 second') THEN 1 ELSE ${sumsub_access_token_rate_limits.request_count} + 1 END`,
        updated_at: new Date(),
      },
    }).returning({ requestCount: sumsub_access_token_rate_limits.request_count })
    return (row?.requestCount ?? limit + 1) <= limit
  },

  async consumeAccessTokenRateLimit(userId: string) {
    return this.consumeRateLimit(userId, 'access_token', 8)
  },

  async consumeStatusRateLimit(userId: string) {
    return this.consumeRateLimit(userId, 'status', 120)
  },

  async consumeTestConnectionRateLimit(userId: string) {
    return this.consumeRateLimit(userId, 'test_connection', 5)
  },

  async processWebhook(fingerprint: string, update: SumsubApplicantUpdate, eventType: string) {
    return db.transaction(async (tx) => {
      const inserted = await tx.insert(sumsub_webhook_events).values({
        fingerprint,
        applicant_id: update.applicantId,
        event_type: eventType,
        event_created_at: update.eventCreatedAt,
      }).onConflictDoNothing().returning({ fingerprint: sumsub_webhook_events.fingerprint })
      if (inserted.length === 0) {
        return { duplicate: true, updated: false }
      }

      const [associated] = await tx.select({
        lastEventCreatedAt: sumsub_applicants.last_event_created_at,
      }).from(sumsub_applicants).where(and(
        eq(sumsub_applicants.external_user_id, update.externalUserId),
        eq(sumsub_applicants.applicant_id, update.applicantId),
        eq(sumsub_applicants.level_name, update.levelName),
      )).limit(1)
      if (!associated) {
        throw new Error('Sumsub webhook applicant association mismatch.')
      }
      if (associated.lastEventCreatedAt && update.eventCreatedAt && associated.lastEventCreatedAt >= update.eventCreatedAt) {
        return { duplicate: false, updated: false }
      }

      const rows = await tx.update(sumsub_applicants).set({
        status: update.status,
        review_status: update.reviewStatus,
        review_answer: update.reviewAnswer,
        last_event_created_at: update.eventCreatedAt,
        last_synced_at: new Date(),
        approved_at: update.status === 'approved'
          ? sql`CASE WHEN ${sumsub_applicants.status} = 'approved' THEN COALESCE(${sumsub_applicants.approved_at}, NOW()) ELSE NOW() END`
          : null,
        updated_at: new Date(),
      }).where(and(
        eq(sumsub_applicants.external_user_id, update.externalUserId),
        eq(sumsub_applicants.applicant_id, update.applicantId),
        eq(sumsub_applicants.level_name, update.levelName),
        sql`(${sumsub_applicants.last_event_created_at} IS NULL OR ${sumsub_applicants.last_event_created_at} < ${update.eventCreatedAt ?? new Date(0)})`,
      )).returning({ userId: sumsub_applicants.user_id })

      if (rows.length === 0) {
        throw new Error('Sumsub webhook update failed.')
      }
      return { duplicate: false, updated: true }
    })
  },
}
