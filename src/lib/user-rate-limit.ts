import { sql } from 'drizzle-orm'

import { db } from '@/lib/drizzle'

type UserRateLimitTable = 'arbitrage_order_rate_limits' | 'decision_model_search_rate_limits'

export interface UserRateLimitResult {
  allowed: boolean
  retryAfterSeconds: number
}

interface UserRateLimitOptions {
  userId: string
  table: UserRateLimitTable
  maxRequests: number
  windowSeconds: number
  inclusive?: boolean
}

function buildQuotaResult(
  requestCountValue: unknown,
  retryAfterValue: unknown,
  {
    maxRequests,
    windowSeconds,
    inclusive = false,
  }: Pick<UserRateLimitOptions, 'maxRequests' | 'windowSeconds'> & {
    inclusive?: boolean
  },
): UserRateLimitResult {
  const requestCount = Number(requestCountValue)
  const retryAfterSeconds = Number(retryAfterValue)

  return {
    allowed: Number.isInteger(requestCount) && (inclusive ? requestCount <= maxRequests : requestCount < maxRequests),
    retryAfterSeconds: Number.isInteger(retryAfterSeconds) ? Math.max(1, retryAfterSeconds) : windowSeconds,
  }
}

export async function consumeUserRateLimit(options: UserRateLimitOptions): Promise<UserRateLimitResult> {
  const table = sql.identifier(options.table)
  const rows = (await db.execute(sql`
    INSERT INTO ${table} (
      user_id,
      window_started_at,
      request_count,
      updated_at
    )
    VALUES (${options.userId}, statement_timestamp(), 1, statement_timestamp())
    ON CONFLICT (user_id) DO UPDATE
    SET
      window_started_at = CASE
        WHEN ${table}.window_started_at
          <= statement_timestamp() - ${options.windowSeconds} * INTERVAL '1 second'
          THEN statement_timestamp()
        ELSE ${table}.window_started_at
      END,
      request_count = CASE
        WHEN ${table}.window_started_at
          <= statement_timestamp() - ${options.windowSeconds} * INTERVAL '1 second'
          THEN 1
        ELSE ${table}.request_count + 1
      END,
      updated_at = statement_timestamp()
    RETURNING
      request_count,
      GREATEST(
        1,
        CEIL(EXTRACT(EPOCH FROM (
          window_started_at + ${options.windowSeconds} * INTERVAL '1 second'
          - statement_timestamp()
        )))
      )::integer AS retry_after_seconds
  `)) as Array<{ request_count?: unknown; retry_after_seconds?: unknown }>

  return buildQuotaResult(rows[0]?.request_count, rows[0]?.retry_after_seconds, options)
}

export async function getUserRateLimitStatus({
  userId,
  table: tableName,
  maxRequests,
  windowSeconds,
}: Omit<UserRateLimitOptions, 'inclusive'>): Promise<UserRateLimitResult> {
  const table = sql.identifier(tableName)
  const rows = (await db.execute(sql`
    SELECT
      request_count,
      GREATEST(
        1,
        CEIL(EXTRACT(EPOCH FROM (
          window_started_at + ${windowSeconds} * INTERVAL '1 second'
          - statement_timestamp()
        )))
      )::integer AS retry_after_seconds
    FROM ${table}
    WHERE user_id = ${userId}
      AND window_started_at
        > statement_timestamp() - ${windowSeconds} * INTERVAL '1 second'
  `)) as Array<{ request_count?: unknown; retry_after_seconds?: unknown }>

  if (!rows[0]) {
    return { allowed: true, retryAfterSeconds: windowSeconds }
  }

  return buildQuotaResult(rows[0].request_count, rows[0].retry_after_seconds, {
    maxRequests,
    windowSeconds,
  })
}
