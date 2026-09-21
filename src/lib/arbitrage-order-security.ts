import { and, eq, isNotNull } from 'drizzle-orm'

import { isArbitrageEnabled } from '@/lib/arbitrage-settings'
import { SettingsRepository } from '@/lib/db/queries/settings'
import { events as eventsTable, markets as marketsTable, outcomes as outcomesTable } from '@/lib/db/schema'
import { db } from '@/lib/drizzle'
import { consumeUserRateLimit, getUserRateLimitStatus } from '@/lib/user-rate-limit'

const ORDER_RATE_LIMIT = 12
const ORDER_RATE_WINDOW_SECONDS = 60

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
    .where(
      and(
        eq(outcomesTable.polymarket_token_id, tokenId),
        isNotNull(marketsTable.polymarket_condition_id),
        eq(marketsTable.is_active, true),
        eq(marketsTable.is_resolved, false),
        eq(eventsTable.is_polymarket_mirror, true),
      ),
    )
    .limit(1)

  return rows.length > 0
}

export async function consumeArbitrageOrderQuota(userId: string) {
  return consumeUserRateLimit({
    userId,
    table: 'arbitrage_order_rate_limits',
    maxRequests: ORDER_RATE_LIMIT,
    windowSeconds: ORDER_RATE_WINDOW_SECONDS,
    inclusive: true,
  })
}

export async function getArbitrageOrderQuotaStatus(userId: string) {
  return getUserRateLimitStatus({
    userId,
    table: 'arbitrage_order_rate_limits',
    maxRequests: ORDER_RATE_LIMIT,
    windowSeconds: ORDER_RATE_WINDOW_SECONDS,
  })
}
