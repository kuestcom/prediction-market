import type { SupportedLocale } from '@/i18n/locales'
import type { EventListSortBy, EventListStatusFilter } from '@/lib/event-list-filters'
import type { Event } from '@/types'
import { cacheTag } from 'next/cache'
import { cacheTags } from '@/lib/cache-tags'
import { EventRepository } from '@/lib/db/queries/event'
import { filterHomeEvents, HOME_EVENTS_PAGE_SIZE } from '@/lib/home-events'

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
  'use cache'
  cacheTag(cacheTags.events(userId || 'guest'))
  cacheTag(cacheTags.eventsList)

  const targetOffset = Math.max(0, offset)
  const targetVisibleCount = targetOffset + HOME_EVENTS_PAGE_SIZE
  let rawOffset = 0
  const accumulatedEvents: Event[] = []

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
    })

    if (error) {
      return { data: [], error }
    }

    const batch = rawEvents ?? []
    if (batch.length === 0) {
      break
    }

    accumulatedEvents.push(...batch)

    if (status === 'resolved') {
      const visibleResolvedEvents = filterHomeEvents(accumulatedEvents, {
        currentTimestamp: null,
        hideSports,
        hideCrypto,
        hideEarnings,
        status,
      })

      if (visibleResolvedEvents.length >= targetVisibleCount) {
        break
      }
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

export async function listHomeEventsPage({
  currentTimestamp,
  hideCrypto = false,
  hideEarnings = false,
  hideSports = false,
  offset = 0,
  status = 'active',
  ...options
}: ListHomeEventsPageOptions) {
  const targetOffset = Math.max(0, offset)
  const resolvedCurrentTimestamp = currentTimestamp ?? null

  const { data: rawEvents, error } = await loadHomeEventCandidates({
    ...options,
    hideCrypto,
    hideEarnings,
    hideSports,
    offset,
    status,
  })

  if (error) {
    return { data: [], error, currentTimestamp: resolvedCurrentTimestamp ?? null }
  }

  const visibleEvents = (rawEvents?.length ?? 0) > 0
    ? filterHomeEvents(rawEvents ?? [], {
        currentTimestamp: resolvedCurrentTimestamp,
        hideSports,
        hideCrypto,
        hideEarnings,
        status,
      })
    : []

  return {
    data: visibleEvents.slice(targetOffset, targetOffset + HOME_EVENTS_PAGE_SIZE),
    error: null,
    currentTimestamp: resolvedCurrentTimestamp ?? null,
  }
}
