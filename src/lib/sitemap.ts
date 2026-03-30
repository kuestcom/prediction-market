import { and, desc, eq, exists, inArray, sql } from 'drizzle-orm'
import { cacheTag } from 'next/cache'
import { loadEnabledLocales } from '@/i18n/locale-settings'
import { DEFAULT_LOCALE } from '@/i18n/locales'
import { cacheTags } from '@/lib/cache-tags'
import { getSportsSlugResolverFromDb } from '@/lib/db/queries/sports-menu'
import { TagRepository } from '@/lib/db/queries/tag'
import { event_sports, event_tags, events, markets, tags } from '@/lib/db/schema/events/tables'
import { db } from '@/lib/drizzle'
import { buildPublicEventListVisibilityCondition } from '@/lib/event-visibility'
import { resolveEventMarketPath, resolveEventPagePath } from '@/lib/events-routing'
import { isDynamicHomeCategorySlug } from '@/lib/platform-routing'
import { isSportsAuxiliaryEventSlug } from '@/lib/sports-event-slugs'
import { resolveCanonicalSportsSportSlug } from '@/lib/sports-slug-mapping'

const STATIC_SITEMAP_IDS = [
  'base',
] as const

const CATEGORIES_SITEMAP_ID = 'categories'
const PREDICTIONS_SITEMAP_PREFIX = 'predictions-'
const PREDICTIONS_SITEMAP_PATTERN = /^predictions-(\d{3})$/
const ACTIVE_EVENTS_SITEMAP_PREFIX = 'events-active-'
const ACTIVE_EVENTS_SITEMAP_PATTERN = /^events-active-(\d{3})$/
const CLOSED_EVENTS_SITEMAP_PREFIX = 'events-closed-'
const CLOSED_EVENTS_SITEMAP_PATTERN = /^events-closed-(\d{4}-\d{2})(?:-(\d{3}))?$/
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

interface ClosedSitemapId {
  monthKey: string
  chunkIndex: number
}

interface EventSitemapRow {
  slug: string
  status: string
  resolved_at: Date | null
  end_date: Date | null
  updated_at: Date
  has_esports_tag: boolean
  sports_sport_slug: string | null
  sports_series_slug: string | null
  sports_event_slug: string | null
  sports_tags: unknown
  has_unresolved_markets: boolean
}

interface PredictionSitemapRow {
  event_slug: string
  market_slug: string
  updated_at: Date
  has_esports_tag: boolean
  sports_sport_slug: string | null
  sports_series_slug: string | null
  sports_event_slug: string | null
  sports_tags: unknown
}

function shouldIgnoreSportsSitemapSlug(slug: string | null | undefined) {
  return isSportsAuxiliaryEventSlug(slug)
}

function toOptionalStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[]
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim())
    .filter(Boolean)
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
  const chunkSize = await resolveLocalizedSitemapChunkSize()
  const entries: SitemapIndexEntry[] = [
    ...STATIC_SITEMAP_IDS.map(id => ({ id, lastmod: fallbackDate })),
    {
      id: CATEGORIES_SITEMAP_ID,
      lastmod: getLatestLastModified(categoryEntries, fallbackDate),
    },
  ]

  const predictionChunks = chunkSitemapEntries(predictionEntries, chunkSize)
  for (let index = 0; index < predictionChunks.length; index += 1) {
    const chunkEntries = predictionChunks[index] ?? []
    entries.push({
      id: formatPredictionSitemapId(index + 1),
      lastmod: getLatestLastModified(chunkEntries, fallbackDate),
    })
  }

  const activeChunks = chunkSitemapEntries(dynamicSitemaps.active, chunkSize)
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

    const monthChunks = chunkSitemapEntries(monthEntries, chunkSize)
    for (let index = 0; index < monthChunks.length; index += 1) {
      const chunkEntries = monthChunks[index] ?? []
      entries.push({
        id: formatClosedSitemapId(monthKey, index + 1, monthChunks.length),
        lastmod: getLatestLastModified(chunkEntries, fallbackDate),
      })
    }
  }

  return entries
}

