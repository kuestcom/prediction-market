import { afterEach, describe, expect, it, vi } from 'vitest'

import { EVENT_ACTIVITY_REFRESH_SIZE, fetchEventTrades } from '@/lib/data-api/trades'

describe('fetchEventTrades', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('requests a bounded page within the historical snapshot', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await fetchEventTrades({
      marketIds: ['condition-1'],
      pageParam: 10,
      pageSize: EVENT_ACTIVITY_REFRESH_SIZE,
      endTimestamp: 1_786_017_600,
    })

    const requestUrl = new URL(String(fetchMock.mock.calls[0]?.[0]), 'https://example.com')
    expect(requestUrl.pathname).toBe('/api/event-activity')
    expect(Object.fromEntries(requestUrl.searchParams)).toEqual({
      end: '1786017600',
      limit: '50',
      market: 'condition-1',
      offset: '10',
      takerOnly: 'false',
    })
  })
})
