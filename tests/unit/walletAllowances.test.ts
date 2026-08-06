import { describe, expect, it } from 'vitest'

import { COLLATERAL_TOKEN_ADDRESS, RESOLUTION_REWARDS_ADDRESS } from '@/lib/contracts'
import {
  buildResolutionRewardReleaseCall,
  buildResolutionRewardWithdrawalCall,
  buildResolutionRewardsClaimCall,
  COLLATERAL_APPROVAL_REUSE_AMOUNT,
  hasSufficientCollateralAllowance,
  MAX_ALLOWANCE,
} from '@/lib/wallet/transactions'

describe('collateral approval reuse threshold', () => {
  it('does not require the exact max allowance', () => {
    expect(hasSufficientCollateralAllowance(MAX_ALLOWANCE - 1n)).toBe(true)
    expect(hasSufficientCollateralAllowance(COLLATERAL_APPROVAL_REUSE_AMOUNT)).toBe(true)
  })

  it('requires enough residual allowance for app-sized trades', () => {
    expect(hasSufficientCollateralAllowance(COLLATERAL_APPROVAL_REUSE_AMOUNT - 1n)).toBe(false)
    expect(hasSufficientCollateralAllowance(0n)).toBe(false)
  })
})

describe('resolution rewards claim call', () => {
  it('routes the USDC claim through the configured rewards contract', () => {
    const call = buildResolutionRewardsClaimCall()

    expect(call.target).toBe(RESOLUTION_REWARDS_ADDRESS)
    expect(call.value).toBe('0')
    expect(call.data.slice(0, 10)).toBe('0x1e83409a')
    expect(call.data.toLowerCase()).toContain(COLLATERAL_TOKEN_ADDRESS.slice(2).toLowerCase())
  })

  it('encodes proposal withdrawal and release calls for the rewards contract', () => {
    const withdrawal = buildResolutionRewardWithdrawalCall('7')
    const release = buildResolutionRewardReleaseCall(7n)

    expect(withdrawal).toMatchObject({ target: RESOLUTION_REWARDS_ADDRESS, value: '0' })
    expect(withdrawal.data.slice(0, 10)).toBe('0x9ee679e8')
    expect(release).toMatchObject({ target: RESOLUTION_REWARDS_ADDRESS, value: '0' })
    expect(release.data.slice(0, 10)).toBe('0xcc532f2c')
  })
})
