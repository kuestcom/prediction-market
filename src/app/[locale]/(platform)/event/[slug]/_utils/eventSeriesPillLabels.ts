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

export function isLiveSeriesPillStackCadence(tradingWindowMs: number) {
  return [5, 15, 60, 4 * 60].some((minutes) => tradingWindowMs === minutes * 60 * 1000)
}

export function resolveLiveSeriesPillVisibility<T extends SeriesPillEvent>({
  currentEventSlug,
  currentTradingEventId,
  events,
  shouldStack,
}: {
  currentEventSlug: string | undefined
  currentTradingEventId: string | null
  events: T[]
  shouldStack: boolean
}) {
  const currentTradingEventIndex = events.findIndex((event) => event.id === currentTradingEventId)

  if (!shouldStack || currentTradingEventIndex < 0) {
    return {
      visibleEvents: events,
      overflowEvents: [] as T[],
    }
  }

  const currentEventIndex = events.findIndex((event) => event.slug === currentEventSlug)
  const liveAndNextEvents = events.slice(currentTradingEventIndex, currentTradingEventIndex + 4)
  const selectedEvent = currentEventIndex >= 0 ? events[currentEventIndex] : null
  const visibleEventIds = new Set(liveAndNextEvents.map((event) => event.id))
  if (selectedEvent) {
    visibleEventIds.add(selectedEvent.id)
  }

  const visibleEvents = events.filter((event) => visibleEventIds.has(event.id))
  const overflowEvents = events.filter(
    (event, index) => index > currentTradingEventIndex && !visibleEventIds.has(event.id),
  )

  return {
    visibleEvents,
    overflowEvents,
  }
}
