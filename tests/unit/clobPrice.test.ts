import { describe, expect, it } from 'vitest'
import { normalizeClobMarketPrice } from '@/lib/clob-price'

describe('normalizeClobMarketPrice', () => {
  it('ignores blank feed values instead of treating them as zero', () => {
    expect(normalizeClobMarketPrice('')).toBeNull()
    expect(normalizeClobMarketPrice('   ')).toBeNull()
  })

  it('keeps valid decimal and percent-style feed values', () => {
    expect(normalizeClobMarketPrice('0.64')).toBe(0.64)
    expect(normalizeClobMarketPrice('64')).toBe(0.64)
    expect(normalizeClobMarketPrice(64)).toBe(0.64)
  })
})
