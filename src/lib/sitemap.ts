import { and, desc, eq, exists, inArray, sql } from 'drizzle-orm'
import { cacheTag } from 'next/cache'
import { DEFAULT_LOCALE } from '@/i18n/locales'
import { cacheTags } from '@/lib/cache-tags'
import { CATEGORY_PATH_SLUG_SET } from '@/lib/constants'
import { TagRepository } from '@/lib/db/queries/tag'
import { event_sports, event_tags, events, markets, tags } from '@/lib/db/schema/events/tables'
import { db } from '@/lib/drizzle'
import { resolveEventMarketPath, resolveEventPagePath } from '@/lib/events-routing'

const STATIC_SITEMAP_IDS = [
  'base',
] as const

const CATEGORIES_SITEMAP_ID = 'categories'
const PREDICTIONS_SITEMAP_PREFIX = 'predictions-'
const PREDICTIONS_SITEMAP_PATTERN = /^predictions-(\d{3})$/
const ACTIVE_EVENTS_SITEMAP_PREFIX = 'events-active-'
const ACTIVE_EVENTS_SITEMAP_PATTERN = /^events-active-(\d{3})$/
const CLOSED_EVENTS_SITEMAP_PREFIX = 'events-closed-'
const CLOSED_MONTH_PATTERN = /^\d{4}-\d{2}$/
const SITEMAP_URL_LIMIT = 50_000

interface SitemapRouteEntry {
  path: string
  lastModified: string
}

interface DynamicEventSitemaps {
  active: SitemapRouteEntry[]
  closedByMonth: Record<string, SitemapRouteEntry[]>
}

interface SitemapIndexEntry {
  id: string
  lastmod: string
}

interface EventSitemapRow {
  slug: string
  status: string
  resolved_at: Date | null
  end_date: Date | null
  updated_at: Date
  sports_sport_slug: string | null
  sports_event_slug: string | null
  has_unresolved_markets: boolean
}

interface PredictionSitemapRow {
  event_slug: string
  market_slug: string
  updated_at: Date
  sports_sport_slug: string | null
  sports_event_slug: string | null
}

