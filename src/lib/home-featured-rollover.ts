import type { Event, EventSeriesEntry } from '@/types'

function parseFeaturedTimestamp(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value.trim())
    ? `${value.trim().replace(' ', 'T')}Z`
    : value.trim()
  const timestamp = Date.parse(normalized)
  return Number.isFinite(timestamp) ? timestamp : null
}

export function resolveHomeFeaturedEventEndTimestamp(event: Event) {
  const timestamps = [
    parseFeaturedTimestamp(event.end_date),
    ...event.markets.map((market) => parseFeaturedTimestamp(market.end_time)),
  ].filter((timestamp): timestamp is number => timestamp != null)

  return timestamps.length > 0 ? Math.max(...timestamps) : null
}

export function findNextHomeFeaturedSeriesEvent(seriesEvents: EventSeriesEntry[], currentEvent: Event) {
  const currentEndTimestamp = resolveHomeFeaturedEventEndTimestamp(currentEvent)
  if (currentEndTimestamp == null) {
    return null
  }

  let nextEvent: EventSeriesEntry | null = null
  let nextEndTimestamp = Number.POSITIVE_INFINITY

  for (const seriesEvent of seriesEvents) {
    if (
      seriesEvent.id === currentEvent.id ||
      seriesEvent.slug === currentEvent.slug ||
      seriesEvent.status !== 'active'
    ) {
      continue
    }

    const endTimestamp = parseFeaturedTimestamp(seriesEvent.end_date)
    if (endTimestamp == null || endTimestamp <= currentEndTimestamp || endTimestamp >= nextEndTimestamp) {
      continue
    }

    nextEvent = seriesEvent
    nextEndTimestamp = endTimestamp
  }

  return nextEvent
}
