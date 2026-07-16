import { and, eq, isNotNull, sql } from 'drizzle-orm'
import { isArbitrageEnabled } from '@/lib/arbitrage-settings'
import { SettingsRepository } from '@/lib/db/queries/settings'
import {
  events as eventsTable,
  markets as marketsTable,
  outcomes as outcomesTable,
} from '@/lib/db/schema'
import { db } from '@/lib/drizzle'

const ORDER_RATE_LIMIT = 12
const ORDER_RATE_WINDOW_SECONDS = 60

function buildQuotaResult(
  requestCountValue: unknown,
  retryAfterValue: unknown,
  { inclusive = false }: { inclusive?: boolean } = {},
) {
  const requestCount = Number(requestCountValue)
  const retryAfterSeconds = Number(retryAfterValue)

  return {
    allowed: Number.isInteger(requestCount)
      && (inclusive ? requestCount <= ORDER_RATE_LIMIT : requestCount < ORDER_RATE_LIMIT),
    retryAfterSeconds: Number.isInteger(retryAfterSeconds)
      ? Math.max(1, retryAfterSeconds)
      : ORDER_RATE_WINDOW_SECONDS,
  }
}

export async function isArbitrageOrderSubmissionEnabled() {
  const { data: settings, error } = await SettingsRepository.getSettings()
  return !error && isArbitrageEnabled(settings)
}

export async function isActivePolymarketMirrorToken(tokenId: string) {
  const rows = await db
    .select({ tokenId: outcomesTable.polymarket_token_id })
    .from(outcomesTable)
    .innerJoin(marketsTable, eq(marketsTable.condition_id, outcomesTable.condition_id))
    .innerJoin(eventsTable, eq(eventsTable.id, marketsTable.event_id))
    .where(and(
      eq(outcomesTable.polymarket_token_id, tokenId),
      isNotNull(marketsTable.polymarket_condition_id),
      eq(marketsTable.is_active, true),
      eq(marketsTable.is_resolved, false),
      eq(eventsTable.is_polymarket_mirror, true),
    ))
    .limit(1)

  return rows.length > 0
}

export async function consumeArbitrageOrderQuota(userId: string) {
  const rows = await db.execute(sql`
    INSERT INTO arbitrage_order_rate_limits (
      user_id,
      window_started_at,
      request_count,
      updated_at
    )
    VALUES (${userId}, statement_timestamp(), 1, statement_timestamp())
    ON CONFLICT (user_id) DO UPDATE
    SET
      window_started_at = CASE
        WHEN arbitrage_order_rate_limits.window_started_at
          <= statement_timestamp() - ${ORDER_RATE_WINDOW_SECONDS} * INTERVAL '1 second'
          THEN statement_timestamp()
        ELSE arbitrage_order_rate_limits.window_started_at
      END,
      request_count = CASE
        WHEN arbitrage_order_rate_limits.window_started_at
          <= statement_timestamp() - ${ORDER_RATE_WINDOW_SECONDS} * INTERVAL '1 second'
          THEN 1
        ELSE arbitrage_order_rate_limits.request_count + 1
      END,
      updated_at = statement_timestamp()
    RETURNING
      request_count,
      GREATEST(
        1,
        CEIL(EXTRACT(EPOCH FROM (
          window_started_at + ${ORDER_RATE_WINDOW_SECONDS} * INTERVAL '1 second'
          - statement_timestamp()
        )))
      )::integer AS retry_after_seconds
  `) as Array<{ request_count?: unknown, retry_after_seconds?: unknown }>

  return buildQuotaResult(
    rows[0]?.request_count,
    rows[0]?.retry_after_seconds,
    { inclusive: true },
  )
}

export async function getArbitrageOrderQuotaStatus(userId: string) {
  const rows = await db.execute(sql`
    SELECT
      request_count,
      GREATEST(
        1,
        CEIL(EXTRACT(EPOCH FROM (
          window_started_at + ${ORDER_RATE_WINDOW_SECONDS} * INTERVAL '1 second'
          - statement_timestamp()
        )))
      )::integer AS retry_after_seconds
    FROM arbitrage_order_rate_limits
    WHERE user_id = ${userId}
      AND window_started_at
        > statement_timestamp() - ${ORDER_RATE_WINDOW_SECONDS} * INTERVAL '1 second'
  `) as Array<{ request_count?: unknown, retry_after_seconds?: unknown }>

  if (!rows[0]) {
    return { allowed: true, retryAfterSeconds: ORDER_RATE_WINDOW_SECONDS }
  }

  return buildQuotaResult(rows[0].request_count, rows[0].retry_after_seconds)
}
