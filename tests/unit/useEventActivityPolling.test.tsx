import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, mock, jest } from 'bun:test'

import type { ActivityOrder } from '@/types'

import {
  EVENT_ACTIVITY_POLL_INTERVAL_MS,
  useEventActivityPolling,
} from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventActivityPolling'
import * as actualTrades from '@/lib/data-api/trades'
import { EVENT_ACTIVITY_REFRESH_SIZE, fetchEventTrades } from '@/lib/data-api/trades'

import { advanceTimersByTimeAsync, mocked, useFakeTimers, useRealTimers } from '../bun-test-helpers'

void mock.module('@/lib/data-api/trades', () => {
  return {
    ...actualTrades,
    fetchEventTrades: mock(),
  }
})

const fetchEventTradesMock = mocked(fetchEventTrades)

describe('useEventActivityPolling', () => {
  const hiddenDescriptor = Object.getOwnPropertyDescriptor(document, 'hidden')

  beforeEach(() => {
    useFakeTimers()
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
  })

  afterEach(() => {
    useRealTimers()
    jest.clearAllMocks()
    if (hiddenDescriptor) {
      Object.defineProperty(document, 'hidden', hiddenDescriptor)
    } else {
      Reflect.deleteProperty(document, 'hidden')
    }
  })

  it('skips polling during pagination and performs one bounded request afterward', async () => {
    const activities: ActivityOrder[] = []
    fetchEventTradesMock.mockResolvedValue(activities)
    const onActivities = mock()
    const marketIds = ['condition-1']
    const { rerender, unmount } = renderHook(
      ({ isActivityQueryFetching }) =>
        useEventActivityPolling({
          hasMarkets: true,
          isActivityQueryFetching,
          marketIds,
          minAmountFilter: 'none',
          onActivities,
        }),
      { initialProps: { isActivityQueryFetching: true } },
    )

    await act(async () => {
      await advanceTimersByTimeAsync(EVENT_ACTIVITY_POLL_INTERVAL_MS)
    })
    expect(fetchEventTradesMock).not.toHaveBeenCalled()

    rerender({ isActivityQueryFetching: false })
    await act(async () => {
      await advanceTimersByTimeAsync(EVENT_ACTIVITY_POLL_INTERVAL_MS)
    })

    expect(fetchEventTradesMock).toHaveBeenCalledOnce()
    expect(fetchEventTradesMock).toHaveBeenCalledWith({
      marketIds,
      pageParam: 0,
      pageSize: EVENT_ACTIVITY_REFRESH_SIZE,
      minAmountFilter: 'none',
      start: expect.any(Number),
      signal: expect.any(AbortSignal),
    })
    expect(onActivities).toHaveBeenCalledWith(activities)

    unmount()
  })

  it('skips regular polling while the document is hidden', async () => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    const { unmount } = renderHook(() =>
      useEventActivityPolling({
        hasMarkets: true,
        isActivityQueryFetching: false,
        marketIds: ['condition-1'],
        minAmountFilter: 'none',
        onActivities: mock(),
      }),
    )

    await act(async () => {
      await advanceTimersByTimeAsync(EVENT_ACTIVITY_POLL_INTERVAL_MS)
    })

    expect(fetchEventTradesMock).not.toHaveBeenCalled()
    unmount()
  })

  it('refreshes immediately without start when the document becomes visible', async () => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    fetchEventTradesMock.mockResolvedValue([])
    const { unmount } = renderHook(() =>
      useEventActivityPolling({
        hasMarkets: true,
        isActivityQueryFetching: false,
        marketIds: ['condition-1'],
        minAmountFilter: 'none',
        onActivities: mock(),
      }),
    )

    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
      await Promise.resolve()
    })

    expect(fetchEventTradesMock).toHaveBeenCalledOnce()
    expect(fetchEventTradesMock.mock.calls[0]?.[0]).not.toHaveProperty('start')
    unmount()
  })

  it('refreshes immediately without start after the browser comes online', async () => {
    fetchEventTradesMock.mockResolvedValue([])
    const { unmount } = renderHook(() =>
      useEventActivityPolling({
        hasMarkets: true,
        isActivityQueryFetching: false,
        marketIds: ['condition-1'],
        minAmountFilter: 'none',
        onActivities: mock(),
      }),
    )

    await act(async () => {
      window.dispatchEvent(new Event('online'))
      await Promise.resolve()
    })

    expect(fetchEventTradesMock).toHaveBeenCalledOnce()
    expect(fetchEventTradesMock.mock.calls[0]?.[0]).not.toHaveProperty('start')
    unmount()
  })

  it('aborts its independent refresh request when unmounted', async () => {
    fetchEventTradesMock.mockImplementation(() => new Promise(() => undefined))
    const { unmount } = renderHook(() =>
      useEventActivityPolling({
        hasMarkets: true,
        isActivityQueryFetching: false,
        marketIds: ['condition-1'],
        minAmountFilter: 'none',
        onActivities: mock(),
      }),
    )

    await act(async () => {
      await advanceTimersByTimeAsync(EVENT_ACTIVITY_POLL_INTERVAL_MS)
    })
    const signal = fetchEventTradesMock.mock.calls[0]?.[0].signal
    expect(signal?.aborted).toBe(false)

    unmount()
    expect(signal?.aborted).toBe(true)
  })
})
