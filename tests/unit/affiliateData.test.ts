import { describe, expect, it } from 'bun:test'

import { calculateAffiliateCommission, calculateOperatorShare } from '@/lib/affiliate-data'

describe('affiliate fee calculations', () => {
  it('calculates split shares', () => {
    const fee = 1
    expect(calculateAffiliateCommission(fee, 0.4)).toBe(0.4)
    expect(calculateOperatorShare(fee, 0.6)).toBe(0.6)
  })
})
