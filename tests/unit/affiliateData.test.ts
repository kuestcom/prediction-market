import { describe, expect, it } from 'vitest'
import {
  calculateAffiliateCommission,
  calculateOperatorShare,
  calculateTradingFee,
  createFeeCalculationExample,
} from '@/lib/affiliate-data'

describe('affiliate fee calculations', () => {
  it('calculates trading fee and split shares', () => {
    const tradeAmount = 100
    const fee = calculateTradingFee(tradeAmount, 0.01)
    expect(fee).toBe(1)

    expect(calculateAffiliateCommission(fee, 0.4)).toBe(0.4)
    expect(calculateOperatorShare(fee, 0.6)).toBe(0.6)
  })

  it('builds a formatted example with consistent percents', () => {
    const example = createFeeCalculationExample(
      250,
      {
        builderTakerFeePercent: '1.00',
        builderMakerFeePercent: '0.00',
        affiliateSharePercent: '40.00',
        operatorSharePercent: '60.00',
        builderTakerFeeDecimal: 0.01,
        builderMakerFeeDecimal: 0,
        affiliateShareDecimal: 0.4,
        operatorShareDecimal: 0.6,
      },
      35,
    )

    expect(example.clobTakerFeeBps).toBe(35)
    expect(example.clobTakerFeePercent).toBe('0.35')
    expect(example.builderTakerFeePercent).toBe('1.00')
    expect(example.totalTakerFeePercent).toBe('1.35')
    expect(example.affiliateSharePercent).toBe('40.00')
    expect(example.operatorSharePercent).toBe('60.00')
    expect(example.clobTakerFee).toBe('0.88')
    expect(example.operatorTakerFee).toBe('2.50')
    expect(example.totalTakerFee).toBe('3.38')
    expect(example.affiliateCommission).toBe('1.00')
    expect(example.operatorShare).toBe('1.50')
  })

  it('keeps the total pending until a token-specific CLOB rate is available', () => {
    const example = createFeeCalculationExample(
      100,
      {
        builderTakerFeePercent: '1.00',
        builderMakerFeePercent: '0.00',
        affiliateSharePercent: '40.00',
        operatorSharePercent: '60.00',
        builderTakerFeeDecimal: 0.01,
        builderMakerFeeDecimal: 0,
        affiliateShareDecimal: 0.4,
        operatorShareDecimal: 0.6,
      },
      null,
    )

    expect(example.clobTakerFee).toBeNull()
    expect(example.totalTakerFee).toBeNull()
    expect(example.operatorTakerFee).toBe('1.00')
    expect(example.affiliateCommission).toBe('0.40')
  })
})
