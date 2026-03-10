import type { Event } from '@/types'
import { isSportsAuxiliaryEventSlug } from '@/lib/sports-event-slugs'

interface HomeEventVisibilityOptions {
  currentTimestamp?: number | null
  hideCrypto?: boolean
  hideEarnings?: boolean
  hideSports?: boolean
  status?: 'active' | 'resolved'
}

function normalizeSeriesSlug(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase()
  return normalized || null
}

function toTimestamp(value: string | null | undefined) {
  if (!value) {
    return Number.NEGATIVE_INFINITY
  }

  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY
}

function isMoreRecentEvent(candidate: Event, current: Event) {
  const candidateCreatedAt = toTimestamp(candidate.created_at)
  const currentCreatedAt = toTimestamp(current.created_at)

  if (candidateCreatedAt !== currentCreatedAt) {
    return candidateCreatedAt > currentCreatedAt
  }

  const candidateUpdatedAt = toTimestamp(candidate.updated_at)
  const currentUpdatedAt = toTimestamp(current.updated_at)

  if (candidateUpdatedAt !== currentUpdatedAt) {
    return candidateUpdatedAt > currentUpdatedAt
  }

  return candidate.id > current.id
}

function isResolvedLike(event: Event) {
  if (event.status === 'resolved') {
    return true
  }

  if (!event.markets || event.markets.length === 0) {
    return false
  }

  return event.markets.every(market => market.is_resolved)
}

function isOverdueUnresolved(event: Event, nowMs: number) {
  const endTimestamp = toTimestamp(event.end_date)
  return !isResolvedLike(event) && Number.isFinite(endTimestamp) && endTimestamp < nowMs
}

function isPreferredSeriesEvent(candidate: Event, current: Event, nowMs: number) {
  const candidateEnd = toTimestamp(candidate.end_date)
  const currentEnd = toTimestamp(current.end_date)
  const candidateHasFutureEnd = candidateEnd >= nowMs
  const currentHasFutureEnd = currentEnd >= nowMs
  const candidateResolved = isResolvedLike(candidate)
  const currentResolved = isResolvedLike(current)
  const candidateOverdueUnresolved = isOverdueUnresolved(candidate, nowMs)
  const currentOverdueUnresolved = isOverdueUnresolved(current, nowMs)

  if (candidateOverdueUnresolved || currentOverdueUnresolved) {
    if (candidateOverdueUnresolved !== currentOverdueUnresolved) {
      return candidateOverdueUnresolved
    }

    if (candidateEnd !== currentEnd) {
      return candidateEnd > currentEnd
    }

    return isMoreRecentEvent(candidate, current)
  }

  if (candidateHasFutureEnd && currentHasFutureEnd) {
    if (candidateResolved !== currentResolved) {
      return !candidateResolved
    }

    if (candidateEnd !== currentEnd) {
      return candidateEnd < currentEnd
    }

    return isMoreRecentEvent(candidate, current)
  }

  if (candidateHasFutureEnd !== currentHasFutureEnd) {
    return candidateHasFutureEnd
  }

  if (candidateResolved !== currentResolved) {
    return !candidateResolved
  }

  if (candidateEnd !== currentEnd) {
    return candidateEnd > currentEnd
  }

  return isMoreRecentEvent(candidate, current)
}

export function filterHomeEvents(events: Event[], options: HomeEventVisibilityOptions = {}) {
  if (events.length === 0) {
    return events
  }

  const {
    currentTimestamp = null,
    hideCrypto = false,
    hideEarnings = false,
    hideSports = false,
    status = 'active',
  } = options

  const eventsMatchingTagFilters = events.filter((event) => {
    if (isSportsAuxiliaryEventSlug(event.slug)) {
      return false
    }

    const tagSlugs = new Set<string>()

    if (event.main_tag) {
      tagSlugs.add(event.main_tag.toLowerCase())
    }

    for (const tag of event.tags ?? []) {
      if (tag?.slug) {
        tagSlugs.add(tag.slug.toLowerCase())
      }
    }

    const slugs = Array.from(tagSlugs)
    const hasSportsTag = slugs.some(slug => slug.includes('sport'))
    const hasCryptoTag = slugs.some(slug => slug.includes('crypto'))
    const hasEarningsTag = slugs.some(slug => slug.includes('earning'))

    if (hideSports && hasSportsTag) {
      return false
    }

    if (hideCrypto && hasCryptoTag) {
      return false
    }

    return !(hideEarnings && hasEarningsTag)
  })

  if (status === 'resolved' || currentTimestamp == null) {
    return eventsMatchingTagFilters
  }

  const newestBySeriesSlug = new Map<string, Event>()

  for (const event of eventsMatchingTagFilters) {
    const seriesSlug = normalizeSeriesSlug(event.series_slug)
    if (!seriesSlug) {
      continue
    }

    const currentNewest = newestBySeriesSlug.get(seriesSlug)
    if (!currentNewest || isPreferredSeriesEvent(event, currentNewest, currentTimestamp)) {
      newestBySeriesSlug.set(seriesSlug, event)
    }
  }

  if (newestBySeriesSlug.size === 0) {
    return eventsMatchingTagFilters
  }

  return eventsMatchingTagFilters.filter((event) => {
    const seriesSlug = normalizeSeriesSlug(event.series_slug)
    if (!seriesSlug) {
      return true
    }

    return newestBySeriesSlug.get(seriesSlug)?.id === event.id
  })
}
