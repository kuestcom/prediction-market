import type { SupportedLocale } from '@/i18n/locales'
import type {
  ConditionChangeLogEntry,
  Event,
  EventLiveChartConfig,
  EventSeriesEntry,
  User,
} from '@/types'
import { cacheTag } from 'next/cache'
import { connection } from 'next/server'
import { loadMarketContextSettings } from '@/lib/ai/market-context-config'
import { cacheTags } from '@/lib/cache-tags'
import { EventRepository } from '@/lib/db/queries/event'
import { UserRepository } from '@/lib/db/queries/user'
import 'server-only'

export interface EventPageContentData {
  event: Event
  user: User | null
  marketContextEnabled: boolean
  changeLogEntries: ConditionChangeLogEntry[]
  seriesEvents: EventSeriesEntry[]
  liveChartConfig: EventLiveChartConfig | null
}

export async function resolveCanonicalEventSlugFromSportsPath(sportSlug: string, eventSlug: string) {
  'use cache'
  cacheTag(cacheTags.eventsGlobal)

  const { data, error } = await EventRepository.getCanonicalEventSlugBySportsPath(sportSlug, eventSlug)
  if (error || !data?.slug) {
    return null
  }

  return data.slug
}

export async function getEventTitleBySlug(eventSlug: string, locale: SupportedLocale) {
  'use cache'
  cacheTag(cacheTags.eventsGlobal)
  cacheTag(cacheTags.event(eventSlug))

  const { data } = await EventRepository.getEventTitleBySlug(eventSlug, locale)
  return data?.title
}

export async function getEventRouteBySlug(eventSlug: string) {
  'use cache'
  cacheTag(cacheTags.eventsGlobal)
  cacheTag(cacheTags.event(eventSlug))

  const { data, error } = await EventRepository.getEventRouteBySlug(eventSlug)
  if (error || !data) {
    return null
  }

  return data
}

export async function loadEventPageContentData(
  eventSlug: string,
  locale: SupportedLocale,
): Promise<EventPageContentData | null> {
  await connection()

  const [user, marketContextSettings] = await Promise.all([
    UserRepository.getCurrentUser(),
    loadMarketContextSettings(),
  ])

  const marketContextEnabled = marketContextSettings.enabled && Boolean(marketContextSettings.apiKey)

  const [eventResult, changeLogResult] = await Promise.all([
    EventRepository.getEventBySlug(eventSlug, user?.id ?? '', locale),
    EventRepository.getEventConditionChangeLogBySlug(eventSlug),
  ])

  const { data: event, error } = eventResult
  if (error || !event) {
    return null
  }

  if (changeLogResult.error) {
    console.warn('Failed to load event change log:', changeLogResult.error)
  }

  let seriesEvents: EventSeriesEntry[] = []
  let liveChartConfig: EventLiveChartConfig | null = null

  if (event.series_slug) {
    const [seriesEventsResult, liveChartConfigResult] = await Promise.all([
      EventRepository.getSeriesEventsBySeriesSlug(event.series_slug),
      EventRepository.getLiveChartConfigBySeriesSlug(event.series_slug),
    ])

    if (seriesEventsResult.error) {
      console.warn('Failed to load event series events:', seriesEventsResult.error)
    }
    else {
      seriesEvents = seriesEventsResult.data ?? []
    }

    if (liveChartConfigResult.error) {
      console.warn('Failed to load event live chart config:', liveChartConfigResult.error)
    }
    else {
      liveChartConfig = liveChartConfigResult.data ?? null
    }
  }

  if (event.series_slug && !seriesEvents.some(seriesEvent => seriesEvent.slug === event.slug)) {
    seriesEvents = [
      {
        id: event.id,
        slug: event.slug,
        status: event.status,
        end_date: event.end_date,
        resolved_at: event.resolved_at ?? null,
        created_at: event.created_at,
        resolved_direction: null,
      },
      ...seriesEvents,
    ]
  }

  return {
    event,
    user,
    marketContextEnabled,
    changeLogEntries: changeLogResult.data ?? [],
    seriesEvents,
    liveChartConfig,
  }
}
