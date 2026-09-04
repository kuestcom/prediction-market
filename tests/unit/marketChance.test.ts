import { describe, expect, it } from 'bun:test'

import { buildChanceByMarket, normalizeMarketPrice, resolveDisplayPrice } from '@/lib/market-chance'

describe('market chance normalization', () => {
  it('accepts both decimal and percent-style market prices', () => {
    expect(normalizeMarketPrice(0.64)).toBe(0.64)
    expect(normalizeMarketPrice(64)).toBe(0.64)
    expect(normalizeMarketPrice('64')).toBe(0.64)
  })

  it('ignores malformed prices instead of treating them as zero', () => {
    expect(normalizeMarketPrice('oops')).toBeNull()
    expect(normalizeMarketPrice(Number.NaN)).toBeNull()
  })

  it('keeps live quote display prices stable when feeds return cents', () => {
    expect(
      resolveDisplayPrice({
        bid: 63,
        ask: 65,
        midpoint: 64,
        lastTrade: 66,
      }),
    ).toBe(0.64)
  })

  it('uses the midpoint for a wide spread without a matched trade', () => {
    expect(
      resolveDisplayPrice({
        bid: 0.2,
        ask: 0.8,
        lastTrade: null,
      }),
    ).toBe(0.5)
  })

  it('uses the last matched trade for a wide spread when one exists', () => {
    expect(
      resolveDisplayPrice({
        bid: 0.2,
        ask: 0.8,
        lastTrade: 0.42,
      }),
    ).toBe(0.42)
  })

  it('builds chances from percent-style overrides without inflating to 100%', () => {
    expect(
      buildChanceByMarket(
        [
          {
            condition_id: 'market-1',
            price: 0.52,
          },
        ] as any,
        {
          'market-1': 64,
        },
      ),
    ).toEqual({
      'market-1': 64,
    })
  })
})
