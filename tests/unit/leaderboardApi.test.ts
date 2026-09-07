import { afterEach, beforeAll, describe, expect, it, spyOn, jest } from 'bun:test'

import { DEFAULT_FILTERS } from '@/app/[locale]/(platform)/leaderboard/_utils/leaderboardFilters'

type LeaderboardApiModule = typeof import('@/app/[locale]/(platform)/leaderboard/_utils/leaderboardApi')

let helpers: LeaderboardApiModule

beforeAll(async () => {
  process.env.DATA_URL = 'https://data-api.test'
  helpers = await import('@/app/[locale]/(platform)/leaderboard/_utils/leaderboardApi')
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('leaderboard API helpers', () => {
  it('loads leaderboard rows with the server-provided ranking fields', async () => {
    const fetchMock = spyOn(globalThis, 'fetch').mockResolvedValueOnce(
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
      'https://data-api.test/v1/leaderboard?limit=21&offset=20&category=OVERALL&timePeriod=MONTH&orderBy=PNL',
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
