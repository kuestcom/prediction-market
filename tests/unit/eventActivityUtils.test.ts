import { InfiniteQueryObserver, QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'bun:test'

import type { ActivityOrder } from '@/types'

import {
  type EventActivityPageParam,
  getEventActivityQueryKey,
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

describe('getEventActivityQueryKey', () => {
  it('keeps prefix invalidation working while versioning the cache shape', () => {
    const queryClient = new QueryClient()
    const queryKey = getEventActivityQueryKey('event', 'market', 'all', 'none')
    queryClient.setQueryData(queryKey, [])

    expect(queryKey).toEqual(['event-activity', 'keyset-v1', 'event', 'market', 'all', 'none'])
    expect(queryClient.getQueryCache().findAll({ queryKey: ['event-activity'] })).toHaveLength(1)

    queryClient.clear()
  })
})

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
    const latest = [
      createActivity('live-older', '2026-08-06T12:00:30.000Z'),
      createActivity('existing-0', '2026-08-06T12:00:31.000Z'),
      createActivity('live-newer', '2026-08-06T12:00:32.000Z'),
    ]

    const merged = mergeEventActivities(latest, existingActivities)

    expect(merged.map((activity) => activity.id)).toEqual([
      'live-newer',
      'existing-0',
      'live-older',
      ...existingActivities.slice(1).map((activity) => activity.id),
    ])
  })

  it('uses the last activity timestamp and id as the continuation cursor', () => {
    const createdAt = new Date(Date.UTC(2026, 7, 6, 12, 0, 0)).toISOString()
    const page = Array.from({ length: 10 }, (_, index) =>
      createActivity(`fill-${String(9 - index).padStart(2, '0')}`, createdAt),
    )

    expect(getNextEventActivityPageParam(page.slice(0, 3))).toBeUndefined()
    expect(getNextEventActivityPageParam(page)).toEqual({
      cursorTimestamp: Date.UTC(2026, 7, 6, 12, 0, 0) / 1000,
      cursorId: 'fill-00',
      cursorUser: '0x123',
    })
  })

  it('does not lose or repeat trades when new activity shares the cursor second', async () => {
    const createdAt = new Date(Date.UTC(2026, 7, 6, 11, 0, 0)).toISOString()
    const cursorTimestamp = Date.UTC(2026, 7, 6, 11, 0, 0) / 1000
    const original = Array.from({ length: 25 }, (_, index) =>
      createActivity(`fill-${String(24 - index).padStart(2, '0')}`, createdAt),
    )
    const burst = Array.from({ length: 15 }, (_, index) =>
      createActivity(`fill-${String(39 - index).padStart(2, '0')}`, createdAt),
    )
    let dataset = original
    const requestedPageParams: EventActivityPageParam[] = []
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const observer = new InfiniteQueryObserver(queryClient, {
      queryKey: ['event-activity-pagination-test'],
      queryFn: ({ pageParam }) => {
        requestedPageParams.push({ ...pageParam })
        const page = dataset.filter((activity) => {
          if (pageParam.cursorTimestamp === undefined || !pageParam.cursorId || !pageParam.cursorUser) {
            return true
          }

          const timestamp = Math.floor(new Date(activity.created_at).getTime() / 1000)
          return (
            timestamp < pageParam.cursorTimestamp ||
            (timestamp === pageParam.cursorTimestamp &&
              (activity.id < pageParam.cursorId ||
                (activity.id === pageParam.cursorId && activity.user.address < pageParam.cursorUser)))
          )
        })
        return Promise.resolve(page.slice(0, 10))
      },
      initialPageParam: {},
      getNextPageParam: getNextEventActivityPageParam,
    })

    await observer.refetch()
    dataset = [...burst, ...original]
    await observer.fetchNextPage()
    await observer.fetchNextPage()

    expect(requestedPageParams).toEqual([
      {},
      { cursorTimestamp, cursorId: 'fill-15', cursorUser: '0x123' },
      { cursorTimestamp, cursorId: 'fill-05', cursorUser: '0x123' },
    ])
    expect(
      observer
        .getCurrentResult()
        .data?.pages.flat()
        .map((activity) => activity.id),
    ).toEqual(original.map((activity) => activity.id))
    expect(observer.getCurrentResult().hasNextPage).toBe(false)

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
