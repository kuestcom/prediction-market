import type { SupportedLocale } from '@/i18n/locales'
import type { EventListSortBy, EventListStatusFilter } from '@/lib/event-list-filters'
import type { Event } from '@/types'

import { EventRepository } from '@/lib/db/queries/event'
import { filterHomeEvents, HOME_EVENTS_PAGE_SIZE, isSportsPrimaryHomeEvent } from '@/lib/home-events'

const HOME_EVENTS_QUERY_BATCH_SIZE = 128

interface ListHomeEventsPageOptions {
  bookmarked: boolean
  currentTimestamp?: number | null
  frequency?: 'all' | 'daily' | 'weekly' | 'monthly'
  hideCrypto?: boolean
  hideEarnings?: boolean
  hideSports?: boolean
  locale: SupportedLocale
  mainTag: string
  offset?: number
  search?: string
  sortBy?: EventListSortBy
  sportsSection?: 'games' | 'props' | ''
  sportsSportSlug?: string
  status?: EventListStatusFilter
  tag: string
  userId: string
}

interface LoadHomeEventCandidatesOptions extends Omit<ListHomeEventsPageOptions, 'currentTimestamp'> {}

interface LoadHomeEventBatchesOptions extends Omit<
  LoadHomeEventCandidatesOptions,
  'offset' | 'hideCrypto' | 'hideEarnings' | 'hideSports'
> {
  initialEvents?: Event[]
  offset: number
}

async function loadHomeEventBatches({
  bookmarked,
  frequency = 'all',
  initialEvents = [],
  locale,
  mainTag,
  offset,
  search = '',
  sortBy,
  sportsSection = '',
  sportsSportSlug = '',
  status = 'active',
  tag,
  userId,
}: LoadHomeEventBatchesOptions) {
  let rawOffset = Math.max(0, offset)
  const accumulatedEvents = [...initialEvents]

  while (true) {
    const { data: rawEvents, error } = await EventRepository.listEvents({
      tag,
      mainTag,
      search,
      sortBy,
      userId,
      bookmarked,
      frequency,
      status,
      offset: rawOffset,
      limit: HOME_EVENTS_QUERY_BATCH_SIZE,
      locale,
      sportsSportSlug,
      sportsSection,
      excludeSportsAuxiliary: true,
    })

    if (error) {
      return { data: [], error }
    }

    const batch = rawEvents ?? []
    if (batch.length === 0) {
      break
    }

    accumulatedEvents.push(...batch)

    if (batch.length < HOME_EVENTS_QUERY_BATCH_SIZE) {
      break
    }

    rawOffset += batch.length
  }

  return {
    data: accumulatedEvents,
    error: null,
  }
}

