import { describe, expect, it } from 'vitest'
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
    expect(resolveDisplayPrice({
      bid: 63,
      ask: 65,
      midpoint: 64,
      lastTrade: 66,
    })).toBe(0.64)
  })

  it('builds chances from percent-style overrides without inflating to 100%', () => {
    expect(buildChanceByMarket([
      {
        condition_id: 'market-1',
        price: 0.52,
      },
    ] as any, {
      'market-1': 64,
    })).toEqual({
      'market-1': 64,
    })
  })
})
