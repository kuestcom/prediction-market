import type { SupportedLocale } from '@/i18n/locales'
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
  sportsSection?: 'games' | 'props' | ''
  sportsSportSlug?: string
  status?: 'active' | 'resolved'
  tag: string
  userId: string
}

export async function listHomeEventsPage({
  bookmarked,
  currentTimestamp = null,
  frequency = 'all',
  hideCrypto = false,
  hideEarnings = false,
  hideSports = false,
  locale,
  mainTag,
  offset = 0,
  search = '',
  sportsSection = '',
  sportsSportSlug = '',
  status = 'active',
  tag,
  userId,
}: ListHomeEventsPageOptions) {
  const targetOffset = Math.max(0, offset)
  let rawOffset = 0
  const accumulatedEvents: Event[] = []

  while (true) {
    const { data: rawEvents, error } = await EventRepository.listEvents({
      tag,
      mainTag,
      search,
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
      return { data: [], error }
    }

    const batch = rawEvents ?? []
    if (batch.length === 0) {
      break
    }

    accumulatedEvents.push(...batch)

    if (batch.length < HOME_EVENTS_PAGE_SIZE) {
      break
    }

    rawOffset += HOME_EVENTS_PAGE_SIZE
  }

  const visibleEvents = filterHomeEvents(accumulatedEvents, {
    currentTimestamp,
    hideSports,
    hideCrypto,
    hideEarnings,
    status,
  })

  return {
    data: visibleEvents.slice(targetOffset, targetOffset + HOME_EVENTS_PAGE_SIZE),
    error: null,
  }
}
