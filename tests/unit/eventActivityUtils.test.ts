import { describe, expect, it } from 'vitest'

import type { ActivityOrder } from '@/types'

import {
  mergeEventActivityPages,
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

  it('prepends, sorts, deduplicates, and repaginates live activity', () => {
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

    const merged = mergeEventActivityPages(existing, latest)

    expect(merged?.pages).toHaveLength(2)
    expect(merged?.pages[0]).toHaveLength(10)
    expect(merged?.pages[1]).toHaveLength(3)
    expect(merged?.pageParams).toEqual([0, 10])
    expect(merged?.pages.flat().map((activity) => activity.id)).toEqual([
      'live-newer',
      'existing-0',
      'live-older',
      ...existingActivities.slice(1).map((activity) => activity.id),
    ])
  })
})
