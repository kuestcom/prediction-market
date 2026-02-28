import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMarketSearch } from '@/hooks/useMarketSearch'

const MOCK_MARKETS = [
  {
    id: '1',
    slug: 'will-btc-reach-100k',
    question: 'Will BTC reach $100k by end of 2025?',
    probability: 0.72,
    closeTime: '2025-12-31T00:00:00Z',
    volumeUsdc: 500000,
    active: true,
    category: 'Crypto',
  },
  {
    id: '2',
    slug: 'will-eth-flip-btc',
    question: 'Will ETH flip BTC in market cap?',
    probability: 0.18,
    closeTime: '2025-06-30T00:00:00Z',
    volumeUsdc: 120000,
    active: true,
    category: 'Crypto',
  },
]

function mockFetch(body: unknown, ok = true) {
  globalThis.fetch = vi.fn().mockResolvedValueOnce({
    ok,
    statusText: ok ? 'OK' : 'Internal Server Error',
    json: () => Promise.resolve(body),
  } as Response)
}

describe('useMarketSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('returns empty results for a query shorter than minLength', () => {
    const { result } = renderHook(() => useMarketSearch('bt'))
    expect(result.current.results).toHaveLength(0)
    expect(result.current.isLoading).toBe(false)
    expect(globalThis.fetch).toBeUndefined()
  })

  it('shows loading state while debounce is pending', () => {
    mockFetch(MOCK_MARKETS)
    const { result } = renderHook(() => useMarketSearch('btc'))
    expect(result.current.isLoading).toBe(true)
    expect(result.current.results).toHaveLength(0)
  })

  it('returns results after debounce fires', async () => {
    mockFetch(MOCK_MARKETS)
    const { result } = renderHook(() =>
      useMarketSearch('crypto', { debounceMs: 350 }),
    )

    vi.advanceTimersByTime(350)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
      expect(result.current.results).toHaveLength(2)
    })

    expect(result.current.results[0]).toMatchObject({
      id: '1',
      slug: 'will-btc-reach-100k',
      probability: 0.72,
      volumeUsdc: 500000,
    })
  })

  it('sets error state on fetch failure', async () => {
    mockFetch(null, false)
    const { result } = renderHook(() =>
      useMarketSearch('fail', { debounceMs: 0 }),
    )

    vi.advanceTimersByTime(0)

    await waitFor(() => {
      expect(result.current.error).toBe('Search failed. Please try again.')
      expect(result.current.results).toHaveLength(0)
    })
  })

  it('clear() resets all state', async () => {
    mockFetch(MOCK_MARKETS)
    const { result } = renderHook(() =>
      useMarketSearch('crypto', { debounceMs: 0 }),
    )

    vi.advanceTimersByTime(0)
    await waitFor(() => expect(result.current.results).toHaveLength(2))

    result.current.clear()

    await waitFor(() => {
      expect(result.current.results).toHaveLength(0)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
    })
  })

  it('cancels previous request when query changes before debounce fires', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_MARKETS),
    } as Response)
    globalThis.fetch = fetchSpy

    const { rerender } = renderHook(
      ({ query }: { query: string }) =>
        useMarketSearch(query, { debounceMs: 350 }),
      { initialProps: { query: 'btc' } },
    )

    rerender({ query: 'eth' })
    vi.advanceTimersByTime(350)

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
  })
})
