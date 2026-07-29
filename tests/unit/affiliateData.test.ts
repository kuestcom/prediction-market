import { describe, expect, it } from 'vitest'

import { calculateAffiliateCommission, calculateOperatorShare, createTradingFeeRateExample } from '@/lib/affiliate-data'

describe('affiliate fee calculations', () => {
  it('calculates split shares', () => {
    const fee = 1
    expect(calculateAffiliateCommission(fee, 0.4)).toBe(0.4)
    expect(calculateOperatorShare(fee, 0.6)).toBe(0.6)
  })

  it('builds one consolidated fee rate without calculating a dollar amount', () => {
    const example = createTradingFeeRateExample(
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

    expect(example).toEqual({
      tradingFeeBps: 135,
      tradingFeePercent: '1.35',
    })
  })

  it('does not allow a negative external rate to reduce the configured rate', () => {
    const example = createTradingFeeRateExample(
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
      -25,
    )

    expect(example.tradingFeeBps).toBe(100)
  })
})
