import type { QueryClient } from '@tanstack/react-query'

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  invalidateTradingPositionQueries,
  ORDER_BOOK_REFRESH_DELAY_MS,
  refreshTradingPositionsAfterMutation,
  scheduleOrderBookRefresh,
  TRADING_POSITION_REFRESH_DELAYS_MS,
} from '@/lib/trading-cache'

describe('invalidateTradingPositionQueries', () => {
  it('refreshes factual balances and positions without writing synthetic values', () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined)
    const queryClient = { invalidateQueries } as unknown as QueryClient

    invalidateTradingPositionQueries(queryClient)

    expect(invalidateQueries.mock.calls.map(([options]) => options.queryKey)).toEqual([
      ['order-panel-user-positions'],
      ['user-market-positions'],
      ['event-user-positions'],
      ['user-event-positions'],
      ['user-conditional-shares'],
      ['portfolio-value'],
    ])
  })
})

describe('refreshTradingPositionsAfterMutation', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('refreshes positions immediately and again after indexing delays', async () => {
    vi.useFakeTimers()
    const invalidateQueries = vi.fn().mockResolvedValue(undefined)
    const queryClient = { invalidateQueries } as unknown as QueryClient
    const expectedQueryKeys = [
      ['order-panel-user-positions'],
      ['user-market-positions'],
      ['event-user-positions'],
      ['user-event-positions'],
      ['user-conditional-shares'],
      ['portfolio-value'],
    ]

    refreshTradingPositionsAfterMutation(queryClient)

    expect(invalidateQueries.mock.calls.map(([options]) => options.queryKey)).toEqual(expectedQueryKeys)

    await vi.advanceTimersByTimeAsync(TRADING_POSITION_REFRESH_DELAYS_MS[0])
    expect(invalidateQueries.mock.calls.map(([options]) => options.queryKey)).toEqual([
      ...expectedQueryKeys,
      ...expectedQueryKeys,
    ])

    await vi.advanceTimersByTimeAsync(TRADING_POSITION_REFRESH_DELAYS_MS[1] - TRADING_POSITION_REFRESH_DELAYS_MS[0])
    expect(invalidateQueries.mock.calls.map(([options]) => options.queryKey)).toEqual([
      ...expectedQueryKeys,
      ...expectedQueryKeys,
      ...expectedQueryKeys,
    ])
  })
})

describe('scheduleOrderBookRefresh', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('invalidates order books one second after an orderbook mutation', async () => {
    vi.useFakeTimers()
    const invalidateQueries = vi.fn().mockResolvedValue(undefined)
    const queryClient = { invalidateQueries } as unknown as QueryClient

    scheduleOrderBookRefresh(queryClient)
    await vi.advanceTimersByTimeAsync(ORDER_BOOK_REFRESH_DELAY_MS - 1)
    expect(invalidateQueries).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['orderbook-summary'],
    })
  })
})
