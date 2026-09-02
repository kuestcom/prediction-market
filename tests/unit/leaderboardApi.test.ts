import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { DEFAULT_FILTERS } from '@/app/[locale]/(platform)/leaderboard/_utils/leaderboardFilters'

type LeaderboardApiModule = typeof import('@/app/[locale]/(platform)/leaderboard/_utils/leaderboardApi')

let helpers: LeaderboardApiModule

beforeAll(async () => {
  process.env.DATA_URL = 'https://data-api.test'
  helpers = await import('@/app/[locale]/(platform)/leaderboard/_utils/leaderboardApi')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('leaderboard API helpers', () => {
  it('loads leaderboard rows independently of the slower PNL hydration request', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [
            {
              proxyWallet: '0x2222222222222222222222222222222222222222',
              userName: 'leader',
              pnl: 10,
            },
          ],
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    )
    const signal = new AbortController().signal

    const entries = await helpers.fetchLeaderboardEntries('https://data-api.test/v1', DEFAULT_FILTERS, '', 2, signal)

    expect(entries).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://data-api.test/v1/leaderboard?limit=20&offset=20&category=OVERALL&timePeriod=MONTH&orderBy=PNL',
      { signal },
    )
  })

  it('keeps proxyWallet entries from DATA_URL leaderboard responses', () => {
    const [entry] = helpers.normalizeLeaderboardResponse({
      data: [
        {
          proxyWallet: '0x2222222222222222222222222222222222222222',
          userName: 'leader',
          pnl: 10,
        },
      ],
    })

    expect(entry.proxyWallet).toBe('0x2222222222222222222222222222222222222222')
  })

  it('uses proxyWallet as the stable tie breaker when sorting profit rows', () => {
    const sorted = helpers.sortEntriesForDisplay(
      [
        {
          proxyWallet: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          pnl: 10,
        },
        {
          proxyWallet: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          pnl: 10,
        },
      ],
      DEFAULT_FILTERS,
      1,
    )

    expect(sorted.map((entry) => entry.proxyWallet)).toEqual([
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    ])
  })

  it('resolves snake_case proxy wallet fields when hydrating timeframe pnl', async () => {
    const proxyWallet = '0x2222222222222222222222222222222222222222'
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ values: { [proxyWallet]: 123 } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )

    const [entry] = await helpers.hydrateEntriesWithPortfolioPnl(
      [
        {
          proxy_wallet: proxyWallet,
          pnl: 0,
        },
      ],
      DEFAULT_FILTERS,
      new AbortController().signal,
    )

    expect(fetchMock).toHaveBeenCalledOnce()
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit
    if (typeof requestInit.body !== 'string') {
      throw new TypeError('Expected JSON request body')
    }
    expect(JSON.parse(requestInit.body)).toEqual({
      period: DEFAULT_FILTERS.period,
      addresses: [proxyWallet],
    })
    expect(entry.pnl).toBe(123)
  })

  it('resolves proxy_wallet_address aliases for biggest-wins rows', () => {
    const proxyWallet = '0x3333333333333333333333333333333333333333'

    expect(
      helpers.resolveLeaderboardProxyWallet({
        user: {
          proxy_wallet_address: proxyWallet,
        },
      }),
    ).toBe(proxyWallet)
  })
})
