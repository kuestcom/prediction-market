import type { NormalizedBookLevel } from '@/lib/order-panel-utils'
import { describe, expect, it } from 'vitest'
import {
  constrainArbitrageQuoteForPolymarketFok,
  findMinimumExecutableArbitrageQuote,
  scaleArbitrageQuote,
  selectBestArbitrageQuote,
} from '@/lib/arbitrage-quote'

function level(priceDollars: number, size: number): NormalizedBookLevel {
  return { priceCents: priceDollars * 100, priceDollars, size }
}

describe('arbitrage quotes', () => {
  it('pairs complementary outcomes and limits size by the smaller venue balance', () => {
    const quote = selectBestArbitrageQuote([{
      kuestOutcome: 'YES',
      polymarketOutcome: 'NO',
      kuestTokenId: '1',
      polymarketTokenId: '2',
      kuestAsks: [level(0.42, 100)],
      polymarketAsks: [level(0.53, 100)],
      kuestBalance: 100,
      polymarketBalance: 50,
    }])

    expect(quote).not.toBeNull()
    expect(quote?.polymarketCost).toBeCloseTo(50, 6)
    expect(quote?.shares).toBeCloseTo(50 / 0.53, 6)
    expect(quote?.edge).toBeCloseTo(0.05, 6)
    expect(quote?.profit).toBeCloseTo((50 / 0.53) * 0.05, 6)
  })

  it('excludes levels whose combined price is one dollar or more', () => {
    const quote = selectBestArbitrageQuote([{
      kuestOutcome: 'NO',
      polymarketOutcome: 'YES',
      kuestTokenId: '1',
      polymarketTokenId: '2',
      kuestAsks: [level(0.51, 100)],
      polymarketAsks: [level(0.49, 100)],
      kuestBalance: 100,
      polymarketBalance: 100,
    }])

    expect(quote).toBeNull()
  })

  it('does not present a gross price gap that disappears after venue fees', () => {
    const quote = selectBestArbitrageQuote([{
      kuestOutcome: 'YES',
      polymarketOutcome: 'NO',
      kuestTokenId: '1',
      polymarketTokenId: '2',
      kuestAsks: [level(0.496, 100)],
      polymarketAsks: [level(0.496, 100)],
      kuestBalance: 100,
      polymarketBalance: 100,
      kuestFeeBps: 100,
      polymarketFeeRate: 0.02,
    }])

    expect(quote).toBeNull()
  })

  it('uses the fee exponent returned by Polymarket', () => {
    const quote = selectBestArbitrageQuote([{
      kuestOutcome: 'YES',
      polymarketOutcome: 'NO',
      kuestTokenId: '1',
      polymarketTokenId: '2',
      kuestAsks: [level(0.48, 100)],
      polymarketAsks: [level(0.48, 100)],
      kuestBalance: 100,
      polymarketBalance: 100,
      polymarketFeeRate: 0.05,
      polymarketFeeExponent: 0,
    }])

    expect(quote).toBeNull()
  })

  it('scales the executable book prefix with the slider percentage', () => {
    const quote = selectBestArbitrageQuote([{
      kuestOutcome: 'YES',
      polymarketOutcome: 'NO',
      kuestTokenId: '1',
      polymarketTokenId: '2',
      kuestAsks: [level(0.40, 10), level(0.45, 10)],
      polymarketAsks: [level(0.50, 20)],
      kuestBalance: 100,
      polymarketBalance: 100,
    }])

    expect(quote).not.toBeNull()
    const scaled = scaleArbitrageQuote(quote!, 25)
    expect(scaled.shares).toBeCloseTo(5, 6)
    expect(scaled.kuestCost).toBeCloseTo(2, 6)
    expect(scaled.polymarketCost).toBeCloseTo(2.5, 6)
    expect(scaled.profit).toBeCloseTo(0.5, 6)
  })

  it('sizes a multi-level Kuest FOK by its terminal price cap', () => {
    const quote = selectBestArbitrageQuote([{
      kuestOutcome: 'YES',
      polymarketOutcome: 'NO',
      kuestTokenId: '1',
      polymarketTokenId: '2',
      kuestAsks: [level(0.40, 10), level(0.50, 10)],
      polymarketAsks: [level(0.30, 20)],
      kuestBalance: 9,
      polymarketBalance: 100,
    }])

    expect(quote?.shares).toBe(18)
    expect(quote?.kuestCost).toBe(8)
    expect((quote?.segments.at(-1)?.kuestPrice ?? 0) * (quote?.shares ?? 0)).toBe(9)
  })

  it('rounds matched shares down to the Polymarket order precision', () => {
    const quote = selectBestArbitrageQuote([{
      kuestOutcome: 'YES',
      polymarketOutcome: 'NO',
      kuestTokenId: '1',
      polymarketTokenId: '2',
      kuestAsks: [level(0.40, 10)],
      polymarketAsks: [level(0.50, 10)],
      kuestBalance: 100,
      polymarketBalance: 100,
    }])

    const scaled = scaleArbitrageQuote(quote!, 33.333)

    expect(scaled.shares).toBe(3.33)
  })

  it('keeps the Polymarket FOK leg fixed to the same shares with a whole-cent maker amount', () => {
    const quote = selectBestArbitrageQuote([{
      kuestOutcome: 'YES',
      polymarketOutcome: 'NO',
      kuestTokenId: '1',
      polymarketTokenId: '2',
      kuestAsks: [level(0.40, 20)],
      polymarketAsks: [level(0.42, 20)],
      kuestBalance: 100,
      polymarketBalance: 100,
    }])

    const constrained = constrainArbitrageQuoteForPolymarketFok(
      scaleArbitrageQuote(quote!, 51.25),
    )

    expect(constrained?.shares).toBe(10)
    expect(constrained?.polymarketOrder).toEqual({
      price: 0.42,
      shares: 10,
      maximumCost: 4.2,
      tickSize: '0.01',
    })
    expect((constrained!.polymarketOrder!.maximumCost * 100) % 1).toBeCloseTo(0, 10)
    expect(constrained?.payout).toBe(constrained?.shares)
  })

  it('preserves the actual sub-cent tick and stays within the available Polymarket balance', () => {
    const quote = selectBestArbitrageQuote([{
      kuestOutcome: 'NO',
      polymarketOutcome: 'YES',
      kuestTokenId: '1',
      polymarketTokenId: '2',
      kuestAsks: [level(0.30, 20)],
      polymarketAsks: [level(0.423, 20)],
      kuestBalance: 100,
      polymarketBalance: 100,
    }])

    const constrained = constrainArbitrageQuoteForPolymarketFok(quote!, 4.30, '0.001')

    expect(constrained?.polymarketOrder?.price).toBe(0.423)
    expect(constrained?.polymarketOrder?.maximumCost).toBeLessThanOrEqual(4.30)
    expect(constrained?.shares).toBe(constrained?.polymarketOrder?.shares)
  })

  it('recomputes the terminal Polymarket limit after share quantization trims a book level', () => {
    const quote = selectBestArbitrageQuote([{
      kuestOutcome: 'NO',
      polymarketOutcome: 'YES',
      kuestTokenId: '1',
      polymarketTokenId: '2',
      kuestAsks: [level(0.30, 20)],
      polymarketAsks: [level(0.42, 9.99), level(0.423, 0.009)],
      kuestBalance: 100,
      polymarketBalance: 100,
    }])

    const constrained = constrainArbitrageQuoteForPolymarketFok(quote!, 100, '0.001')

    expect(constrained?.shares).toBe(9.5)
    expect(constrained?.polymarketOrder).toMatchObject({
      price: 0.42,
      maximumCost: 3.99,
      tickSize: '0.001',
    })
  })

  it('finds the minimum matched amount accepted by both marketable buy legs', () => {
    const quote = selectBestArbitrageQuote([{
      kuestOutcome: 'YES',
      polymarketOutcome: 'NO',
      kuestTokenId: '1',
      polymarketTokenId: '2',
      kuestAsks: [level(0.97, 100)],
      polymarketAsks: [level(0.02, 100)],
      kuestBalance: 100,
      polymarketBalance: 100,
    }])

    const minimum = findMinimumExecutableArbitrageQuote(quote!, {
      minimumShares: 1,
      minimumKuestAmount: 1,
      minimumPolymarketAmount: 1,
    })

    expect(minimum?.shares).toBe(50)
    expect(minimum?.kuestCost).toBeCloseTo(48.5, 6)
    expect(minimum?.polymarketOrder?.maximumCost).toBe(1)
    expect(minimum?.totalCost).toBeCloseTo(49.5, 6)
  })

  it('returns no minimum when available liquidity cannot satisfy both venues', () => {
    const quote = selectBestArbitrageQuote([{
      kuestOutcome: 'YES',
      polymarketOutcome: 'NO',
      kuestTokenId: '1',
      polymarketTokenId: '2',
      kuestAsks: [level(0.97, 10)],
      polymarketAsks: [level(0.02, 10)],
      kuestBalance: 100,
      polymarketBalance: 100,
    }])

    expect(findMinimumExecutableArbitrageQuote(quote!, {
      minimumShares: 1,
      minimumKuestAmount: 1,
      minimumPolymarketAmount: 1,
    })).toBeNull()
  })
})
