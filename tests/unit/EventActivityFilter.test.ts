import { describe, expect, it } from 'bun:test'

import type { ActivityOrder } from '@/types'

import { filterActivitiesByMinAmount } from '@/lib/activity/filter'
import { MICRO_UNIT } from '@/lib/constants'

function createActivity(overrides: Partial<ActivityOrder> = {}): ActivityOrder {
  return {
    id: overrides.id ?? 'order-1',
    user: overrides.user ?? {
      id: 'user-1',
      username: 'user',
      address: '0xabc',
      image: 'https://avatar.vercel.sh/user.png',
    },
    side: overrides.side ?? 'buy',
    amount: overrides.amount ?? MICRO_UNIT.toString(),
    price: overrides.price ?? '0.5',
    outcome: overrides.outcome ?? { index: 0, text: 'Yes' },
    market: overrides.market ?? {
      title: 'Mock Market',
      slug: 'mock-market',
      icon_url: '',
    },
    total_value: overrides.total_value ?? 0,
    created_at: overrides.created_at ?? new Date().toISOString(),
    status: overrides.status ?? 'matched',
  }
}

describe('filterActivitiesByMinAmount', () => {
  it('retains trades whose USD total meets the threshold even when the share amount is small', () => {
    const trades = [
      createActivity({
        id: 'high-prob',
        amount: (1.5 * 1e6).toString(),
        price: '0.92',
        total_value: 12.5 * 1e6,
      }),
      createActivity({
        id: 'low',
        amount: (5 * 1e6).toString(),
        price: '0.5',
        total_value: 5 * 1e6,
      }),
    ]

    const filtered = filterActivitiesByMinAmount(trades, 10 * 1e6)

    expect(filtered).toHaveLength(1)
    expect(filtered[0].id).toBe('high-prob')
  })

  it('excludes trades whose USD total is below the threshold', () => {
    const trades = [
      createActivity({ id: 'small-1', total_value: 3 * 1e6 }),
      createActivity({ id: 'small-2', total_value: 7 * 1e6 }),
      createActivity({ id: 'large', total_value: 25 * 1e6 }),
    ]

    const filtered = filterActivitiesByMinAmount(trades, 10 * 1e6)

    expect(filtered.map((trade) => trade.id)).toEqual(['large'])
  })

  it('returns the original list when no minAmount is provided', () => {
    const trades = [
      createActivity({ id: 'a', total_value: 2 * 1e6 }),
      createActivity({ id: 'b', total_value: 4 * 1e6 }),
    ]

    expect(filterActivitiesByMinAmount(trades)).toEqual(trades)
    expect(filterActivitiesByMinAmount(trades, 0)).toEqual(trades)
  })
})
