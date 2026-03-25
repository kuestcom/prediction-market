import type { SupportedLocale } from '@/i18n/locales'
import type { EventListSortBy, EventListStatusFilter } from '@/lib/event-list-filters'
import type { Event } from '@/types'
import { EventRepository } from '@/lib/db/queries/event'
import { filterHomeEvents, HOME_EVENTS_PAGE_SIZE } from '@/lib/home-events'

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
  const targetVisibleCount = targetOffset + HOME_EVENTS_PAGE_SIZE
  const resolvedCurrentTimestamp = currentTimestamp ?? null
  let rawOffset = 0
  const accumulatedEvents: Event[] = []
  let visibleEvents: Event[] = []

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
      locale,
      sportsSportSlug,
      sportsSection,
    })

    if (error) {
      return { data: [], error, currentTimestamp: resolvedCurrentTimestamp ?? null }
    }

    const batch = rawEvents ?? []
    if (batch.length === 0) {
      break
    }

    accumulatedEvents.push(...batch)

    visibleEvents = filterHomeEvents(accumulatedEvents, {
      currentTimestamp: resolvedCurrentTimestamp ?? null,
      hideSports,
      hideCrypto,
      hideEarnings,
      status,
    })

    if (status === 'resolved' && visibleEvents.length >= targetVisibleCount) {
      break
    }

    if (batch.length < HOME_EVENTS_PAGE_SIZE) {
      break
    }

    rawOffset += HOME_EVENTS_PAGE_SIZE
  }

  return {
    data: visibleEvents.slice(targetOffset, targetOffset + HOME_EVENTS_PAGE_SIZE),
    error: null,
    currentTimestamp: resolvedCurrentTimestamp ?? null,
  }
}
