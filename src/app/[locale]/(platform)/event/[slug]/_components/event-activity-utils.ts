import type { InfiniteData } from '@tanstack/react-query'

import type { ActivityOrder } from '@/types'

import { OUTCOME_INDEX } from '@/lib/constants'
import { EVENT_ACTIVITY_PAGE_SIZE } from '@/lib/data-api/trades'

export const MAX_EVENT_LIVE_ACTIVITY_ITEMS = EVENT_ACTIVITY_PAGE_SIZE * 10

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

export function mergeEventActivityPages(
  existing: InfiniteData<ActivityOrder[]> | undefined,
  latest: ActivityOrder[],
): InfiniteData<ActivityOrder[]> | undefined {
  if (latest.length === 0) {
    return existing
  }

  const merged = mergeEventActivities(latest, existing?.pages.flat() ?? [])

  if (!existing || existing.pages.length === 0) {
    return {
      pages: [merged],
      pageParams: [0],
    }
  }

  // Keep the loaded page boundaries and cursor state intact. New rows displace
  // the oldest loaded rows, which remain reachable through the next REST page.
  const retained = merged.slice(
    0,
    existing.pages.reduce((total, page) => total + page.length, 0),
  )
  const pages: ActivityOrder[][] = []
  let offset = 0
  for (const page of existing.pages) {
    pages.push(retained.slice(offset, offset + page.length))
    offset += page.length
  }

  return {
    pages,
    pageParams: existing.pageParams,
  }
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
