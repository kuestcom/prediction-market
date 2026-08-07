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

import { fetchDisplayResolutionRewardAccount } from '@/lib/resolution-reward-display'

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
})
