import { describe, expect, it } from 'vitest'

import { calculateFeeBreakdown, calculateKuestFee, calculateKuestUnitFee, roundUsdcFee } from '@/lib/trading-fees'

const cryptoSchedule = {
  rate: 0.07,
  exponent: 1,
  takerOnly: true,
  rebateRate: 0.2,
}

describe('dynamic trading fees', () => {
  it('uses the configured ellipse and is symmetric around the midpoint', () => {
    expect(calculateKuestUnitFee(0.5, cryptoSchedule)).toBeCloseTo(0.0175, 10)
    expect(calculateKuestUnitFee(0.2, cryptoSchedule)).toBeCloseTo(calculateKuestUnitFee(0.8, cryptoSchedule), 10)
  })

  it('rounds to five decimals and charges zero below one micro-cent', () => {
    expect(roundUsdcFee(0.000009)).toBe(0)
    expect(roundUsdcFee(0.000016)).toBe(0.00002)
    expect(calculateKuestFee(10, 0.5, cryptoSchedule)).toBe(0.175)
  })

  it('keeps the operator fee separate and additional', () => {
    expect(
      calculateFeeBreakdown({
        shares: 10,
        price: 0.5,
        notional: 5,
        schedule: cryptoSchedule,
        operatorFeeBps: 100,
      }),
    ).toEqual({ kuestFee: 0.175, operatorFee: 0.05, totalFee: 0.225 })
  })
})
