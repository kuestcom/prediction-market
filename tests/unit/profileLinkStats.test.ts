import { fetchProfileLinkStats } from '@/lib/data-api/profile-link-stats'

describe('profileLinkStats', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
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
})
