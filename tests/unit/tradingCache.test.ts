import type { QueryClient } from '@tanstack/react-query'

import { afterEach, describe, expect, it, mock } from 'bun:test'

import {
  invalidateTradingPositionQueries,
  ORDER_BOOK_REFRESH_DELAY_MS,
  refreshTradingPositionsAfterMutation,
  scheduleOrderBookRefresh,
  TRADING_POSITION_REFRESH_DELAYS_MS,
} from '@/lib/trading-cache'

import { advanceTimersByTimeAsync, useFakeTimers, useRealTimers } from '../bun-test-helpers'

describe('invalidateTradingPositionQueries', () => {
  it('refreshes factual balances and positions without writing synthetic values', () => {
    const invalidateQueries = mock().mockResolvedValue(undefined)
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
    useRealTimers()
  })

  it('refreshes positions immediately and again after indexing delays', async () => {
    useFakeTimers()
    const invalidateQueries = mock().mockResolvedValue(undefined)
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

    await advanceTimersByTimeAsync(TRADING_POSITION_REFRESH_DELAYS_MS[0])
    expect(invalidateQueries.mock.calls.map(([options]) => options.queryKey)).toEqual([
      ...expectedQueryKeys,
      ...expectedQueryKeys,
    ])

    await advanceTimersByTimeAsync(TRADING_POSITION_REFRESH_DELAYS_MS[1] - TRADING_POSITION_REFRESH_DELAYS_MS[0])
    expect(invalidateQueries.mock.calls.map(([options]) => options.queryKey)).toEqual([
      ...expectedQueryKeys,
      ...expectedQueryKeys,
      ...expectedQueryKeys,
    ])
  })
})

describe('scheduleOrderBookRefresh', () => {
  afterEach(() => {
    useRealTimers()
  })

  it('invalidates order books one second after an orderbook mutation', async () => {
    useFakeTimers()
    const invalidateQueries = mock().mockResolvedValue(undefined)
    const queryClient = { invalidateQueries } as unknown as QueryClient

    scheduleOrderBookRefresh(queryClient)
    await advanceTimersByTimeAsync(ORDER_BOOK_REFRESH_DELAY_MS - 1)
    expect(invalidateQueries).not.toHaveBeenCalled()

    await advanceTimersByTimeAsync(1)
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['orderbook-summary'],
    })
  })
})
