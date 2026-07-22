import type { EventLiveChartConfig } from '@/types'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLiveSeriesPriceSnapshot } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useLiveSeriesPriceSnapshot'

describe('useLiveSeriesPriceSnapshot', () => {
  let now: number

  beforeEach(() => {
    now = 1_800_000_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
    window.localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('requests a current snapshot again when a live tab becomes visible', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        opening_price: 100,
        latest_price: 101,
        latest_source_timestamp_ms: now,
        event_window_end_ms: now,
      }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const config = {
      series_slug: 'snapshot-resume-test',
      topic: 'crypto_prices',
      active_window_minutes: 60,
    } as EventLiveChartConfig

    renderHook(() => useLiveSeriesPriceSnapshot({
      config,
      subscriptionSymbol: 'BTC',
      explicitEndTimestamp: null,
      startTimestamp: null,
    }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const firstUrl = new URL(String(fetchMock.mock.calls[0]?.[0]), window.location.origin)
    expect(firstUrl.searchParams.get('eventEndMs')).toBe(String(now))

    now += 2 * 60 * 60 * 1000
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    const resumedUrl = new URL(String(fetchMock.mock.calls[1]?.[0]), window.location.origin)
    expect(resumedUrl.searchParams.get('eventEndMs')).toBe(String(now))
  })

  it('exposes loading and unavailable states before a reference snapshot is confirmed', async () => {
    let resolveFetch: ((value: { ok: boolean }) => void) | null = null
    const fetchMock = vi.fn(() => new Promise<{ ok: boolean }>((resolve) => {
      resolveFetch = resolve
    }))
    vi.stubGlobal('fetch', fetchMock)

    const config = {
      series_slug: 'snapshot-status-test',
      topic: 'crypto_prices_chainlink',
      active_window_minutes: 1440,
    } as EventLiveChartConfig

    const { result } = renderHook(() => useLiveSeriesPriceSnapshot({
      config,
      subscriptionSymbol: 'BTC',
      explicitEndTimestamp: now - 1000,
      startTimestamp: null,
    }))

    expect(result.current.referenceSnapshotStatus).toBe('loading')
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    await act(async () => {
      resolveFetch?.({ ok: false })
    })

    await waitFor(() => expect(result.current.referenceSnapshotStatus).toBe('unavailable'))
    expect(result.current.referenceSnapshot).toBeNull()
  })
})
