import { sql } from 'drizzle-orm'
import { db } from '@/lib/drizzle'
import 'server-only'

export async function consumeIdentityRateLimit(
  userId: string,
  operation: string,
  limit: number,
  windowMs: number,
) {
  if (!Number.isSafeInteger(limit) || limit < 1 || !Number.isSafeInteger(windowMs) || windowMs < 1) {
    throw new Error('Identity rate-limit configuration is invalid.')
  }

  const rows = await db.execute(sql`
    INSERT INTO identity_operation_rate_limits (
      user_id,
      operation,
      window_started_at,
      attempt_count,
      updated_at
    )
    VALUES (${userId}, ${operation}, statement_timestamp(), 1, statement_timestamp())
    ON CONFLICT (user_id, operation) DO UPDATE
    SET
      window_started_at = CASE
        WHEN identity_operation_rate_limits.window_started_at
          <= statement_timestamp() - ${windowMs} * INTERVAL '1 millisecond'
          THEN statement_timestamp()
        ELSE identity_operation_rate_limits.window_started_at
      END,
      attempt_count = CASE
        WHEN identity_operation_rate_limits.window_started_at
          <= statement_timestamp() - ${windowMs} * INTERVAL '1 millisecond'
          THEN 1
        ELSE identity_operation_rate_limits.attempt_count + 1
      END,
      updated_at = statement_timestamp()
    WHERE identity_operation_rate_limits.window_started_at
        <= statement_timestamp() - ${windowMs} * INTERVAL '1 millisecond'
      OR identity_operation_rate_limits.attempt_count < ${limit}
    RETURNING attempt_count
  `) as Array<{ attempt_count?: unknown }>

  if (!rows[0]) {
    throw new Error('IDENTITY_RATE_LIMITED')
  }
}
