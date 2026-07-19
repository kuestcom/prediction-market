import { and, eq } from 'drizzle-orm'
import { identity_operation_rate_limits } from '@/lib/db/schema/identity/tables'
import { db } from '@/lib/drizzle'
import 'server-only'

export async function consumeIdentityRateLimit(
  userId: string,
  operation: string,
  limit: number,
  windowMs: number,
) {
  const now = new Date()
  await db.transaction(async (tx) => {
    const [current] = await tx.select().from(identity_operation_rate_limits).where(and(
      eq(identity_operation_rate_limits.user_id, userId),
      eq(identity_operation_rate_limits.operation, operation),
    )).for('update')
    const windowExpired = !current || current.window_started_at.getTime() + windowMs <= now.getTime()
    if (current && !windowExpired && current.attempt_count >= limit) {
      throw new Error('IDENTITY_RATE_LIMITED')
    }
    if (current) {
      await tx.update(identity_operation_rate_limits).set({
        window_started_at: windowExpired ? now : current.window_started_at,
        attempt_count: windowExpired ? 1 : current.attempt_count + 1,
      }).where(eq(identity_operation_rate_limits.id, current.id))
      return
    }
    await tx.insert(identity_operation_rate_limits).values({
      user_id: userId,
      operation,
      window_started_at: now,
      attempt_count: 1,
    }).onConflictDoNothing()
  })
}
