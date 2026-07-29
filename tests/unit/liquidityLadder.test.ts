import { describe, expect, it } from 'vitest'

import type { Market } from '@/types'

import { MAX_ORDER_SUBMISSION_ORDERS } from '@/lib/constants'
import {
  buildLiquidityLadder,
  canProvideMarketLiquidity,
  getLiquidityLadderRequirements,
  MAX_LIQUIDITY_LADDER_LEVELS,
} from '@/lib/liquidity-ladder'

describe('liquidity ladder', () => {
  it('builds inverse buy and sell ladders for both outcome tokens', () => {
    const orders = buildLiquidityLadder({
      centerPriceCents: 60,
      levelsPerSide: 2,
      priceStepCents: 2,
      sharesPerOrder: 5,
    })

    expect(orders).toEqual([
      { outcomeIndex: 0, side: 'buy', priceCents: 58, shares: 5 },
      { outcomeIndex: 0, side: 'buy', priceCents: 56, shares: 5 },
      { outcomeIndex: 0, side: 'sell', priceCents: 62, shares: 5 },
      { outcomeIndex: 0, side: 'sell', priceCents: 64, shares: 5 },
      { outcomeIndex: 1, side: 'buy', priceCents: 38, shares: 5 },
      { outcomeIndex: 1, side: 'buy', priceCents: 36, shares: 5 },
      { outcomeIndex: 1, side: 'sell', priceCents: 42, shares: 5 },
      { outcomeIndex: 1, side: 'sell', priceCents: 44, shares: 5 },
    ])
  })

  it('deduplicates prices when a ladder reaches a one-cent market edge', () => {
    const orders = buildLiquidityLadder({
      centerPriceCents: 1,
      levelsPerSide: 3,
      priceStepCents: 1,
      sharesPerOrder: 2,
    })

    expect(orders).toEqual([
      { outcomeIndex: 0, side: 'buy', priceCents: 1, shares: 2 },
      { outcomeIndex: 0, side: 'sell', priceCents: 2, shares: 2 },
      { outcomeIndex: 0, side: 'sell', priceCents: 3, shares: 2 },
      { outcomeIndex: 0, side: 'sell', priceCents: 4, shares: 2 },
      { outcomeIndex: 1, side: 'buy', priceCents: 98, shares: 2 },
      { outcomeIndex: 1, side: 'buy', priceCents: 97, shares: 2 },
      { outcomeIndex: 1, side: 'buy', priceCents: 96, shares: 2 },
      { outcomeIndex: 1, side: 'sell', priceCents: 99, shares: 2 },
    ])
    expect(getLiquidityLadderRequirements(orders)).toMatchObject({
      bidCost: 5.9568,
      splitShares: 6,
      signatureCount: 9,
    })
  })

  it('caps each side so the order batch remains under the API limit', () => {
    const orders = buildLiquidityLadder({
      centerPriceCents: 50,
      levelsPerSide: 99,
      priceStepCents: 1,
      sharesPerOrder: 1,
    })

    expect(MAX_LIQUIDITY_LADDER_LEVELS).toBe(Math.floor(MAX_ORDER_SUBMISSION_ORDERS / 4))
    expect(orders).toHaveLength(MAX_LIQUIDITY_LADDER_LEVELS * 4)
    expect(getLiquidityLadderRequirements(orders)).toMatchObject({
      bidCost: 6.5688,
      splitShares: 7,
      signatureCount: 29,
    })
  })

  it.each([
    { centerPriceCents: Number.NaN },
    { levelsPerSide: Number.POSITIVE_INFINITY },
    { priceStepCents: Number.NaN },
  ])('rejects non-finite ladder inputs: %o', (invalidInput) => {
    expect(
      buildLiquidityLadder({
        centerPriceCents: 50,
        levelsPerSide: 3,
        priceStepCents: 2,
        sharesPerOrder: 5,
        ...invalidInput,
      }),
    ).toEqual([])
  })

  it('only enables provisioning while a binary market can accept orders', () => {
    const market = {
      is_active: true,
      is_resolved: false,
      accepting_orders: true,
      metadata: null,
      condition: { resolved: false },
      outcomes: [
        { outcome_index: 0, token_id: 'yes' },
        { outcome_index: 1, token_id: 'no' },
      ],
    } as Market

    expect(canProvideMarketLiquidity(market, Date.now())).toBe(true)
    expect(canProvideMarketLiquidity({ ...market, accepting_orders: false }, Date.now())).toBe(false)
    expect(canProvideMarketLiquidity({ ...market, is_resolved: true }, Date.now())).toBe(false)
    expect(
      canProvideMarketLiquidity(
        {
          ...market,
          end_time: '2026-01-01T00:00:00.000Z',
          metadata: { mirror_resolution_type: 'chainlink' },
        },
        Date.parse('2026-01-01T00:00:01.000Z'),
      ),
    ).toBe(false)
  })
})
