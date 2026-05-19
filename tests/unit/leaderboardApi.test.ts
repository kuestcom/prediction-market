import { beforeAll, describe, expect, it } from 'vitest'
import { DEFAULT_FILTERS } from '@/app/[locale]/(platform)/leaderboard/_utils/leaderboardFilters'

type LeaderboardApiModule = typeof import('@/app/[locale]/(platform)/leaderboard/_utils/leaderboardApi')

let helpers: LeaderboardApiModule

beforeAll(async () => {
  process.env.DATA_URL = 'https://data-api.test'
  helpers = await import('@/app/[locale]/(platform)/leaderboard/_utils/leaderboardApi')
})

describe('leaderboard API helpers', () => {
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
    const sorted = helpers.sortEntriesForDisplay([
      {
        proxyWallet: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        pnl: 10,
      },
      {
        proxyWallet: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        pnl: 10,
      },
    ], DEFAULT_FILTERS, 1)

    expect(sorted.map(entry => entry.proxyWallet)).toEqual([
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    ])
  })
})
