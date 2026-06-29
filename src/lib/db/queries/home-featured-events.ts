import type {
  HomeFeaturedContextItem,
  HomeFeaturedContextMode,
  HomeFeaturedEventAdminItem,
  HomeFeaturedSource,
  HomeFeaturedTargetType,
  QueryResult,
} from '@/types'
import { and, asc, desc, eq, exists, gt, inArray, isNull, lte, or, sql } from 'drizzle-orm'
import { cacheTag, revalidateTag } from 'next/cache'
import { cacheTags } from '@/lib/cache-tags'
import {
  event_sports,
  events,
  home_featured_event_context_items,
  home_featured_events,
  markets,
} from '@/lib/db/schema'
import { runQuery } from '@/lib/db/utils/run-query'
import { db } from '@/lib/drizzle'
import { getPublicAssetUrl } from '@/lib/storage'

export interface HomeFeaturedResolvedTarget {
  featuredId: string
  targetType: HomeFeaturedTargetType
  source: HomeFeaturedSource
  rank: number
  contextMode: HomeFeaturedContextMode
  eventId: string
  eventSlug: string
  eventTitle: string
  seriesSlug: string | null
}

export interface UpsertHomeFeaturedContextItemInput {
  featuredEventId: string
  eventId: string
  locale: string
  itemType: 'news' | 'comment'
  source: string
  title: string
  url?: string | null
  publishedAt?: Date | null
  relevanceScore?: number | null
  expiresAt: Date
}

export interface ReplaceHomeFeaturedEventsInput {
  targetType: HomeFeaturedTargetType
  eventId: string | null
  seriesSlug: string | null
  enabled: boolean
  rank: number
  source: HomeFeaturedSource
  startsAt: Date | null
  endsAt: Date | null
  contextMode: HomeFeaturedContextMode
  autoRolloverEnabled: boolean
}

const VALID_CONTEXT_MODES: HomeFeaturedContextMode[] = ['auto', 'news', 'comments', 'hidden']
const VALID_TARGET_TYPES: HomeFeaturedTargetType[] = ['event', 'series']
const VALID_SOURCES: HomeFeaturedSource[] = ['manual', 'ai']

function normalizeContextMode(value: string | null | undefined): HomeFeaturedContextMode {
  return VALID_CONTEXT_MODES.includes(value as HomeFeaturedContextMode)
    ? value as HomeFeaturedContextMode
    : 'auto'
}

function normalizeTargetType(value: string | null | undefined): HomeFeaturedTargetType {
  return VALID_TARGET_TYPES.includes(value as HomeFeaturedTargetType)
    ? value as HomeFeaturedTargetType
    : 'event'
}

function normalizeSource(value: string | null | undefined): HomeFeaturedSource {
  return VALID_SOURCES.includes(value as HomeFeaturedSource)
    ? value as HomeFeaturedSource
    : 'manual'
}

function toIsoString(value: Date | null | undefined) {
  return value instanceof Date ? value.toISOString() : null
}