export async function getDynamicSitemapEntriesById(id: string): Promise<SitemapRouteEntry[]> {
  if (id === CATEGORIES_SITEMAP_ID) {
    return getCategorySitemapEntries()
  }

  const chunkSize = await resolveLocalizedSitemapChunkSize()
  const predictionChunkIndex = extractPredictionChunkIndex(id)
  if (predictionChunkIndex !== null) {
    const predictionEntries = await getPredictionSitemapEntries()
    const predictionChunks = chunkSitemapEntries(predictionEntries, chunkSize)
    return predictionChunks[predictionChunkIndex - 1] ?? []
  }

  const dynamicSitemaps = await getDynamicEventSitemaps()

  const activeChunkIndex = extractActiveChunkIndex(id)
  if (activeChunkIndex !== null) {
    const activeChunks = chunkSitemapEntries(dynamicSitemaps.active, chunkSize)
    return activeChunks[activeChunkIndex - 1] ?? []
  }

  const closedSitemapId = extractClosedSitemapId(id)
  if (!closedSitemapId) {
    return []
  }

  const monthEntries = dynamicSitemaps.closedByMonth[closedSitemapId.monthKey] ?? []
  const monthChunks = chunkSitemapEntries(monthEntries, chunkSize)
  return monthChunks[closedSitemapId.chunkIndex - 1] ?? []
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
    const sportsSlugResolver = await getSportsSlugResolverFromDb()
    const hasEsportsTag = exists(
      db.select()
        .from(event_tags)
        .innerJoin(tags, eq(event_tags.tag_id, tags.id))
        .where(and(
          eq(event_tags.event_id, events.id),
          eq(tags.slug, 'esports'),
        )),
    )
    const rows = await db
      .select({
        event_slug: events.slug,
        market_slug: markets.slug,
        updated_at: markets.updated_at,
        has_esports_tag: hasEsportsTag,
        sports_sport_slug: event_sports.sports_sport_slug,
        sports_series_slug: event_sports.sports_series_slug,
        sports_event_slug: event_sports.sports_event_slug,
        sports_tags: event_sports.sports_tags,
      })
      .from(markets)
      .innerJoin(events, eq(events.id, markets.event_id))
      .leftJoin(event_sports, eq(event_sports.event_id, events.id))
      .where(and(
        inArray(events.status, ['active', 'resolved', 'archived']),
        eq(events.is_hidden, false),
        sql`TRIM(COALESCE(${markets.slug}, '')) <> ''`,
        buildPublicEventListVisibilityCondition(events.id),
      ))
      .orderBy(desc(markets.updated_at))

    const marketPathMap = new Map<string, SitemapRouteEntry>()
    for (const row of rows as PredictionSitemapRow[]) {
      const sportsEventSlug = row.sports_event_slug?.trim() ?? null
      if (shouldIgnoreSportsSitemapSlug(sportsEventSlug)) {
        continue
      }

      const canonicalSportsSportSlug = resolveCanonicalSportsSportSlug(sportsSlugResolver, {
        sportsSportSlug: row.sports_sport_slug,
        sportsSeriesSlug: row.sports_series_slug,
        sportsTags: toOptionalStringArray(row.sports_tags),
      })

      const marketPath = resolveEventMarketPath({
        slug: row.event_slug,
        tags: row.has_esports_tag ? [{ slug: 'esports' }] : undefined,
        sports_sport_slug: canonicalSportsSportSlug,
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
    const sportsSlugResolver = await getSportsSlugResolverFromDb()
    const hasEsportsTag = exists(
      db.select()
        .from(event_tags)
        .innerJoin(tags, eq(event_tags.tag_id, tags.id))
        .where(and(
          eq(event_tags.event_id, events.id),
          eq(tags.slug, 'esports'),
        )),
    )
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
        has_esports_tag: hasEsportsTag,
        sports_sport_slug: event_sports.sports_sport_slug,
        sports_series_slug: event_sports.sports_series_slug,
        sports_event_slug: event_sports.sports_event_slug,
        sports_tags: event_sports.sports_tags,
        has_unresolved_markets: hasUnresolvedMarkets,
      })
      .from(events)
      .leftJoin(event_sports, eq(event_sports.event_id, events.id))
      .where(and(
        inArray(events.status, ['active', 'resolved', 'archived']),
        eq(events.is_hidden, false),
        hasAnyMarkets,
        buildPublicEventListVisibilityCondition(events.id),
      ))
      .orderBy(desc(events.updated_at))

    return groupEventRowsBySitemap(rows as EventSitemapRow[], sportsSlugResolver)
  }
  catch {
    return {
      active: [],
      closedByMonth: {},
    }
  }
}

function groupEventRowsBySitemap(rows: EventSitemapRow[], sportsSlugResolver: Awaited<ReturnType<typeof getSportsSlugResolverFromDb>>): DynamicEventSitemaps {
  const activeMap = new Map<string, SitemapRouteEntry>()
  const closedByMonthMap = new Map<string, Map<string, SitemapRouteEntry>>()

  for (const row of rows) {
    const sportsEventSlug = row.sports_event_slug?.trim() ?? null
    if (shouldIgnoreSportsSitemapSlug(sportsEventSlug)) {
      continue
    }

    const canonicalSportsSportSlug = resolveCanonicalSportsSportSlug(sportsSlugResolver, {
      sportsSportSlug: row.sports_sport_slug,
      sportsSeriesSlug: row.sports_series_slug,
      sportsTags: toOptionalStringArray(row.sports_tags),
    })

    const eventPath = resolveEventPagePath({
      slug: row.slug,
      tags: row.has_esports_tag ? [{ slug: 'esports' }] : undefined,
      sports_sport_slug: canonicalSportsSportSlug,
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

  if (normalizedSlug === 'esports') {
    return '/esports'
  }

  if (isDynamicHomeCategorySlug(normalizedSlug)) {
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

function formatClosedSitemapId(monthKey: string, index: number, totalChunks: number): string {
  if (totalChunks <= 1) {
    return `${CLOSED_EVENTS_SITEMAP_PREFIX}${monthKey}`
  }

  const suffix = String(index).padStart(3, '0')
  return `${CLOSED_EVENTS_SITEMAP_PREFIX}${monthKey}-${suffix}`
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

async function resolveLocalizedSitemapChunkSize(): Promise<number> {
  const enabledLocales = await loadEnabledLocales()
  const localeCount = Math.max(enabledLocales.length, 1)

  return Math.max(1, Math.floor(SITEMAP_URL_LIMIT / localeCount))
}

function extractClosedSitemapId(id: string): ClosedSitemapId | null {
  const match = id.match(CLOSED_EVENTS_SITEMAP_PATTERN)
  if (!match) {
    return null
  }

  const monthKey = match[1]
  const chunkIndex = match[2] ? Number(match[2]) : 1
  if (!monthKey || !Number.isInteger(chunkIndex) || chunkIndex < 1) {
    return null
  }

  return {
    monthKey,
    chunkIndex,
  }
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
