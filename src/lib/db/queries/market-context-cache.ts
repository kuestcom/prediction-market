import type { QueryResult } from '@/types'
import { and, eq, gt, sql } from 'drizzle-orm'
import { market_context_cache } from '@/lib/db/schema/events/tables'
import { runQuery } from '@/lib/db/utils/run-query'
import { db } from '@/lib/drizzle'

interface MarketContextCacheEntry {
  context: string
  expiresAt: string
  updatedAt: string
}

export const MarketContextCacheRepository = {
  async getValidContext(
    conditionId: string,
    locale: string,
    now = new Date(),
  ): Promise<QueryResult<MarketContextCacheEntry | null>> {
    return runQuery(async () => {
      const [entry] = await db
        .select({
          context: market_context_cache.context,
          expires_at: market_context_cache.expires_at,
          updated_at: market_context_cache.updated_at,
        })
        .from(market_context_cache)
        .where(and(
          eq(market_context_cache.condition_id, conditionId),
          eq(market_context_cache.locale, locale),
          gt(market_context_cache.expires_at, now),
        ))
        .limit(1)

      if (!entry) {
        return { data: null, error: null }
      }

      return {
        data: {
          context: entry.context,
          expiresAt: entry.expires_at.toISOString(),
          updatedAt: entry.updated_at.toISOString(),
        },
        error: null,
      }
    })
  },

  async upsertContext(
    conditionId: string,
    locale: string,
    context: string,
    expiresAt: Date,
  ): Promise<QueryResult<MarketContextCacheEntry>> {
    return runQuery(async () => {
      const [entry] = await db
        .insert(market_context_cache)
        .values({
          condition_id: conditionId,
          locale,
          context,
          expires_at: expiresAt,
        })
        .onConflictDoUpdate({
          target: [market_context_cache.condition_id, market_context_cache.locale],
          set: {
            context: sql`EXCLUDED.context`,
            expires_at: sql`EXCLUDED.expires_at`,
          },
        })
        .returning({
          context: market_context_cache.context,
          expires_at: market_context_cache.expires_at,
          updated_at: market_context_cache.updated_at,
        })

      if (!entry) {
        return { data: null, error: 'Failed to persist market context cache.' }
      }

      return {
        data: {
          context: entry.context,
          expiresAt: entry.expires_at.toISOString(),
          updatedAt: entry.updated_at.toISOString(),
        },
        error: null,
      }
    })
  },
}
