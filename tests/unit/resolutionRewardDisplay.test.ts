import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fetchResolutionRewardAccount: vi.fn(),
  getMarketsByConditionIds: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('@/lib/data-api/resolution-rewards', () => ({
  fetchResolutionRewardAccount: mocks.fetchResolutionRewardAccount,
}))

vi.mock('@/lib/db/queries/resolution-report-context', () => ({
  ResolutionReportContextRepository: {
    getMarketsByConditionIds: mocks.getMarketsByConditionIds,
  },
}))

import { fetchDisplayResolutionRewardAccount, hydrateResolutionRewardAccount } from '@/lib/resolution-reward-display'

describe('fetchDisplayResolutionRewardAccount', () => {
  beforeEach(() => {
    mocks.fetchResolutionRewardAccount.mockReset()
    mocks.getMarketsByConditionIds.mockReset()
  })

  it('honors cancellation while local market hydration is still pending', async () => {
    mocks.fetchResolutionRewardAccount.mockResolvedValue({
      rewardAccountStats: null,
      rewardProposals: [],
    })
    mocks.getMarketsByConditionIds.mockReturnValue(new Promise(() => {}))
    const controller = new AbortController()
    const request = fetchDisplayResolutionRewardAccount('0x1111111111111111111111111111111111111111', {
      signal: controller.signal,
    })

    await vi.waitFor(() => expect(mocks.getMarketsByConditionIds).toHaveBeenCalledOnce())
    controller.abort(new Error('profile reward deadline exceeded'))

    await expect(request).rejects.toThrow('profile reward deadline exceeded')
  })

  it('preserves Data API artwork and outcome labels when local hydration misses', async () => {
    mocks.getMarketsByConditionIds.mockResolvedValue([])
    const account = {
      rewardAccountStats: null,
      rewardClaims: [],
      rewardProposals: [
        {
          market: {
            conditionId: 'condition-1',
            icon: 'https://example.test/market.png',
            eventIcon: 'https://example.test/event.png',
            yesLabel: 'Up',
            noLabel: 'Down',
          },
        },
      ],
    }

    const result = await hydrateResolutionRewardAccount(account as never)

    expect(result?.rewardProposals[0]?.market).toEqual(
      expect.objectContaining({
        icon: 'https://example.test/market.png',
        eventIcon: 'https://example.test/event.png',
        yesLabel: 'Up',
        noLabel: 'Down',
      }),
    )
  })

  it('handles a rejected request when the signal was already aborted', async () => {
    mocks.fetchResolutionRewardAccount.mockRejectedValue(new Error('fetch aborted'))
    const controller = new AbortController()
    controller.abort(new Error('request already expired'))

    const request = fetchDisplayResolutionRewardAccount('0x1111111111111111111111111111111111111111', {
      signal: controller.signal,
    })

    await expect(request).rejects.toThrow('request already expired')
  })
})
