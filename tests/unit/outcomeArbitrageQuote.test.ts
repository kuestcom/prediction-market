import { describe, expect, it } from 'vitest'

import type { NormalizedBookLevel } from '@/lib/order-panel-utils'

import {
  buildOutcomeArbitragePreview,
  buildOutcomeArbitrageQuote,
  constrainOutcomeArbitrageQuoteForKuestFok,
  findMinimumExecutableOutcomeArbitrageQuote,
  scaleOutcomeArbitrageQuote,
} from '@/lib/outcome-arbitrage-quote'

function level(priceDollars: number, size: number): NormalizedBookLevel {
  return { priceCents: priceDollars * 100, priceDollars, size }
}

describe('outcome arbitrage quotes', () => {
  it('previews both best asks and their negative edge when no arbitrage is available', () => {
    const preview = buildOutcomeArbitragePreview({
      yesAsks: [level(0.83, 50)],
      noAsks: [level(0.2, 50)],
      yesFeeBps: 100,
      noFeeBps: 100,
    })

    expect(preview?.yesPrice).toBe(0.83)
    expect(preview?.noPrice).toBe(0.2)
    expect(preview?.edge).toBeCloseTo(-0.0403, 6)
  })

  it('previews an available side even while the opposite order book is empty', () => {
    const preview = buildOutcomeArbitragePreview({
      yesAsks: [level(0.42, 10)],
      noAsks: [],
      yesFeeBps: null,
      noFeeBps: null,
    })

    expect(preview).toEqual({ yesPrice: 0.42, noPrice: null, edge: null })
  })

  it('pairs YES and NO liquidity while their combined cost stays below one dollar', () => {
    const quote = buildOutcomeArbitrageQuote({
      yesTokenId: 'yes',
      noTokenId: 'no',
      yesAsks: [level(0.4, 10), level(0.52, 10)],
      noAsks: [level(0.5, 20)],
    })

    expect(quote?.shares).toBe(10)
    expect(quote?.totalCost).toBe(9)
    expect(quote?.profit).toBe(1)
    expect(quote?.yesOrder.price).toBe(0.4)
    expect(quote?.noOrder.price).toBe(0.5)
  })

  it('removes an opportunity that disappears after both Kuest fees', () => {
    const quote = buildOutcomeArbitrageQuote({
      yesTokenId: 'yes',
      noTokenId: 'no',
      yesAsks: [level(0.495, 10)],
      noAsks: [level(0.495, 10)],
      yesFeeBps: 150,
      noFeeBps: 150,
    })

    expect(quote).toBeNull()
  })

  it('deducts the combined market and builder fees from both buy legs', () => {
    const quote = buildOutcomeArbitrageQuote({
      yesTokenId: 'yes',
      noTokenId: 'no',
      yesAsks: [level(0.4, 10)],
      noAsks: [level(0.5, 10)],
      yesFeeBps: 150,
      noFeeBps: 200,
    })

    expect(quote?.yesCost).toBeCloseTo(4.06, 6)
    expect(quote?.noCost).toBeCloseTo(5.1, 6)
    expect(quote?.profit).toBeCloseTo(0.84, 6)
  })

  it('limits Max by the shared balance required by both FOK price caps', () => {
    const quote = buildOutcomeArbitrageQuote({
      yesTokenId: 'yes',
      noTokenId: 'no',
      yesAsks: [level(0.3, 10), level(0.4, 10)],
      noAsks: [level(0.4, 20)],
      kuestBalance: 8,
    })

    expect(quote?.shares).toBe(10)
    expect(quote?.yesOrder.maximumCost).toBe(3)
    expect(quote?.noOrder.maximumCost).toBe(4)
  })

  it('includes both outcome fees when constraining Max to the shared balance', () => {
    const quote = buildOutcomeArbitrageQuote({
      yesTokenId: 'yes',
      noTokenId: 'no',
      yesAsks: [level(0.4, 10)],
      noAsks: [level(0.5, 10)],
      yesFeeBps: 1_000,
      noFeeBps: 1_000,
      kuestBalance: 9.5,
    })

    const yesPrincipal = quote?.yesOrder.maximumCost ?? 0
    const noPrincipal = quote?.noOrder.maximumCost ?? 0
    const fees = Math.max(0, (quote?.yesCost ?? 0) - yesPrincipal) + Math.max(0, (quote?.noCost ?? 0) - noPrincipal)

    expect(quote?.shares).toBeCloseTo(9.595958, 6)
    expect(yesPrincipal + noPrincipal + fees).toBeLessThanOrEqual(9.5)
  })

  it('includes the signed FOK micro-unit ceiling in the balance cap', () => {
    const quote = buildOutcomeArbitrageQuote({
      yesTokenId: 'yes',
      noTokenId: 'no',
      yesAsks: [level(0.333333, 0.000001)],
      noAsks: [level(0.333333, 0.000001)],
    })!
    const exactFloatingCost = 0.333333 * 0.000001 * 2
    const constrained = constrainOutcomeArbitrageQuoteForKuestFok(quote, exactFloatingCost)

    expect(quote.yesOrder.maximumCost + quote.noOrder.maximumCost).toBe(0.000002)
    expect(constrained).toBeNull()
  })

  it.each([Number.NaN, Number.NEGATIVE_INFINITY, -1])('rejects an invalid Kuest balance of %s', (kuestBalance) => {
    const quote = buildOutcomeArbitrageQuote({
      yesTokenId: 'yes',
      noTokenId: 'no',
      yesAsks: [level(0.4, 10)],
      noAsks: [level(0.5, 10)],
    })!

    expect(constrainOutcomeArbitrageQuoteForKuestFok(quote, kuestBalance)).toBeNull()
  })

  it('scales both legs to exactly the same number of shares', () => {
    const quote = buildOutcomeArbitrageQuote({
      yesTokenId: 'yes',
      noTokenId: 'no',
      yesAsks: [level(0.4, 20)],
      noAsks: [level(0.5, 20)],
    })
    const scaled = scaleOutcomeArbitrageQuote(quote!, 25)

    expect(scaled?.shares).toBe(5)
    expect(scaled?.yesOrder.maximumCost).toBe(2)
    expect(scaled?.noOrder.maximumCost).toBe(2.5)
  })

  it('finds the smallest pair accepted by both market-order minimums', () => {
    const quote = buildOutcomeArbitrageQuote({
      yesTokenId: 'yes',
      noTokenId: 'no',
      yesAsks: [level(0.2, 100)],
      noAsks: [level(0.7, 100)],
    })
    const minimum = findMinimumExecutableOutcomeArbitrageQuote(quote!, {
      minimumShares: 1,
      minimumOrderAmount: 1,
    })

    expect(minimum?.shares).toBeCloseTo(5, 5)
    expect(minimum?.yesOrder.maximumCost).toBeCloseTo(1, 6)
    expect(minimum?.noOrder.maximumCost).toBeCloseTo(3.499998, 6)
  })
})