async function loadHomeEventCandidates({
  bookmarked,
  frequency = 'all',
  hideCrypto = false,
  hideEarnings = false,
  hideSports = false,
  locale,
  mainTag,
  offset = 0,
  search = '',
  sortBy,
  sportsSection = '',
  sportsSportSlug = '',
  status = 'active',
  tag,
  userId,
}: LoadHomeEventCandidatesOptions) {
  const targetOffset = Math.max(0, offset)
  const hasHomeVisibilityFilters = hideSports || hideCrypto || hideEarnings

  if (status === 'resolved' && !hasHomeVisibilityFilters) {
    const { data, error } = await EventRepository.listEvents({
      tag,
      mainTag,
      search,
      sortBy,
      userId,
      bookmarked,
      frequency,
      status,
      offset: targetOffset,
      limit: HOME_EVENTS_PAGE_SIZE + 1,
      locale,
      sportsSportSlug,
      sportsSection,
      hideSports,
      hideCrypto,
      hideEarnings,
      excludeSportsAuxiliary: true,
      preferResolvedDateOrder: true,
      skipLivePricing: true,
    })

    return {
      data: data ?? [],
      error,
    }
  }

  if (status === 'resolved') {
    let rawOffset = 0
    const accumulatedEvents: Event[] = []
    let visibleEventsCount = 0

    while (true) {
      const { data: rawEvents, error } = await EventRepository.listEvents({
        tag,
        mainTag,
        search,
        sortBy,
        userId,
        bookmarked,
        frequency,
        status,
        offset: rawOffset,
        limit: HOME_EVENTS_QUERY_BATCH_SIZE,
        locale,
        sportsSportSlug,
        sportsSection,
        hideSports,
        hideCrypto,
        hideEarnings,
        excludeSportsAuxiliary: true,
        preferResolvedDateOrder: true,
        skipLivePricing: true,
      })

      if (error) {
        return { data: [], error }
      }

      const batch = rawEvents ?? []
      if (batch.length === 0) {
        break
      }

      accumulatedEvents.push(...batch)

      const visibleBatch = filterHomeEvents(batch, {
        hideSports,
        hideCrypto,
        hideEarnings,
        status,
      })
      visibleEventsCount += visibleBatch.length
      if (visibleEventsCount > targetOffset + HOME_EVENTS_PAGE_SIZE) {
        break
      }

      if (batch.length < HOME_EVENTS_QUERY_BATCH_SIZE) {
        break
      }

      rawOffset += HOME_EVENTS_QUERY_BATCH_SIZE
    }

    return {
      data: accumulatedEvents,
      error: null,
    }
  }

  if (status === 'active' && !hasHomeVisibilityFilters && targetOffset === 0) {
    // Only non-sports-primary recurring series can be replaced by later candidates during home filtering.
    // A page without one is already final, so avoid scanning the rest of the category.
    const { data: firstPage, error } = await EventRepository.listEvents({
      tag,
      mainTag,
      search,
      sortBy,
      userId,
      bookmarked,
      frequency,
      status,
      offset: 0,
      limit: HOME_EVENTS_PAGE_SIZE + 1,
      locale,
      sportsSportSlug,
      sportsSection,
      excludeSportsAuxiliary: true,
    })

    if (error) {
      return { data: [], error }
    }

    const candidates = firstPage ?? []
    const firstPageHasReplaceableSeries = candidates
      .slice(0, HOME_EVENTS_PAGE_SIZE)
      .some((event) => Boolean(event.series_slug?.trim()) && !isSportsPrimaryHomeEvent(event))

    if (candidates.length < HOME_EVENTS_PAGE_SIZE + 1 || !firstPageHasReplaceableSeries) {
      return {
        data: candidates,
        error: null,
      }
    }

    return loadHomeEventBatches({
      bookmarked,
      frequency,
      initialEvents: candidates,
      locale,
      mainTag,
      offset: candidates.length,
      search,
      sortBy,
      sportsSection,
      sportsSportSlug,
      status,
      tag,
      userId,
    })
  }

  return loadHomeEventBatches({
    bookmarked,
    frequency,
    locale,
    mainTag,
    offset: 0,
    search,
    sortBy,
    sportsSection,
    sportsSportSlug,
    status,
    tag,
    userId,
  })
}

export async function listHomeEventsPage({
  bookmarked,
  currentTimestamp,
  frequency = 'all',
  hideCrypto = false,
  hideEarnings = false,
  hideSports = false,
  locale,
  mainTag,
  offset = 0,
  search = '',
  sortBy,
  sportsSection = '',
  sportsSportSlug = '',
  status = 'active',
  tag,
  userId,
}: ListHomeEventsPageOptions) {
  const targetOffset = Math.max(0, offset)
  const resolvedCurrentTimestamp = currentTimestamp ?? null
  const hasHomeVisibilityFilters = hideSports || hideCrypto || hideEarnings

  const { data: rawEvents, error } = await loadHomeEventCandidates({
    bookmarked,
    frequency,
    hideCrypto,
    hideEarnings,
    hideSports,
    locale,
    mainTag,
    offset,
    search,
    sortBy,
    sportsSection,
    sportsSportSlug,
    status,
    tag,
    userId,
  })

  if (error) {
    return { data: [], error, currentTimestamp: resolvedCurrentTimestamp ?? null, hasMore: false }
  }

  let visibleEvents: Event[] = rawEvents ?? []

  if (status !== 'resolved' || hasHomeVisibilityFilters) {
    visibleEvents =
      visibleEvents.length > 0
        ? filterHomeEvents(visibleEvents, {
            currentTimestamp: resolvedCurrentTimestamp,
            hideSports,
            hideCrypto,
            hideEarnings,
            status,
          })
        : []
  }
  const pageStart = status === 'resolved' && !hasHomeVisibilityFilters ? 0 : targetOffset
  const pageEnd = pageStart + HOME_EVENTS_PAGE_SIZE

  return {
    data: visibleEvents.slice(pageStart, pageEnd),
    error: null,
    currentTimestamp: resolvedCurrentTimestamp ?? null,
    hasMore: visibleEvents.length > pageEnd,
  }
}
