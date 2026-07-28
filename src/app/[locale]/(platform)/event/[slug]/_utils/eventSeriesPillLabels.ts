interface ResolveLiveSeriesPillLabelOptions {
  dateLabel: string
  isDailySeries: boolean
  isToday: boolean
  timeLabel: string
}

export function resolveLiveSeriesPillLabel({
  dateLabel,
  isDailySeries,
  isToday,
  timeLabel,
}: ResolveLiveSeriesPillLabelOptions) {
  if (isDailySeries) {
    return dateLabel
  }

  return isToday ? timeLabel : `${timeLabel} ${dateLabel}`
}

interface SeriesPillEvent {
  id: string
  slug: string
}

export function resolveShortCadenceSeriesPillVisibility<T extends SeriesPillEvent>({
  currentEventSlug,
  currentTradingEventId,
  events,
  isShortCadence,
}: {
  currentEventSlug: string | undefined
  currentTradingEventId: string | null
  events: T[]
  isShortCadence: boolean
}) {
  if (!isShortCadence || events.length <= 2) {
    return {
      visibleEvents: events,
      overflowEvents: [] as T[],
    }
  }

  const currentEventIndex = events.findIndex(event => event.slug === currentEventSlug)
  const currentTradingEventIndex = events.findIndex(event => event.id === currentTradingEventId)
  const anchorIndex = currentEventIndex >= 0 ? currentEventIndex : Math.max(0, currentTradingEventIndex)
  const visibleStartIndex = Math.max(0, Math.min(anchorIndex - 1, events.length - 2))
  const visibleEvents = events.slice(visibleStartIndex, visibleStartIndex + 2)
  const visibleEventIds = new Set(visibleEvents.map(event => event.id))

  return {
    visibleEvents,
    overflowEvents: events.filter(event => !visibleEventIds.has(event.id)),
  }
}
