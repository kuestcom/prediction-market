import type { SupportedLocale } from '@/i18n/locales'
import type { ThemeSiteIdentity } from '@/lib/theme-site-identity'
import type {
  Event,
  EventLiveChartConfig,
  EventSeriesEntry,
} from '@/types'
import { cacheTag } from 'next/cache'
import { loadMarketContextSettings } from '@/lib/ai/market-context-config'
import { cacheTags } from '@/lib/cache-tags'
import { EventRepository } from '@/lib/db/queries/event'
import {
  mergeSportsEventGroupMarkets,
  resolveSportsMarketsVolume,
  sumFiniteSportsValues,
} from '@/lib/sports-event-market-utils'
import { loadRuntimeThemeState } from '@/lib/theme-settings'
import 'server-only'

export interface EventPageContentData {
  event: Event
  marketContextEnabled: boolean
  seriesEvents: EventSeriesEntry[]
  liveChartConfig: EventLiveChartConfig | null
}

export interface EventPageShellData {
  route: Awaited<ReturnType<typeof getEventRouteBySlug>>
  title: string | null
  site: ThemeSiteIdentity
}

export async function resolveCanonicalEventSlugFromSportsPath(
  sportSlug: string,
  eventSlug: string,
  leagueSlug?: string | null,
) {
  const { data, error } = await EventRepository.getCanonicalEventSlugBySportsPath(
    sportSlug,
    eventSlug,
    leagueSlug,
  )
  if (error || !data?.slug) {
    return null
  }

  return data.slug
}

async function getEventTitleBySlug(eventSlug: string, locale: SupportedLocale) {
  const { data } = await EventRepository.getEventTitleBySlug(eventSlug, locale)
  return data?.title ?? null
}

export async function getEventRouteBySlug(eventSlug: string) {
  const { data, error } = await EventRepository.getEventRouteBySlug(eventSlug)
  if (error || !data) {
    return null
  }

  return data
}

function isSportsEvent(event: Event) {
  return Boolean(event.sports_sport_slug || event.sports_event_slug || event.sports_teams?.length)
}

function resolveMergedSportsEventPagePayload(baseEvent: Event, eventsGroup: Event[]) {
  const mergedMarkets = mergeSportsEventGroupMarkets(eventsGroup)
  if (mergedMarkets.length === 0) {
    return baseEvent
  }

  const totalMarketsCount = sumFiniteSportsValues(eventsGroup.map(event => event.total_markets_count))
  const activeMarketsCount = mergedMarkets.filter(
    market => market.is_active && !market.is_resolved && !market.condition?.resolved,
  ).length

  return {
    ...baseEvent,
    markets: mergedMarkets,
    volume: resolveSportsMarketsVolume(mergedMarkets),
    active_markets_count: activeMarketsCount,
    total_markets_count: totalMarketsCount > 0 ? totalMarketsCount : mergedMarkets.length,
  }
}

async function resolveEventPageSportsPayload(event: Event, locale: SupportedLocale) {
  if (!isSportsEvent(event)) {
    return event
  }

  const { data: sportsEventsGroup, error } = await EventRepository.getSportsEventGroupBySlug(event.slug, '', locale)
  if (error) {
    console.warn('Failed to load event page sports event group:', error)
    return event
  }
  if (!sportsEventsGroup || sportsEventsGroup.length <= 1) {
    return event
  }

  return resolveMergedSportsEventPagePayload(event, sportsEventsGroup)
}

export async function loadEventPagePublicContentData(
  eventSlug: string,
  locale: SupportedLocale,
): Promise<EventPageContentData | null> {
  'use cache'
  cacheTag(cacheTags.event(eventSlug))

  const marketContextSettings = await loadMarketContextSettings()

  const marketContextEnabled = marketContextSettings.enabled && Boolean(marketContextSettings.apiKey)

  const eventResult = await EventRepository.getEventBySlug(eventSlug, '', locale)

  const { data: rawEvent, error } = eventResult
  if (error || !rawEvent) {
    return null
  }

  const event = await resolveEventPageSportsPayload(rawEvent, locale)

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
    marketContextEnabled,
    seriesEvents,
    liveChartConfig,
  }
}

export async function loadEventPageShellData(
  eventSlug: string,
  locale: SupportedLocale,
): Promise<EventPageShellData> {
  const [route, title, runtimeTheme] = await Promise.all([
    getEventRouteBySlug(eventSlug),
    getEventTitleBySlug(eventSlug, locale),
    loadRuntimeThemeState(),
  ])

  return {
    route,
    title,
    site: runtimeTheme.site,
  }
}
