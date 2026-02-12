import type { Event } from '@/types'

const MS_IN_MINUTE = 60_000
const MS_IN_HOUR = 3_600_000
const MS_IN_DAY = 86_400_000

export const EVENT_NEW_BADGE_WINDOW_MS_DEFAULT = 24 * MS_IN_HOUR
export const EVENT_NEW_BADGE_WINDOW_MS_DAILY = 2 * MS_IN_HOUR
export const EVENT_NEW_BADGE_WINDOW_MS_SUB_HOURLY = 10 * MS_IN_MINUTE

type EventNewBadgeInput = Pick<Event, 'status' | 'series_recurrence' | 'created_at'> & {
  markets: Array<Pick<Event['markets'][number], 'created_at'>>
}

function parseRecurrenceToMs(seriesRecurrence: string | null | undefined): number | null {
  const normalized = seriesRecurrence?.trim().toLowerCase()
  if (!normalized) {
    return null
  }

  if (normalized === 'hourly') {
    return MS_IN_HOUR
  }

  if (normalized === 'daily') {
    return MS_IN_DAY
  }

  if (normalized === 'weekly') {
    return 7 * MS_IN_DAY
  }

  if (normalized === 'monthly') {
    return 30 * MS_IN_DAY
  }

  const match = normalized.match(/(\d+)\s*([a-z]+)\b/)
  if (!match) {
    return null
  }

  const amount = Number.parseInt(match[1] ?? '', 10)
  if (!Number.isFinite(amount) || amount <= 0) {
    return null
  }

  const unitToken = match[2]
  if (!unitToken) {
    return null
  }

  const unit = unitToken.toLowerCase()

  if (['m', 'min', 'mins', 'minute', 'minutes'].includes(unit)) {
    return amount * MS_IN_MINUTE
  }

  if (['h', 'hr', 'hrs', 'hour', 'hours'].includes(unit)) {
    return amount * MS_IN_HOUR
  }

  if (!['d', 'day', 'days'].includes(unit)) {
    return null
  }

  return amount * MS_IN_DAY
}

function getReferenceCreatedAtMs(event: EventNewBadgeInput): number | null {
  const marketCreatedAtValues = event.markets
    .map(market => new Date(market.created_at).getTime())
    .filter(timestamp => Number.isFinite(timestamp))

  if (marketCreatedAtValues.length > 0) {
    return Math.max(...marketCreatedAtValues)
  }

  const eventCreatedAt = new Date(event.created_at).getTime()
  return Number.isFinite(eventCreatedAt) ? eventCreatedAt : null
}

function getNewBadgeWindowMs(seriesRecurrence: string | null | undefined): number {
  const recurrenceMs = parseRecurrenceToMs(seriesRecurrence)

  if (recurrenceMs !== null && recurrenceMs < MS_IN_HOUR) {
    return EVENT_NEW_BADGE_WINDOW_MS_SUB_HOURLY
  }

  if (recurrenceMs === MS_IN_DAY || seriesRecurrence?.trim().toLowerCase() === 'daily') {
    return EVENT_NEW_BADGE_WINDOW_MS_DAILY
  }

  return EVENT_NEW_BADGE_WINDOW_MS_DEFAULT
}

export function shouldShowEventNewBadge(event: EventNewBadgeInput, currentTime: number = Date.now()) {
  if (event.status !== 'active') {
    return false
  }

  const referenceCreatedAt = getReferenceCreatedAtMs(event)
  if (referenceCreatedAt === null) {
    return false
  }

  const ageMs = Math.max(0, currentTime - referenceCreatedAt)
  return ageMs <= getNewBadgeWindowMs(event.series_recurrence)
}