function toOptionalNumber(value: unknown) {
  if (value == null) {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeReplaceItem(item: ReplaceHomeFeaturedEventsInput, index: number) {
  const requestedTargetType = normalizeTargetType(item.targetType)
  const eventId = item.eventId?.trim() || null
  const seriesSlug = item.seriesSlug?.trim() || null
  const targetType: HomeFeaturedTargetType | null = requestedTargetType === 'series'
    ? (seriesSlug ? 'series' : eventId ? 'event' : null)
    : (eventId ? 'event' : seriesSlug ? 'series' : null)

  if (!targetType) {
    return null
  }

  return {
    target_type: targetType,
    event_id: eventId,
    series_slug: targetType === 'series' ? seriesSlug : null,
    enabled: item.enabled,
    rank: Number.isFinite(item.rank) ? item.rank : index,
    source: normalizeSource(item.source),
    starts_at: item.startsAt,
    ends_at: item.endsAt,
    context_mode: normalizeContextMode(item.contextMode),
    auto_rollover_enabled: targetType === 'series' ? item.autoRolloverEnabled : false,
  }
}

function hasActiveMarketCondition() {
  return exists(
    db
      .select({ condition_id: markets.condition_id })
      .from(markets)
      .where(and(
        eq(markets.event_id, events.id),
        eq(markets.is_active, true),
        eq(markets.is_resolved, false),
      )),
  )
}

async function resolveSeriesTarget(seriesSlug: string) {
  const normalizedSeriesSlug = seriesSlug.trim()
  if (!normalizedSeriesSlug) {
    return null
  }

  const rows = await db
    .select({
      id: events.id,
      slug: events.slug,
      title: events.title,
      series_slug: events.series_slug,
      sports_live: event_sports.sports_live,
      end_date: events.end_date,
      created_at: events.created_at,
    })
    .from(events)
    .leftJoin(event_sports, eq(event_sports.event_id, events.id))
    .where(and(
      eq(events.series_slug, normalizedSeriesSlug),
      eq(events.status, 'active'),
      eq(events.is_hidden, false),
      hasActiveMarketCondition(),
    ))
    .orderBy(
      desc(sql<number>`CASE WHEN ${event_sports.sports_live} IS TRUE THEN 1 ELSE 0 END`),
      asc(sql<number>`CASE WHEN ${events.end_date} IS NULL THEN 1 ELSE 0 END`),
      asc(events.end_date),
      desc(events.created_at),
      desc(events.id),
    )
    .limit(1)

  return rows[0] ?? null
}

async function resolveEventTarget(eventId: string | null) {
  if (!eventId?.trim()) {
    return null
  }

  const rows = await db
    .select({
      id: events.id,
      slug: events.slug,
      title: events.title,
      series_slug: events.series_slug,
    })
    .from(events)
    .where(and(
      eq(events.id, eventId),
      eq(events.status, 'active'),
      eq(events.is_hidden, false),
      hasActiveMarketCondition(),
    ))
    .limit(1)

  return rows[0] ?? null
}

function mapContextRow(row: typeof home_featured_event_context_items.$inferSelect): HomeFeaturedContextItem {
  return {
    id: row.id,
    type: row.item_type === 'comment' ? 'comment' : 'news',
    source: row.source,
    title: row.title,
    avatarUrl: null,
    url: row.url ?? null,
    publishedAt: toIsoString(row.published_at),
    selectedAt: row.selected_at.toISOString(),
    expiresAt: row.expires_at.toISOString(),
    relevanceScore: toOptionalNumber(row.relevance_score),
  }
}

export const HomeFeaturedEventsRepository = {
  async listAdminFeaturedEvents(): Promise<QueryResult<HomeFeaturedEventAdminItem[]>> {
    return runQuery(async () => {
      const rows = await db
        .select({
          id: home_featured_events.id,
          target_type: home_featured_events.target_type,
          event_id: home_featured_events.event_id,
          series_slug: home_featured_events.series_slug,
          enabled: home_featured_events.enabled,
          rank: home_featured_events.rank,
          source: home_featured_events.source,
          starts_at: home_featured_events.starts_at,
          ends_at: home_featured_events.ends_at,
          context_mode: home_featured_events.context_mode,
          auto_rollover_enabled: home_featured_events.auto_rollover_enabled,
          event_title: events.title,
          event_slug: events.slug,
          event_icon_url: events.icon_url,
        })
        .from(home_featured_events)
        .leftJoin(events, eq(events.id, home_featured_events.event_id))
        .orderBy(asc(home_featured_events.rank), asc(home_featured_events.created_at))

      const items: HomeFeaturedEventAdminItem[] = rows.map(row => ({
        id: row.id,
        targetType: normalizeTargetType(row.target_type),
        eventId: row.event_id ?? null,
        seriesSlug: row.series_slug ?? null,
        title: row.event_title ?? row.series_slug ?? 'Featured market',
        slug: row.event_slug ?? null,
        iconUrl: getPublicAssetUrl(row.event_icon_url) ?? null,
        enabled: Boolean(row.enabled),
        rank: Number(row.rank ?? 0),
        source: normalizeSource(row.source),
        startsAt: toIsoString(row.starts_at),
        endsAt: toIsoString(row.ends_at),
        contextMode: normalizeContextMode(row.context_mode),
        autoRolloverEnabled: Boolean(row.auto_rollover_enabled),
      }))

      return { data: items, error: null }
    })
  },

  async replaceFeaturedEvents(items: ReplaceHomeFeaturedEventsInput[]): Promise<QueryResult<null>> {
    return runQuery(async () => {
      const normalizedItems = items
        .map(normalizeReplaceItem)
        .filter((item): item is NonNullable<typeof item> => item !== null)

      await db.transaction(async (tx) => {
        await tx.delete(home_featured_events)

        if (normalizedItems.length === 0) {
          return
        }

        await tx.insert(home_featured_events).values(normalizedItems)
      })

      revalidateTag(cacheTags.homeFeaturedEvents, { expire: 0 })

      return { data: null, error: null }
    })
  },

  async resolvePublicTargets(limit = 6): Promise<QueryResult<HomeFeaturedResolvedTarget[]>> {
    'use cache'
    cacheTag(cacheTags.homeFeaturedEvents)
    cacheTag(cacheTags.eventsList)

    return runQuery(async () => {
      const now = new Date()
      const safeLimit = Math.min(Math.max(limit, 1), 8)
      const rows = await db
        .select()
        .from(home_featured_events)
        .where(and(
          eq(home_featured_events.enabled, true),
          or(isNull(home_featured_events.starts_at), lte(home_featured_events.starts_at, now)),
          or(isNull(home_featured_events.ends_at), gt(home_featured_events.ends_at, now)),
        ))
        .orderBy(asc(home_featured_events.rank), asc(home_featured_events.created_at))
        .limit(safeLimit * 2)

      const resolvedTargets: HomeFeaturedResolvedTarget[] = []
      const seenEventIds = new Set<string>()

      for (const row of rows) {
        if (resolvedTargets.length >= safeLimit) {
          break
        }

        const targetType = normalizeTargetType(row.target_type)
        const resolvedEvent = targetType === 'series'
          ? await resolveSeriesTarget(row.series_slug ?? '')
          : await resolveEventTarget(row.event_id ?? null)

        if (!resolvedEvent || seenEventIds.has(resolvedEvent.id)) {
          continue
        }

        seenEventIds.add(resolvedEvent.id)
        resolvedTargets.push({
          featuredId: row.id,
          targetType,
          source: normalizeSource(row.source),
          rank: Number(row.rank ?? 0),
          contextMode: normalizeContextMode(row.context_mode),
          eventId: resolvedEvent.id,
          eventSlug: resolvedEvent.slug,
          eventTitle: resolvedEvent.title,
          seriesSlug: resolvedEvent.series_slug ?? row.series_slug ?? null,
        })
      }

      return { data: resolvedTargets, error: null }
    })
  },

  async listContextItems(featuredEventIds: string[], locale: string): Promise<QueryResult<Map<string, HomeFeaturedContextItem[]>>> {
    if (featuredEventIds.length === 0) {
      return { data: new Map(), error: null }
    }

    return runQuery(async () => {
      const now = new Date()
      const rows = await db
        .select()
        .from(home_featured_event_context_items)
        .where(and(
          inArray(home_featured_event_context_items.featured_event_id, featuredEventIds),
          eq(home_featured_event_context_items.locale, locale),
          gt(home_featured_event_context_items.expires_at, now),
        ))
        .orderBy(
          asc(home_featured_event_context_items.featured_event_id),
          desc(home_featured_event_context_items.relevance_score),
          desc(home_featured_event_context_items.published_at),
          desc(home_featured_event_context_items.selected_at),
        )

      const itemsByFeaturedId = new Map<string, HomeFeaturedContextItem[]>()
      for (const row of rows) {
        const items = itemsByFeaturedId.get(row.featured_event_id) ?? []
        if (items.length < 3) {
          items.push(mapContextRow(row))
          itemsByFeaturedId.set(row.featured_event_id, items)
        }
      }

      return { data: itemsByFeaturedId, error: null }
    })
  },

  async replaceContextItems(
    featuredEventId: string,
    eventId: string,
    locale: string,
    items: UpsertHomeFeaturedContextItemInput[],
  ): Promise<QueryResult<null>> {
    return runQuery(async () => {
      await db.transaction(async (tx) => {
        await tx
          .delete(home_featured_event_context_items)
          .where(and(
            eq(home_featured_event_context_items.featured_event_id, featuredEventId),
            eq(home_featured_event_context_items.locale, locale),
          ))

        if (items.length === 0) {
          return
        }

        await tx.insert(home_featured_event_context_items).values(items.slice(0, 3).map(item => ({
          featured_event_id: featuredEventId,
          event_id: eventId,
          locale,
          item_type: item.itemType,
          source: item.source,
          title: item.title,
          url: item.url ?? null,
          published_at: item.publishedAt ?? null,
          relevance_score: item.relevanceScore == null ? null : String(item.relevanceScore),
          expires_at: item.expiresAt,
        })))
      })

      revalidateTag(cacheTags.homeFeaturedEvents, { expire: 0 })

      return { data: null, error: null }
    })
  },
}
