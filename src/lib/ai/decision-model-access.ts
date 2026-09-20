import { eq, sql } from 'drizzle-orm'

import { orders } from '@/lib/db/schema/orders/tables'
import { db } from '@/lib/drizzle'

const DECISION_MODEL_SEARCH_RATE_LIMIT = 20
const DECISION_MODEL_SEARCH_RATE_WINDOW_SECONDS = 60 * 60

export async function hasTradingActivity(userId: string) {
  const rows = await db.select({ id: orders.id }).from(orders).where(eq(orders.user_id, userId)).limit(1)

  return rows.length > 0
}

export async function consumeDecisionModelSearchQuota(userId: string) {
  const rows = (await db.execute(sql`
    INSERT INTO decision_model_search_rate_limits (
      user_id,
      window_started_at,
      request_count,
      updated_at
    )
    VALUES (${userId}, statement_timestamp(), 1, statement_timestamp())
    ON CONFLICT (user_id) DO UPDATE
    SET
      window_started_at = CASE
        WHEN decision_model_search_rate_limits.window_started_at
          <= statement_timestamp() - ${DECISION_MODEL_SEARCH_RATE_WINDOW_SECONDS} * INTERVAL '1 second'
          THEN statement_timestamp()
        ELSE decision_model_search_rate_limits.window_started_at
      END,
      request_count = CASE
        WHEN decision_model_search_rate_limits.window_started_at
          <= statement_timestamp() - ${DECISION_MODEL_SEARCH_RATE_WINDOW_SECONDS} * INTERVAL '1 second'
          THEN 1
        ELSE decision_model_search_rate_limits.request_count + 1
      END,
      updated_at = statement_timestamp()
    RETURNING
      request_count,
      GREATEST(
        1,
        CEIL(EXTRACT(EPOCH FROM (
          window_started_at + ${DECISION_MODEL_SEARCH_RATE_WINDOW_SECONDS} * INTERVAL '1 second'
          - statement_timestamp()
        )))
      )::integer AS retry_after_seconds
  `)) as Array<{ request_count?: unknown; retry_after_seconds?: unknown }>

  const requestCount = Number(rows[0]?.request_count)
  const retryAfterSeconds = Number(rows[0]?.retry_after_seconds)

  return {
    allowed: Number.isInteger(requestCount) && requestCount <= DECISION_MODEL_SEARCH_RATE_LIMIT,
    retryAfterSeconds: Number.isInteger(retryAfterSeconds)
      ? Math.max(1, retryAfterSeconds)
      : DECISION_MODEL_SEARCH_RATE_WINDOW_SECONDS,
  }
}
