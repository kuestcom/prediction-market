import { describe, expect, it } from 'vitest'

import type { ActivityOrder } from '@/types'

import {
  MAX_EVENT_LIVE_ACTIVITY_ITEMS,
  mergeEventActivities,
  mergeEventActivityPages,
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

  it('preserves loaded page boundaries and continuation state after a refresh', () => {
    const existingActivities = Array.from({ length: 20 }, (_, index) =>
      createActivity(`existing-${index}`, `2026-08-06T12:00:${String(40 - index).padStart(2, '0')}.000Z`),
    )
    const existing = {
      pages: [existingActivities.slice(0, 10), existingActivities.slice(10)],
      pageParams: [0, 10],
    }

    const merged = mergeEventActivityPages(existing, [createActivity('live', '2026-08-06T12:00:50.000Z')])

    expect(merged?.pages.map((page) => page.length)).toEqual([10, 10])
    expect(merged?.pageParams).toBe(existing.pageParams)
    expect(merged?.pages.flat().map((activity) => activity.id)).toEqual([
      'live',
      ...existingActivities.slice(0, -1).map((activity) => activity.id),
    ])
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
