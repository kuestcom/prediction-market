import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, mock } from 'bun:test'

import { useEventMarketChanceData } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventMarketChanceData'

import { hoisted } from '../bun-test-helpers'

const mocks = hoisted(() => ({
  marketQuotes: {} as Record<string, { bid: number | null; ask: number | null; mid: number | null }>,
  priceHistory: {
    normalizedHistory: [],
    latestSnapshot: {},
    latestRawPrices: {},
  },
}))

void mock.module('@/app/[locale]/(platform)/event/[slug]/_hooks/useEventPriceHistory', () => ({
  buildMarketTargets: (markets: Array<{ condition_id: string }>) =>
    markets.map((market) => ({ conditionId: market.condition_id, tokenId: `${market.condition_id}-token` })),
  useEventPriceHistory: () => mocks.priceHistory,
}))

void mock.module('@/app/[locale]/(platform)/event/[slug]/_hooks/useEventLastTrades', () => ({
  useEventLastTrades: () => ({}),
}))

void mock.module('@/app/[locale]/(platform)/event/[slug]/_hooks/useEventMidPrices', () => ({
  useEventMarketQuotes: () => mocks.marketQuotes,
}))

describe('useEventMarketChanceData', () => {
  beforeEach(() => {
    mocks.marketQuotes = {}
  })

  it('bootstraps the chart chance from the event while CLOB history and snapshots are empty', () => {
    const event = {
      id: 'event-1',
      created_at: '2026-08-11T12:00:00.000Z',
      markets: [
        {
          condition_id: 'condition-1',
          price: 0.63,
          outcomes: [{ outcome_index: 0, token_id: 'yes-token' }],
        },
      ],
    } as any

    const { result } = renderHook(() => useEventMarketChanceData({ event, range: 'ALL' }))

    expect(result.current.displayChanceByMarket).toEqual({ 'condition-1': 63 })
  })

  it('lets a live CLOB quote replace the event bootstrap chance', () => {
    mocks.marketQuotes = {
      'condition-1': { bid: 0.67, ask: 0.69, mid: 0.68 },
    }
    const event = {
      id: 'event-1',
      created_at: '2026-08-11T12:00:00.000Z',
      markets: [
        {
          condition_id: 'condition-1',
          price: 0.63,
          outcomes: [{ outcome_index: 0, token_id: 'yes-token' }],
        },
      ],
    } as any

    const { result } = renderHook(() => useEventMarketChanceData({ event, range: 'ALL' }))

    expect(result.current.displayChanceByMarket).toEqual({ 'condition-1': 68 })
  })
})
