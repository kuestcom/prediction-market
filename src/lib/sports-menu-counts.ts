import type { SportsMenuEntry } from '@/lib/sports-menu-types'
import type { SportsSlugResolver } from '@/lib/sports-slug-mapping'
import { normalizeComparableValue } from '@/lib/slug'
import { stripSportsAuxiliaryEventSuffix } from '@/lib/sports-event-slugs'
import {
  resolveSportsSidebarMenuSlugCountKey,
  SPORTS_SIDEBAR_FUTURE_COUNT_KEY,
  SPORTS_SIDEBAR_LIVE_COUNT_KEY,
} from '@/lib/sports-sidebar-counts'
import { resolveCanonicalSportsSportSlug } from '@/lib/sports-slug-mapping'

export interface SportsMenuActiveCountRow {
  slug: string | null
  series_slug: string | null
  event_slug: string | null
  sports_event_id: number | string | null
  sports_event_slug: string | null
  parent_event_id: number | string | null
  tags: unknown
  is_hidden: boolean
  sports_live: boolean | null
  sports_ended: boolean | null
  sports_start_time: Date | string | null
  start_date: Date | string | null
  end_date: Date | string | null
}

const SPORTS_LIVE_FALLBACK_WINDOW_MS = 2 * 60 * 60 * 1000

function toOptionalStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[]
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim())
    .filter(Boolean)
}

function toFiniteTimestamp(value: Date | string | null | undefined) {
  if (!value) {
    return Number.NaN
  }

  if (value instanceof Date) {
    const timestamp = value.getTime()
    return Number.isFinite(timestamp) ? timestamp : Number.NaN
  }

  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : Number.NaN
}

function resolveCountRowStartTimestamp(row: SportsMenuActiveCountRow) {
  const sportsStartTimestamp = toFiniteTimestamp(row.sports_start_time)
  if (Number.isFinite(sportsStartTimestamp)) {
    return sportsStartTimestamp
  }

  return toFiniteTimestamp(row.start_date)
}

function resolveCountRowEndTimestamp(row: SportsMenuActiveCountRow) {
  return toFiniteTimestamp(row.end_date)
}

function resolveCountRowLiveFallbackEndTimestamp(row: SportsMenuActiveCountRow) {
  const startMs = resolveCountRowStartTimestamp(row)
  if (!Number.isFinite(startMs)) {
    return Number.NaN
  }

  const endMs = resolveCountRowEndTimestamp(row)
  const referenceEndMs = Number.isFinite(endMs) && endMs > startMs
    ? endMs
    : startMs

  return referenceEndMs + SPORTS_LIVE_FALLBACK_WINDOW_MS
}

function isCountRowLiveNow(row: SportsMenuActiveCountRow, nowMs: number) {
  if (row.sports_ended === true) {
    return false
  }

  if (row.sports_live === true) {
    return true
  }

  const startMs = resolveCountRowStartTimestamp(row)
  const endMs = resolveCountRowEndTimestamp(row)
  const isInTimeWindow = Number.isFinite(startMs) && Number.isFinite(endMs)
    ? startMs <= nowMs && nowMs <= endMs
    : false
  const liveFallbackEndMs = resolveCountRowLiveFallbackEndTimestamp(row)
  const isWithinFallbackWindow = Number.isFinite(startMs) && Number.isFinite(liveFallbackEndMs)
    ? startMs <= nowMs && nowMs <= liveFallbackEndMs
    : false

  return isInTimeWindow || isWithinFallbackWindow
}

function isCountRowFuture(row: SportsMenuActiveCountRow, nowMs: number) {
  if (row.sports_ended === true) {
    return false
  }

  const startMs = resolveCountRowStartTimestamp(row)
  return Number.isFinite(startMs) && startMs > nowMs
}

function resolveCountRowSection(row: SportsMenuActiveCountRow) {
  const tagSlugs = new Set(
    toOptionalStringArray(row.tags)
      .map(tag => normalizeComparableValue(tag))
      .filter((tag): tag is string => Boolean(tag)),
  )

  if (tagSlugs.has('props') || tagSlugs.has('prop')) {
    return 'props' as const
  }

  if (tagSlugs.has('games') || tagSlugs.has('game')) {
    return 'games' as const
  }

  return null
}

function resolveCountRowGroupKey(row: SportsMenuActiveCountRow) {
  if (typeof row.parent_event_id === 'number' && Number.isFinite(row.parent_event_id)) {
    return String(row.parent_event_id)
  }

  const normalizedParentEventId = typeof row.parent_event_id === 'string'
    ? row.parent_event_id.trim()
    : ''
  if (normalizedParentEventId) {
    return normalizedParentEventId
  }

  if (typeof row.sports_event_id === 'number' && Number.isFinite(row.sports_event_id)) {
    return String(row.sports_event_id)
  }

  const normalizedSportsEventId = typeof row.sports_event_id === 'string'
    ? row.sports_event_id.trim()
    : ''
  if (normalizedSportsEventId) {
    return normalizedSportsEventId
  }

  const rawSlug = row.sports_event_slug?.trim() || row.event_slug?.trim() || ''
  if (!rawSlug) {
    return null
  }

  return stripSportsAuxiliaryEventSuffix(rawSlug)
}

