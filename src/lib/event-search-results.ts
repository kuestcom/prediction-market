import type { Event } from '@/types'

function toTimestamp(value: string | null | undefined) {
  if (!value) {
    return Number.NaN
  }

  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : Number.NaN
}

function isResolvedLikeEvent(event: Pick<Event, 'status' | 'markets'>) {
  if (event.status === 'resolved') {
    return true
  }

  if (!event.markets.length) {
    return false
  }

  return event.markets.every(market => market.is_resolved || market.condition?.resolved)
}

function compareDescending(left: number, right: number) {
  if (!Number.isFinite(left) && !Number.isFinite(right)) {
    return 0
  }

  if (!Number.isFinite(left)) {
    return 1
  }

  if (!Number.isFinite(right)) {
    return -1
  }

  return right - left
}

function compareAscending(left: number, right: number) {
  if (!Number.isFinite(left) && !Number.isFinite(right)) {
    return 0
  }

  if (!Number.isFinite(left)) {
    return 1
  }

  if (!Number.isFinite(right)) {
    return -1
  }

  return left - right
}

export function compareSearchResultEvents(left: Event, right: Event) {
  const leftResolved = isResolvedLikeEvent(left)
  const rightResolved = isResolvedLikeEvent(right)

  if (leftResolved !== rightResolved) {
    return Number(leftResolved) - Number(rightResolved)
  }

  const leftResolutionDate = leftResolved
    ? toTimestamp(left.resolved_at ?? left.end_date)
    : toTimestamp(left.end_date)
  const rightResolutionDate = rightResolved
    ? toTimestamp(right.resolved_at ?? right.end_date)
    : toTimestamp(right.end_date)

  const resolutionDateComparison = leftResolved
    ? compareDescending(leftResolutionDate, rightResolutionDate)
    : compareAscending(leftResolutionDate, rightResolutionDate)

  if (resolutionDateComparison !== 0) {
    return resolutionDateComparison
  }

  return compareDescending(toTimestamp(left.created_at), toTimestamp(right.created_at))
}

export function sortSearchResultEvents(events: Event[]) {
  return [...events].sort(compareSearchResultEvents)
}
