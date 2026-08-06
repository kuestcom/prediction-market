import { and, eq, inArray, sql } from 'drizzle-orm'

import { conditions, events, markets, outcomes } from '@/lib/db/schema/events/tables'
import { db } from '@/lib/drizzle'
import { getPublicAssetUrl } from '@/lib/storage'

export interface ResolutionReportMarketContext {
  conditionId: string
  marketTitle: string
  marketIconUrl: string
  noLabel: string
  yesLabel: string
}

export interface ResolutionRewardMarketDisplayContext {
  conditionId: string
  title: string
  marketSlug: string
  icon: string
  eventSlug: string
  eventTitle: string
  eventIcon: string
  eventSeriesSlug: string | null
}

export interface ResolutionRewardMarketConfiguration {
  resolver: string | null
  oracle: string | null
  metadata: string | null
}

function normalizeConditionIds(conditionIds: string[]) {
  return Array.from(new Set(conditionIds.map((conditionId) => conditionId.trim().toLowerCase()).filter(Boolean)))
}

export const ResolutionReportContextRepository = {
  async getMarketConfiguration(conditionId: string): Promise<ResolutionRewardMarketConfiguration | null> {
    const normalizedConditionIds = normalizeConditionIds([conditionId])
    if (normalizedConditionIds.length === 0) {
      return null
    }
    const rows = await db
      .select({ resolver: markets.resolver, oracle: conditions.oracle, metadata: markets.metadata })
      .from(markets)
      .innerJoin(conditions, eq(conditions.id, markets.condition_id))
      .where(inArray(sql<string>`LOWER(${markets.condition_id})`, normalizedConditionIds))
      .limit(1)
    return rows[0] ?? null
  },

  async countActiveReports(reportCountsByCondition: ReadonlyMap<string, number>): Promise<number> {
    const conditionIds = normalizeConditionIds([...reportCountsByCondition.keys()])
    if (conditionIds.length === 0) {
      return 0
    }

    const rows = await db
      .select({ conditionId: markets.condition_id })
      .from(markets)
      .innerJoin(conditions, eq(conditions.id, markets.condition_id))
      .innerJoin(events, eq(events.id, markets.event_id))
      .where(
        and(
          inArray(sql<string>`LOWER(${markets.condition_id})`, conditionIds),
          eq(events.status, 'active'),
          eq(markets.is_resolved, false),
          sql`COALESCE(${conditions.resolved}, false) = false`,
        ),
      )

    return rows.reduce((total, row) => total + (reportCountsByCondition.get(row.conditionId.toLowerCase()) ?? 0), 0)
  },

  async getMarketsByConditionIds(conditionIds: string[]): Promise<ResolutionRewardMarketDisplayContext[]> {
    const normalizedConditionIds = normalizeConditionIds(conditionIds)
    if (normalizedConditionIds.length === 0) {
      return []
    }

    const rows = await db
      .select({
        conditionId: markets.condition_id,
        marketTitle: markets.title,
        marketShortTitle: markets.short_title,
        marketSlug: markets.slug,
        marketIconUrl: markets.icon_url,
        eventSlug: events.slug,
        eventTitle: events.title,
        eventIconUrl: events.icon_url,
        eventSeriesSlug: events.series_slug,
      })
      .from(markets)
      .innerJoin(events, eq(events.id, markets.event_id))
      .where(inArray(sql<string>`LOWER(${markets.condition_id})`, normalizedConditionIds))

    return rows.map((row) => ({
      conditionId: row.conditionId.toLowerCase(),
      title: row.marketShortTitle || row.marketTitle,
      marketSlug: row.marketSlug,
      icon: getPublicAssetUrl(row.marketIconUrl || row.eventIconUrl) ?? '',
      eventSlug: row.eventSlug,
      eventTitle: row.eventTitle,
      eventIcon: getPublicAssetUrl(row.eventIconUrl) ?? '',
      eventSeriesSlug: row.eventSeriesSlug,
    }))
  },

  async getEventMarkets(eventId: string): Promise<ResolutionReportMarketContext[]> {
    const rows = await db
      .select({
        conditionId: markets.condition_id,
        marketTitle: markets.title,
        marketShortTitle: markets.short_title,
        marketIconUrl: markets.icon_url,
        outcomeIndex: outcomes.outcome_index,
        outcomeText: outcomes.outcome_text,
      })
      .from(markets)
      .leftJoin(outcomes, eq(outcomes.condition_id, markets.condition_id))
      .where(eq(markets.event_id, eventId))

    const contextByCondition = new Map<string, ResolutionReportMarketContext>()
    for (const row of rows) {
      const conditionId = row.conditionId.toLowerCase()
      const current = contextByCondition.get(conditionId) ?? {
        conditionId,
        marketTitle: row.marketShortTitle || row.marketTitle,
        marketIconUrl: getPublicAssetUrl(row.marketIconUrl) ?? '',
        noLabel: 'NO',
        yesLabel: 'YES',
      }
      if (row.outcomeIndex === 0 && row.outcomeText) {
        current.yesLabel = row.outcomeText
      } else if (row.outcomeIndex === 1 && row.outcomeText) {
        current.noLabel = row.outcomeText
      }
      contextByCondition.set(conditionId, current)
    }

    return [...contextByCondition.values()]
  },
}
