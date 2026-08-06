import { InfiniteQueryObserver, QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import type { ActivityOrder } from '@/types'

import {
  getNextEventActivityPageParam,
  MAX_EVENT_LIVE_ACTIVITY_ITEMS,
  mergeEventActivities,
  mergeEventLiveActivities,
  resolveEventActivityOutcomeColorClass,
} from '@/app/[locale]/(platform)/event/[slug]/_components/event-activity-utils'
import { OUTCOME_INDEX } from '@/lib/constants'

function createActivityOutcome(index: number, text: string) {
  return {
    outcome: {
      index,
      text,
    },
  }
}

function createActivity(id: string, createdAt: string): ActivityOrder {
  return {
    id,
    user: {
      id: 'user',
      username: 'user',
      address: '0x123',
      image: '',
    },
    side: 'buy',
    amount: '1000000',
    price: '0.5',
    outcome: {
      index: 0,
      text: 'Yes',
    },
    market: {
      condition_id: 'condition',
      title: 'Market',
      slug: 'market',
      icon_url: '',
    },
    total_value: 500000,
    created_at: createdAt,
    status: 'completed',
  }
}

describe('resolveEventActivityOutcomeColorClass', () => {
  it('colors the first binary outcome green even when the label is not Yes', () => {
    expect(resolveEventActivityOutcomeColorClass(createActivityOutcome(OUTCOME_INDEX.YES, 'Up'), false)).toBe(
      'text-yes',
    )
  })

  it('colors the second binary outcome red', () => {
    expect(resolveEventActivityOutcomeColorClass(createActivityOutcome(OUTCOME_INDEX.NO, 'Down'), false)).toBe(
      'text-no',
    )
  })

  it('keeps sports activity neutral', () => {
    expect(resolveEventActivityOutcomeColorClass(createActivityOutcome(OUTCOME_INDEX.YES, 'Home'), true)).toBe(
      'text-primary',
    )
  })

  it('merges live activity for display without changing the query pages', () => {
    const existingActivities = Array.from({ length: 11 }, (_, index) =>
      createActivity(`existing-${index}`, `2026-08-06T12:00:${String(20 - index).padStart(2, '0')}.000Z`),
    )
    const existing = {
      pages: [existingActivities.slice(0, 10), existingActivities.slice(10)],
      pageParams: [0, 10],
    }
    const latest = [
      createActivity('live-older', '2026-08-06T12:00:30.000Z'),
      createActivity('existing-0', '2026-08-06T12:00:31.000Z'),
      createActivity('live-newer', '2026-08-06T12:00:32.000Z'),
    ]

    const merged = mergeEventActivities(latest, existing.pages.flat())

    expect(merged.map((activity) => activity.id)).toEqual([
      'live-newer',
      'existing-0',
      'live-older',
      ...existingActivities.slice(1).map((activity) => activity.id),
    ])
  })

  it('reopens continuation when a refetched final page becomes full', () => {
    const firstPage = Array.from({ length: 10 }, (_, index) =>
      createActivity(`first-${index}`, new Date(Date.UTC(2026, 7, 6, 12, 0, index)).toISOString()),
    )
    const finalPage = Array.from({ length: 10 }, (_, index) =>
      createActivity(`final-${index}`, new Date(Date.UTC(2026, 7, 6, 11, 0, index)).toISOString()),
    )

    expect(getNextEventActivityPageParam(finalPage.slice(0, 3), [firstPage, finalPage.slice(0, 3)])).toBeUndefined()
    expect(getNextEventActivityPageParam(finalPage, [firstPage, finalPage])).toBe(20)
  })

  it('rebases every loaded offset before continuing after the dataset grows', async () => {
    const original = Array.from({ length: 13 }, (_, index) =>
      createActivity(`original-${index}`, new Date(Date.UTC(2026, 7, 6, 11, 0, 12 - index)).toISOString()),
    )
    const burst = Array.from({ length: 15 }, (_, index) =>
      createActivity(`burst-${index}`, new Date(Date.UTC(2026, 7, 6, 12, 0, 14 - index)).toISOString()),
    )
    let dataset = original
    const requestedOffsets: number[] = []
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const observer = new InfiniteQueryObserver(queryClient, {
      queryKey: ['event-activity-pagination-test'],
      queryFn: ({ pageParam }) => {
        const offset = Number(pageParam)
        requestedOffsets.push(offset)
        return Promise.resolve(dataset.slice(offset, offset + 10))
      },
      initialPageParam: 0,
      getNextPageParam: getNextEventActivityPageParam,
    })

    await observer.refetch()
    await observer.fetchNextPage()
    expect(observer.getCurrentResult().data?.pages.map((page) => page.length)).toEqual([10, 3])
    expect(observer.getCurrentResult().hasNextPage).toBe(false)

    dataset = [...burst, ...original]
    requestedOffsets.length = 0
    await observer.refetch()

    expect(requestedOffsets).toEqual([0, 10])
    expect(
      observer
        .getCurrentResult()
        .data?.pages.flat()
        .map((activity) => activity.id),
    ).toEqual(dataset.slice(0, 20).map((activity) => activity.id))
    expect(observer.getCurrentResult().hasNextPage).toBe(true)

    await observer.fetchNextPage()
    expect(requestedOffsets.at(-1)).toBe(20)
    expect(
      observer
        .getCurrentResult()
        .data?.pages.flat()
        .map((activity) => activity.id),
    ).toEqual(dataset.map((activity) => activity.id))

    queryClient.clear()
  })

  it('keeps matching live activity beyond the first page available for filtering', () => {
    const latest = Array.from({ length: MAX_EVENT_LIVE_ACTIVITY_ITEMS }, (_, index) =>
      createActivity(`live-${index}`, new Date(Date.UTC(2026, 7, 6, 12, 0, index)).toISOString()),
    )
    latest[10].market.condition_id = 'matching-market'

    const merged = mergeEventLiveActivities([], latest)
    const matching = merged.filter((activity) => activity.market.condition_id === 'matching-market')

    expect(merged).toHaveLength(MAX_EVENT_LIVE_ACTIVITY_ITEMS)
    expect(matching.map((activity) => activity.id)).toEqual(['live-10'])
  })
})
