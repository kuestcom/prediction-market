import { describe, expect, it } from 'vitest'
import {
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
