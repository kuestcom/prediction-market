import type { InfiniteData } from '@tanstack/react-query'

import type { ActivityOrder } from '@/types'

import { OUTCOME_INDEX } from '@/lib/constants'
import { EVENT_ACTIVITY_PAGE_SIZE } from '@/lib/data-api/trades'

export function mergeEventActivityPages(
  existing: InfiniteData<ActivityOrder[]> | undefined,
  latest: ActivityOrder[],
): InfiniteData<ActivityOrder[]> | undefined {
  if (latest.length === 0) {
    return existing
  }

  const sortedLatest = [...latest].sort(
    (first, second) => new Date(second.created_at).getTime() - new Date(first.created_at).getTime(),
  )
  const merged = [...sortedLatest, ...(existing?.pages.flat() ?? [])]
  const seen = new Set<string>()
  const deduped: ActivityOrder[] = []

  for (const item of merged) {
    if (seen.has(item.id)) {
      continue
    }
    seen.add(item.id)
    deduped.push(item)
  }

  const pages: ActivityOrder[][] = []
  for (let index = 0; index < deduped.length; index += EVENT_ACTIVITY_PAGE_SIZE) {
    pages.push(deduped.slice(index, index + EVENT_ACTIVITY_PAGE_SIZE))
  }

  return {
    pages,
    pageParams: pages.map((_, index) => index * EVENT_ACTIVITY_PAGE_SIZE),
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
