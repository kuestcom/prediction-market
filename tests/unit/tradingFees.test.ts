import { describe, expect, it } from 'vitest'

import {
  calculateFeeBreakdown,
  calculateKuestFee,
  calculateKuestUnitFee,
  grossUpKuestFee,
  roundUsdcFee,
} from '@/lib/trading-fees'

const cryptoSchedule = {
  rate: 0.0441,
  exponent: 1,
  takerOnly: true,
  rebateRate: 0.2,
}

describe('dynamic trading fees', () => {
  it.each([
    [0.01, 0.04366],
    [0.1, 0.3969],
    [0.5, 1.1025],
    [0.9, 0.3969],
    [0.99, 0.04366],
  ])('matches the Crypto golden base at %s', (price, expected) => {
    expect(calculateKuestFee(100, price, cryptoSchedule)).toBe(expected)
  })

  it.each([
    [0.0441, 1.1025],
    [0.0315, 0.7875],
    [0.0252, 0.63],
  ])('matches the category midpoint fixture for rate %s', (rate, expected) => {
    expect(calculateKuestFee(100, 0.5, { ...cryptoSchedule, rate })).toBe(expected)
  })

  it.each([
    [2000, 1.37813, 0.275626, 1.102504],
    [3000, 1.575, 0.4725, 1.1025],
    [4500, 2.00455, 0.902047, 1.102503],
  ])('matches the %s bps operator split', (operatorShareBps, totalFee, operatorFee, kuestFee) => {
    expect(
      calculateFeeBreakdown({
        shares: 100,
        price: 0.5,
        notional: 50,
        schedule: cryptoSchedule,
        operatorShareBps,
      }),
    ).toEqual({ kuestBaseFee: 1.1025, kuestFee, operatorFee, totalFee })
  })

  it('uses the configured ellipse and is symmetric around the midpoint', () => {
    expect(calculateKuestUnitFee(0.5, cryptoSchedule)).toBeCloseTo(0.011025, 10)
    expect(calculateKuestUnitFee(0.2, cryptoSchedule)).toBeCloseTo(calculateKuestUnitFee(0.8, cryptoSchedule), 10)
  })

  it('rounds to five decimals and charges zero below one micro-cent', () => {
    expect(roundUsdcFee(0.000009)).toBe(0)
    expect(roundUsdcFee(0.000016)).toBe(0.00002)
    expect(calculateKuestFee(10, 0.5, cryptoSchedule)).toBe(0.11025)
  })

  it('grosses up the Kuest fee and splits the total by operator share', () => {
    expect(
      calculateFeeBreakdown({
        shares: 10,
        price: 0.5,
        notional: 5,
        schedule: cryptoSchedule,
        operatorShareBps: 3000,
      }),
    ).toEqual({ kuestBaseFee: 0.11025, kuestFee: 0.11025, operatorFee: 0.04725, totalFee: 0.1575 })
    expect(grossUpKuestFee(0.11025, 3000)).toBe(0.1575)
  })
})
