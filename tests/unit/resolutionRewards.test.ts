import { describe, expect, it } from 'vitest'

import { getResolutionRewardMarketId, RESOLUTION_REWARD_SIDE } from '@/lib/resolution-rewards'

describe('resolution rewards', () => {
  it('uses stable sides and derives a deterministic managed request id', () => {
    const requester = '0x1111111111111111111111111111111111111111'
    const ancillaryData = '0x1234'

    expect(RESOLUTION_REWARD_SIDE).toEqual({ no: 1, yes: 2 })
    expect(getResolutionRewardMarketId(requester, ancillaryData)).toBe(
      '0x491f55173995cd63d55614d93a8c9b66c7a364603a175267216d765e9a1e1c2c',
    )
  })
})
