import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchProfileLinkStats } from '@/lib/data-api/profile-link-stats'

describe('profileLinkStats', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('uses user-pnl for profit/loss and the reconciled volume aggregate', async () => {
    const address = '0x0000000000000000000000000000000000000001'
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const requestUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      const url = new URL(requestUrl)
      let body: unknown

      if (url.pathname === '/value') {
        body = [{ value: 24.50555514 }]
      } else if (url.pathname === '/volume') {
        body = { volume: '103.792597' }
      } else if (url.pathname === '/user-pnl') {
        body = [
          { t: 200, p: 4.69 },
          { t: 100, p: 0 },
        ]
      } else {
        return new Response(null, { status: 404 })
      }

      return Response.json(body)
    })
    vi.stubGlobal('fetch', fetchMock)

    const stats = await fetchProfileLinkStats(address, {
      dataApiUrl: 'https://data-api.test',
      userPnlUrl: 'https://user-pnl.test',
    })

    expect(stats).toEqual({
      positionsValue: 24.50555514,
      profitLoss: 4.69,
      volume: '103.792597',
    })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('reuses a pending request after the freshness TTL has elapsed', async () => {
    vi.useFakeTimers()
    const address = '0x0000000000000000000000000000000000000002'
    const responseResolvers: Array<(response: Response) => void> = []
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          responseResolvers.push(resolve)
        }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const options = {
      dataApiUrl: 'https://data-api-delayed.test',
      userPnlUrl: 'https://user-pnl-delayed.test',
    }
    const firstRequest = fetchProfileLinkStats(address, options)
    await Promise.resolve()
    expect(fetchMock).toHaveBeenCalledTimes(3)

    await vi.advanceTimersByTimeAsync(2_001)
    const secondRequest = fetchProfileLinkStats(address, options)
    await Promise.resolve()
    expect(fetchMock).toHaveBeenCalledTimes(3)

    for (const resolveResponse of responseResolvers) {
      resolveResponse(Response.json({ value: 10, volume: '20' }))
    }
    await expect(firstRequest).resolves.toEqual({
      positionsValue: 10,
      profitLoss: 0,
      volume: '20',
    })
    await expect(secondRequest).resolves.toEqual({
      positionsValue: 10,
      profitLoss: 0,
      volume: '20',
    })
  })
})