export function formatDateForSitemap(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export async function getSitemapIds(): Promise<string[]> {
  const entries = await getSitemapIndexEntries()
  return entries.map(entry => entry.id)
}

export async function getSitemapIndexEntries(): Promise<SitemapIndexEntry[]> {
  const fallbackDate = formatDateForSitemap(new Date())
  const categoryEntries = await getCategorySitemapEntries()
  const dynamicSitemaps = await getDynamicEventSitemaps()
  const predictionEntries = await getPredictionSitemapEntries()
  const entries: SitemapIndexEntry[] = [
    ...STATIC_SITEMAP_IDS.map(id => ({ id, lastmod: fallbackDate })),
    {
      id: CATEGORIES_SITEMAP_ID,
      lastmod: getLatestLastModified(categoryEntries, fallbackDate),
    },
  ]

  const predictionChunks = chunkSitemapEntries(predictionEntries, SITEMAP_URL_LIMIT)
  for (let index = 0; index < predictionChunks.length; index += 1) {
    const chunkEntries = predictionChunks[index] ?? []
    entries.push({
      id: formatPredictionSitemapId(index + 1),
      lastmod: getLatestLastModified(chunkEntries, fallbackDate),
    })
  }

  const activeChunks = chunkSitemapEntries(dynamicSitemaps.active, SITEMAP_URL_LIMIT)
  for (let index = 0; index < activeChunks.length; index += 1) {
    const chunkEntries = activeChunks[index] ?? []
    entries.push({
      id: formatActiveSitemapId(index + 1),
      lastmod: getLatestLastModified(chunkEntries, fallbackDate),
    })
  }

  const closedMonthKeys = Object.keys(dynamicSitemaps.closedByMonth).sort((a, b) => {
    if (a === b) {
      return 0
    }
    return a > b ? -1 : 1
  })
  for (const monthKey of closedMonthKeys) {
    const monthEntries = dynamicSitemaps.closedByMonth[monthKey] ?? []
    if (monthEntries.length === 0) {
      continue
    }

    entries.push({
      id: `${CLOSED_EVENTS_SITEMAP_PREFIX}${monthKey}`,
      lastmod: getLatestLastModified(monthEntries, fallbackDate),
    })
  }

  return entries
}

export async function getDynamicSitemapEntriesById(id: string): Promise<SitemapRouteEntry[]> {
  if (id === CATEGORIES_SITEMAP_ID) {
    return getCategorySitemapEntries()
  }

  const predictionChunkIndex = extractPredictionChunkIndex(id)
  if (predictionChunkIndex !== null) {
    const predictionEntries = await getPredictionSitemapEntries()
    const predictionChunks = chunkSitemapEntries(predictionEntries, SITEMAP_URL_LIMIT)
    return predictionChunks[predictionChunkIndex - 1] ?? []
  }

  const dynamicSitemaps = await getDynamicEventSitemaps()

  const activeChunkIndex = extractActiveChunkIndex(id)
  if (activeChunkIndex !== null) {
    const activeChunks = chunkSitemapEntries(dynamicSitemaps.active, SITEMAP_URL_LIMIT)
    return activeChunks[activeChunkIndex - 1] ?? []
  }

  const monthKey = extractClosedMonthKey(id)
  if (!monthKey) {
    return []
  }

  return dynamicSitemaps.closedByMonth[monthKey] ?? []
}

async function getCategorySitemapEntries(): Promise<SitemapRouteEntry[]> {
  'use cache'

  cacheTag(cacheTags.mainTags(DEFAULT_LOCALE))
  const fallbackDate = formatDateForSitemap(new Date())

  try {
    const { data: mainTags } = await TagRepository.getMainTags(DEFAULT_LOCALE)
    const categoryPathMap = new Map<string, SitemapRouteEntry>()

    for (const tag of mainTags ?? []) {
      const categoryPath = resolveCategoryPath(tag.slug)
      if (!categoryPath) {
        continue
      }

      categoryPathMap.set(categoryPath, {
        path: categoryPath,
        lastModified: fallbackDate,
      })
    }

    return Array.from(categoryPathMap.values()).sort((a, b) => a.path.localeCompare(b.path))
  }
  catch {
    return []
  }
}

async function getPredictionSitemapEntries(): Promise<SitemapRouteEntry[]> {
  'use cache'

  cacheTag(cacheTags.eventsGlobal)

  try {
    const rows = await db
      .select({
        event_slug: events.slug,
        market_slug: markets.slug,
        updated_at: markets.updated_at,
        sports_sport_slug: event_sports.sports_sport_slug,
        sports_event_slug: event_sports.sports_event_slug,
      })
      .from(markets)
      .innerJoin(events, eq(events.id, markets.event_id))
      .leftJoin(event_sports, eq(event_sports.event_id, events.id))
      .where(and(
        inArray(events.status, ['active', 'resolved', 'archived']),
        sql`TRIM(COALESCE(${markets.slug}, '')) <> ''`,
        sql`NOT EXISTS (
          SELECT 1
          FROM ${event_tags} et
          JOIN ${tags} t ON t.id = et.tag_id
          WHERE et.event_id = ${events.id} AND t.hide_events = TRUE
        )`,
      ))
      .orderBy(desc(markets.updated_at))

    const marketPathMap = new Map<string, SitemapRouteEntry>()
    for (const row of rows as PredictionSitemapRow[]) {
      const marketPath = resolveEventMarketPath({
        slug: row.event_slug,
        sports_sport_slug: row.sports_sport_slug,
        sports_event_slug: row.sports_event_slug,
      }, row.market_slug)

      marketPathMap.set(marketPath, {
        path: marketPath,
        lastModified: formatDateForSitemap(row.updated_at),
      })
    }

    return Array.from(marketPathMap.values()).sort(sortEntriesByLastModifiedDesc)
  }
  catch {
    return []
  }
}

async function getDynamicEventSitemaps(): Promise<DynamicEventSitemaps> {
  'use cache'

  cacheTag(cacheTags.eventsGlobal)

  try {
    const hasAnyMarkets = exists(
      db.select({ condition_id: markets.condition_id })
        .from(markets)
        .where(eq(markets.event_id, events.id)),
    )
    const hasUnresolvedMarkets = exists(
      db.select({ condition_id: markets.condition_id })
        .from(markets)
        .where(and(
          eq(markets.event_id, events.id),
          eq(markets.is_resolved, false),
        )),
    )

    const rows = await db
      .select({
        slug: events.slug,
        status: events.status,
        resolved_at: events.resolved_at,
        end_date: events.end_date,
        updated_at: events.updated_at,
        sports_sport_slug: event_sports.sports_sport_slug,
        sports_event_slug: event_sports.sports_event_slug,
        has_unresolved_markets: hasUnresolvedMarkets,
      })
      .from(events)
      .leftJoin(event_sports, eq(event_sports.event_id, events.id))
      .where(and(
        inArray(events.status, ['active', 'resolved', 'archived']),
        hasAnyMarkets,
        sql`NOT EXISTS (
          SELECT 1
          FROM ${event_tags} et
          JOIN ${tags} t ON t.id = et.tag_id
          WHERE et.event_id = ${events.id} AND t.hide_events = TRUE
        )`,
      ))
      .orderBy(desc(events.updated_at))

    return groupEventRowsBySitemap(rows as EventSitemapRow[])
  }
  catch {
    return {
      active: [],
      closedByMonth: {},
    }
  }
}

function groupEventRowsBySitemap(rows: EventSitemapRow[]): DynamicEventSitemaps {
  const activeMap = new Map<string, SitemapRouteEntry>()
  const closedByMonthMap = new Map<string, Map<string, SitemapRouteEntry>>()

  for (const row of rows) {
    const eventPath = resolveEventPagePath({
      slug: row.slug,
      sports_sport_slug: row.sports_sport_slug,
      sports_event_slug: row.sports_event_slug,
    })
    const eventLastModified = formatDateForSitemap(row.updated_at)
    const eventEntry: SitemapRouteEntry = {
      path: eventPath,
      lastModified: eventLastModified,
    }
    const isClosed = row.status === 'resolved'
      || row.status === 'archived'
      || (row.status === 'active' && row.has_unresolved_markets === false)

    if (!isClosed) {
      activeMap.set(eventPath, eventEntry)
      continue
    }

    const closedReferenceDate = row.resolved_at ?? row.end_date ?? row.updated_at
    const monthKey = formatYearMonth(closedReferenceDate)
    const monthEntries = closedByMonthMap.get(monthKey) ?? new Map<string, SitemapRouteEntry>()
    monthEntries.set(eventPath, eventEntry)
    closedByMonthMap.set(monthKey, monthEntries)
  }

  const activeEntries = Array.from(activeMap.values()).sort(sortEntriesByLastModifiedDesc)
  const closedByMonth: Record<string, SitemapRouteEntry[]> = {}

  for (const [monthKey, monthEntriesMap] of closedByMonthMap.entries()) {
    closedByMonth[monthKey] = Array.from(monthEntriesMap.values()).sort(sortEntriesByLastModifiedDesc)
  }

  return {
    active: activeEntries,
    closedByMonth,
  }
}

function formatYearMonth(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function resolveCategoryPath(slug: string): string | null {
  const normalizedSlug = slug.trim().toLowerCase()

  if (normalizedSlug === 'sports') {
    return '/sports'
  }

  if (CATEGORY_PATH_SLUG_SET.has(normalizedSlug)) {
    return `/${normalizedSlug}`
  }

  return null
}

function formatActiveSitemapId(index: number): string {
  const suffix = String(index).padStart(3, '0')
  return `${ACTIVE_EVENTS_SITEMAP_PREFIX}${suffix}`
}

function formatPredictionSitemapId(index: number): string {
  const suffix = String(index).padStart(3, '0')
  return `${PREDICTIONS_SITEMAP_PREFIX}${suffix}`
}

function extractPredictionChunkIndex(id: string): number | null {
  const match = id.match(PREDICTIONS_SITEMAP_PATTERN)
  if (!match) {
    return null
  }

  const parsed = Number(match[1])
  if (!Number.isInteger(parsed) || parsed < 1) {
    return null
  }

  return parsed
}

function extractActiveChunkIndex(id: string): number | null {
  const match = id.match(ACTIVE_EVENTS_SITEMAP_PATTERN)
  if (!match) {
    return null
  }

  const parsed = Number(match[1])
  if (!Number.isInteger(parsed) || parsed < 1) {
    return null
  }

  return parsed
}

function chunkSitemapEntries(entries: SitemapRouteEntry[], chunkSize: number): SitemapRouteEntry[][] {
  if (entries.length === 0) {
    return []
  }

  const chunks: SitemapRouteEntry[][] = []
  for (let index = 0; index < entries.length; index += chunkSize) {
    chunks.push(entries.slice(index, index + chunkSize))
  }

  return chunks
}

function extractClosedMonthKey(id: string): string | null {
  if (!id.startsWith(CLOSED_EVENTS_SITEMAP_PREFIX)) {
    return null
  }

  const monthKey = id.slice(CLOSED_EVENTS_SITEMAP_PREFIX.length)
  if (!CLOSED_MONTH_PATTERN.test(monthKey)) {
    return null
  }

  return monthKey
}

function getLatestLastModified(entries: SitemapRouteEntry[], fallbackDate: string): string {
  if (entries.length === 0) {
    return fallbackDate
  }

  return entries
    .map(entry => entry.lastModified)
    .sort((a, b) => (a > b ? -1 : 1))[0] ?? fallbackDate
}

function sortEntriesByLastModifiedDesc(a: SitemapRouteEntry, b: SitemapRouteEntry): number {
  if (a.lastModified === b.lastModified) {
    return a.path.localeCompare(b.path)
  }
  return a.lastModified > b.lastModified ? -1 : 1
}
