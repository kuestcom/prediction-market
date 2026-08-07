import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchPendingResolutionRewardReports, fetchResolutionRewardAccount } from '@/lib/data-api/resolution-rewards'

vi.mock('@/lib/data-api/client', () => ({
  buildDataApiUrl: (path: string, params?: URLSearchParams) =>
    `https://data.example${path}?${params?.toString() ?? ''}`,
}))

function response(payload: unknown) {
  return Promise.resolve(new Response(JSON.stringify(payload), { status: 200 }))
}

function market(id: string) {
  return {
    id,
    registeredAt: '1',
    noProposal: { id: `${id}-proposal` },
    yesProposal: null,
  }
}

describe('resolution rewards Data API reports', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('splits a creator batch when the API result is truncated', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => response({ totalCount: 2, rewardMarkets: [market('bulk')] }))
      .mockImplementationOnce(() => response({ totalCount: 1, rewardMarkets: [market('creator-a')] }))
      .mockImplementationOnce(() => response({ totalCount: 1, rewardMarkets: [market('creator-b')] }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchPendingResolutionRewardReports([
      '0x1111111111111111111111111111111111111111',
      '0x2222222222222222222222222222222222222222',
    ])

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(result.totalCount).toBe(2)
    expect(result.rewardMarkets.map(({ id }) => id)).toEqual(['creator-a', 'creator-b'])
  })

  it('fails instead of returning a silently truncated single-creator result', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => response({ totalCount: 2, rewardMarkets: [market('only-loaded-market')] })),
    )

    await expect(fetchPendingResolutionRewardReports(['0x1111111111111111111111111111111111111111'])).rejects.toThrow(
      'were truncated',
    )
  })

  it('forwards an abort signal to optional public account requests', async () => {
    const fetchMock = vi.fn(() => response({ rewardAccountStats: null, rewardProposals: [], rewardClaims: [] }))
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AbortController()

    await fetchResolutionRewardAccount('0x1111111111111111111111111111111111111111', {
      signal: controller.signal,
    })

    expect(fetchMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ signal: controller.signal }))
  })
})
