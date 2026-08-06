import type { ActivityOrder } from '@/types'

import { OUTCOME_INDEX } from '@/lib/constants'
import { EVENT_ACTIVITY_PAGE_SIZE } from '@/lib/data-api/trades'

export const MAX_EVENT_LIVE_ACTIVITY_ITEMS = EVENT_ACTIVITY_PAGE_SIZE * 10

export function getEventActivityQueryKey(
  eventSlug: string,
  marketKey: string,
  marketFilter: string,
  minAmountFilter: string,
) {
  return ['event-activity', 'keyset-v1', eventSlug, marketKey, marketFilter, minAmountFilter] as const
}

export function mergeEventActivities(latest: ActivityOrder[], existing: ActivityOrder[]) {
  const seen = new Set<string>()
  const deduped: ActivityOrder[] = []

  for (const item of [...latest, ...existing]) {
    if (seen.has(item.id)) {
      continue
    }
    seen.add(item.id)
    deduped.push(item)
  }

  return deduped.sort((first, second) => new Date(second.created_at).getTime() - new Date(first.created_at).getTime())
}

export function mergeEventLiveActivities(current: ActivityOrder[], latest: ActivityOrder[]) {
  return mergeEventActivities(latest, current).slice(0, MAX_EVENT_LIVE_ACTIVITY_ITEMS)
}

export interface EventActivityPageParam {
  cursorTimestamp?: number
  cursorId?: string
  cursorUser?: string
}

export function getNextEventActivityPageParam(lastPage: ActivityOrder[]): EventActivityPageParam | undefined {
  if (lastPage.length !== EVENT_ACTIVITY_PAGE_SIZE) {
    return undefined
  }

  const lastActivity = lastPage.at(-1)
  const cursorTimestamp = lastActivity ? Math.floor(new Date(lastActivity.created_at).getTime() / 1000) : Number.NaN
  const cursorId = lastActivity?.event_id?.trim() || lastActivity?.id.trim()
  const cursorUser = lastActivity?.user.address.trim().toLowerCase()

  if (!Number.isFinite(cursorTimestamp) || !cursorId || !cursorUser) {
    return undefined
  }

  return { cursorTimestamp, cursorId, cursorUser }
}

export function resolveEventActivityOutcomeColorClass(
  activity: Pick<ActivityOrder, 'outcome'>,
  isSportsEvent: boolean,
) {
  if (isSportsEvent) {
    return 'text-primary'
  }

  const outcomeTokens = new Set(
    (activity.outcome.text || '')
      .trim()
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean),
  )
  const isNegativeOutcomeText = outcomeTokens.has('no') || outcomeTokens.has('down') || outcomeTokens.has('false')
  const isPositiveOutcomeText = outcomeTokens.has('yes') || outcomeTokens.has('up') || outcomeTokens.has('true')

  if (isNegativeOutcomeText && !isPositiveOutcomeText) {
    return 'text-no'
  }
  if (isPositiveOutcomeText && !isNegativeOutcomeText) {
    return 'text-yes'
  }

  return activity.outcome.index === OUTCOME_INDEX.NO ? 'text-no' : 'text-yes'
}
