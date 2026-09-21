import { eq } from 'drizzle-orm'

import { orders } from '@/lib/db/schema/orders/tables'
import { db } from '@/lib/drizzle'
import { consumeUserRateLimit } from '@/lib/user-rate-limit'

const DECISION_MODEL_SEARCH_RATE_LIMIT = 20
const DECISION_MODEL_SEARCH_RATE_WINDOW_SECONDS = 60 * 60

export async function hasTradingActivity(userId: string) {
  const rows = await db.select({ id: orders.id }).from(orders).where(eq(orders.user_id, userId)).limit(1)

  return rows.length > 0
}

export async function consumeDecisionModelSearchQuota(userId: string) {
  return consumeUserRateLimit({
    userId,
    table: 'decision_model_search_rate_limits',
    maxRequests: DECISION_MODEL_SEARCH_RATE_LIMIT,
    windowSeconds: DECISION_MODEL_SEARCH_RATE_WINDOW_SECONDS,
    inclusive: true,
  })
}
