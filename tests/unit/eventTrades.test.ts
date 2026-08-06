import { afterEach, describe, expect, it, vi } from 'vitest'

import { GET as getEventActivity } from '@/app/api/event-activity/route'
import { EVENT_ACTIVITY_REFRESH_SIZE, fetchEventTrades } from '@/lib/data-api/trades'

describe('fetchEventTrades', () => {
  const originalDataUrl = process.env.DATA_URL

  afterEach(() => {
    vi.unstubAllGlobals()
    if (originalDataUrl === undefined) {
      delete process.env.DATA_URL
    } else {
      process.env.DATA_URL = originalDataUrl
    }
  })

  it('requests a bounded page with the timestamp and event id cursor', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await fetchEventTrades({
      marketIds: ['condition-1'],
      pageParam: 0,
      pageSize: EVENT_ACTIVITY_REFRESH_SIZE,
      cursorTimestamp: 1_786_017_600,
      cursorId: 'fill-9',
      cursorUser: '0xabc',
    })

    const requestUrl = new URL(String(fetchMock.mock.calls[0]?.[0]), 'https://example.com')
    expect(requestUrl.pathname).toBe('/api/event-activity')
    expect(Object.fromEntries(requestUrl.searchParams)).toEqual({
      cursorId: 'fill-9',
      cursorTimestamp: '1786017600',
      cursorUser: '0xabc',
      limit: '50',
      market: 'condition-1',
      offset: '0',
      takerOnly: 'false',
    })
  })

  it('rejects a partial cursor before sending a request', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      fetchEventTrades({
        marketIds: ['condition-1'],
        pageParam: 0,
        cursorTimestamp: 1_786_017_600,
      }),
    ).rejects.toThrow('cursorTimestamp, cursorId, and cursorUser must be provided together.')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('forwards the complete cursor through the event activity proxy', async () => {
    process.env.DATA_URL = 'https://data-api.test'
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const response = await getEventActivity(
      new Request(
        'https://example.com/api/event-activity?market=condition-1&cursorTimestamp=1786017600&cursorId=fill-9&cursorUser=0xabc',
      ),
    )

    expect(response.status).toBe(200)
    const dataApiUrl = new URL(String(fetchMock.mock.calls[0]?.[0]))
    expect(dataApiUrl.origin).toBe('https://data-api.test')
    expect(dataApiUrl.pathname).toBe('/trades')
    expect(dataApiUrl.searchParams.get('cursorTimestamp')).toBe('1786017600')
    expect(dataApiUrl.searchParams.get('cursorId')).toBe('fill-9')
    expect(dataApiUrl.searchParams.get('cursorUser')).toBe('0xabc')
  })

  it.each(['cursorId', 'cursorUser'])('rejects a whitespace-only %s in the event activity proxy', async (field) => {
    process.env.DATA_URL = 'https://data-api.test'
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const params = new URLSearchParams({ market: 'condition-1', [field]: '   ' })
    const response = await getEventActivity(new Request(`https://example.com/api/event-activity?${params}`))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'cursorTimestamp, cursorId, and cursorUser must be provided together.',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