function incrementCountForGroup(params: {
  countsBySlug: Record<string, number>
  seenGroupKeysByCountKey: Map<string, Set<string>>
  countKey: string
  groupKey: string | null
}) {
  if (!params.groupKey) {
    params.countsBySlug[params.countKey] = (params.countsBySlug[params.countKey] ?? 0) + 1
    return
  }

  const seenGroupKeys = params.seenGroupKeysByCountKey.get(params.countKey) ?? new Set<string>()
  if (seenGroupKeys.has(params.groupKey)) {
    return
  }

  seenGroupKeys.add(params.groupKey)
  params.seenGroupKeysByCountKey.set(params.countKey, seenGroupKeys)
  params.countsBySlug[params.countKey] = (params.countsBySlug[params.countKey] ?? 0) + 1
}

function addMenuCountKey(
  countKeysBySlug: Map<string, Set<string>>,
  entry: Extract<SportsMenuEntry, { type: 'link' }>,
) {
  const menuSlug = normalizeComparableValue(entry.menuSlug)
  if (!menuSlug) {
    return
  }

  const countKey = resolveSportsSidebarMenuSlugCountKey({
    href: entry.href,
    menuSlug,
  })
  if (!countKey) {
    return
  }

  const countKeys = countKeysBySlug.get(menuSlug) ?? new Set<string>()
  countKeys.add(countKey)
  countKeysBySlug.set(menuSlug, countKeys)
}

function collectMenuCountKeysBySlug(entries: SportsMenuEntry[]) {
  const countKeysBySlug = new Map<string, Set<string>>()

  for (const entry of entries) {
    if (entry.type === 'link') {
      addMenuCountKey(countKeysBySlug, entry)
      continue
    }

    if (entry.type !== 'group') {
      continue
    }

    for (const link of entry.links) {
      addMenuCountKey(countKeysBySlug, link)
    }
  }

  return countKeysBySlug
}

export function buildSportsMenuCountsBySlug(
  resolver: SportsSlugResolver,
  activeCountRows: SportsMenuActiveCountRow[],
  menuEntries: SportsMenuEntry[],
  nowMs = Date.now(),
) {
  const countsBySlug: Record<string, number> = {}
  const menuCountKeysBySlug = collectMenuCountKeysBySlug(menuEntries)
  const seenGroupKeysByCountKey = new Map<string, Set<string>>()

  for (const row of activeCountRows) {
    if (row.is_hidden) {
      continue
    }

    const sportsTags = toOptionalStringArray(row.tags)
    const canonicalSlug = resolveCanonicalSportsSportSlug(resolver, {
      sportsSportSlug: row.slug,
      sportsSeriesSlug: row.series_slug,
      sportsTags,
    })
    const menuCountKeys = canonicalSlug ? menuCountKeysBySlug.get(canonicalSlug) : null
    if (!canonicalSlug || !menuCountKeys || menuCountKeys.size === 0) {
      continue
    }

    const rowSection = resolveCountRowSection(row)
    const rowGroupKey = resolveCountRowGroupKey(row)
    const rowSectionKey = rowSection
      ? resolveSportsSidebarMenuSlugCountKey({
          href: `/${rowSection}`,
          menuSlug: canonicalSlug,
        })
      : null

    if (rowSectionKey && menuCountKeys.has(rowSectionKey)) {
      incrementCountForGroup({
        countsBySlug,
        seenGroupKeysByCountKey,
        countKey: rowSectionKey,
        groupKey: rowGroupKey,
      })
    }
    else if (menuCountKeys.has(canonicalSlug)) {
      incrementCountForGroup({
        countsBySlug,
        seenGroupKeysByCountKey,
        countKey: canonicalSlug,
        groupKey: rowGroupKey,
      })
    }

    if (isCountRowLiveNow(row, nowMs)) {
      incrementCountForGroup({
        countsBySlug,
        seenGroupKeysByCountKey,
        countKey: SPORTS_SIDEBAR_LIVE_COUNT_KEY,
        groupKey: rowGroupKey,
      })
    }

    if (isCountRowFuture(row, nowMs)) {
      incrementCountForGroup({
        countsBySlug,
        seenGroupKeysByCountKey,
        countKey: SPORTS_SIDEBAR_FUTURE_COUNT_KEY,
        groupKey: rowGroupKey,
      })
    }
  }

  return countsBySlug
}
