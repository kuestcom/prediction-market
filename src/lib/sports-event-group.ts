import type { SupportedLocale } from '@/i18n/locales'
import type { Event } from '@/types'
import { EventRepository } from '@/lib/db/queries/event'
import {
  mergeSportsEventGroupMarkets,
  resolveSportsMarketsVolume,
  sumFiniteSportsValues,
} from '@/lib/sports-event-market-utils'

interface ResolveSportsEventGroupPayloadOptions {
  userId?: string
  warningLabel?: string
  resolveDisplayEvent?: (baseEvent: Event, eventsGroup: Event[]) => Event
}

export function isSportsEvent(event: Pick<Event, 'sports_sport_slug' | 'sports_event_slug' | 'sports_teams'>) {
  return Boolean(event.sports_sport_slug || event.sports_event_slug || event.sports_teams?.length)
}

function mergeSportsEventGroupPayload(
  baseEvent: Event,
  eventsGroup: Event[],
  resolveDisplayEvent?: (baseEvent: Event, eventsGroup: Event[]) => Event,
) {
  const mergedMarkets = mergeSportsEventGroupMarkets(eventsGroup)
  if (mergedMarkets.length === 0) {
    return baseEvent
  }

  const displayEvent = resolveDisplayEvent?.(baseEvent, eventsGroup) ?? baseEvent
  const totalMarketsCount = sumFiniteSportsValues(eventsGroup.map(event => event.total_markets_count))
  const activeMarketsCount = mergedMarkets.filter(
    market => market.is_active && !market.is_resolved && !market.condition?.resolved,
  ).length

  return {
    ...displayEvent,
    markets: mergedMarkets,
    volume: resolveSportsMarketsVolume(mergedMarkets),
    active_markets_count: activeMarketsCount,
    total_markets_count: totalMarketsCount > 0 ? totalMarketsCount : mergedMarkets.length,
  }
}

export async function resolveSportsEventGroupPayload(
  event: Event,
  locale: SupportedLocale,
  options: ResolveSportsEventGroupPayloadOptions = {},
) {
  if (!isSportsEvent(event)) {
    return event
  }

  const { data: sportsEventsGroup, error } = await EventRepository.getSportsEventGroupBySlug(
    event.slug,
    options.userId ?? '',
    locale,
  )
  if (error) {
    console.warn(`Failed to load ${options.warningLabel ?? 'sports event group'}:`, error)
    return event
  }
  if (!sportsEventsGroup || sportsEventsGroup.length <= 1) {
    return event
  }

  return mergeSportsEventGroupPayload(event, sportsEventsGroup, options.resolveDisplayEvent)
}
