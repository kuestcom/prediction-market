import type { QueryClient } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ORDER_BOOK_REFRESH_DELAY_MS, scheduleOrderBookRefresh } from '@/lib/trading-cache'

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
