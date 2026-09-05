import { afterEach, describe, expect, it, mock } from 'bun:test'

import { fetchPendingResolutionRewardReports, fetchResolutionRewardAccount } from '@/lib/data-api/resolution-rewards'

import { stubGlobal, unstubAllGlobals } from '../bun-test-helpers'

void mock.module('@/lib/data-api/client', () => ({
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
    unstubAllGlobals()
  })

  it('splits a creator batch when the API result is truncated', async () => {
    const fetchMock = mock()
      .mockImplementationOnce(() => response({ totalCount: 2, rewardMarkets: [market('bulk')] }))
      .mockImplementationOnce(() => response({ totalCount: 1, rewardMarkets: [market('creator-a')] }))
      .mockImplementationOnce(() => response({ totalCount: 1, rewardMarkets: [market('creator-b')] }))
    stubGlobal('fetch', fetchMock)

    const result = await fetchPendingResolutionRewardReports([
      '0x1111111111111111111111111111111111111111',
      '0x2222222222222222222222222222222222222222',
    ])

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(result.totalCount).toBe(2)
    expect(result.rewardMarkets.map(({ id }) => id)).toEqual(['creator-a', 'creator-b'])
  })

  it('fails instead of returning a silently truncated single-creator result', async () => {
    stubGlobal(
      'fetch',
      mock(() => response({ totalCount: 2, rewardMarkets: [market('only-loaded-market')] })),
    )

    await expect(fetchPendingResolutionRewardReports(['0x1111111111111111111111111111111111111111'])).rejects.toThrow(
      'were truncated',
    )
  })

  it('forwards an abort signal to optional public account requests', async () => {
    const fetchMock = mock(() => response({ rewardAccountStats: null, rewardProposals: [], rewardClaims: [] }))
    stubGlobal('fetch', fetchMock)
    const controller = new AbortController()

    await fetchResolutionRewardAccount('0x1111111111111111111111111111111111111111', {
      signal: controller.signal,
    })

    expect(fetchMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ signal: controller.signal }))
  })
})
