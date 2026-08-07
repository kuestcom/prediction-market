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
  noLabel: string
  yesLabel: string
}

export interface ResolutionRewardMarketConfiguration {
  resolver: string | null
  oracle: string | null
  metadata: string | null
}

function normalizeConditionIds(conditionIds: string[]) {
  return Array.from(new Set(conditionIds.map((conditionId) => conditionId.trim().toLowerCase()).filter(Boolean)))
}

function applyOutcomeLabel<T extends { noLabel: string; yesLabel: string }>(
  context: T,
  outcomeIndex: number | null,
  outcomeText: string | null,
) {
  if (outcomeIndex === 0 && outcomeText) {
    context.yesLabel = outcomeText
  } else if (outcomeIndex === 1 && outcomeText) {
    context.noLabel = outcomeText
  }
  return context
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
        outcomeIndex: outcomes.outcome_index,
        outcomeText: outcomes.outcome_text,
      })
      .from(markets)
      .innerJoin(events, eq(events.id, markets.event_id))
      .leftJoin(outcomes, eq(outcomes.condition_id, markets.condition_id))
      .where(inArray(sql<string>`LOWER(${markets.condition_id})`, normalizedConditionIds))

    const contextsByCondition = new Map<string, ResolutionRewardMarketDisplayContext>()
    for (const row of rows) {
      const conditionId = row.conditionId.toLowerCase()
      const context = contextsByCondition.get(conditionId) ?? {
        conditionId,
        title: row.marketShortTitle || row.marketTitle,
        marketSlug: row.marketSlug,
        icon: getPublicAssetUrl(row.marketIconUrl || row.eventIconUrl) ?? '',
        eventSlug: row.eventSlug,
        eventTitle: row.eventTitle,
        eventIcon: getPublicAssetUrl(row.eventIconUrl) ?? '',
        eventSeriesSlug: row.eventSeriesSlug,
        noLabel: 'NO',
        yesLabel: 'YES',
      }
      contextsByCondition.set(conditionId, applyOutcomeLabel(context, row.outcomeIndex, row.outcomeText))
    }

    return [...contextsByCondition.values()]
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
      contextByCondition.set(conditionId, applyOutcomeLabel(current, row.outcomeIndex, row.outcomeText))
    }

    return [...contextByCondition.values()]
  },
}
