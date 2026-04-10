import { describe, expect, it } from 'vitest'
import {
  resolveLiveSeriesDeltaDisplayDigits,
  resolveLiveSeriesPriceDisplayDigits,
} from '@/app/[locale]/(platform)/event/[slug]/_utils/liveSeriesPricePrecision'

describe('resolveLiveSeriesPriceDisplayDigits', () => {
  it('keeps equity prices at 2 digits when decimals are enabled', () => {
    expect(resolveLiveSeriesPriceDisplayDigits('equity_prices', true)).toBe(2)
  })

  it('hides equity decimals when disabled', () => {
    expect(resolveLiveSeriesPriceDisplayDigits('equity_prices', false)).toBe(0)
  })

  it('uses 4 digits for low-price crypto markets', () => {
    expect(resolveLiveSeriesPriceDisplayDigits('crypto_prices_chainlink', false, 1.3542)).toBe(4)
  })

  it('uses 4 digits for crypto prices just below 10', () => {
    expect(resolveLiveSeriesPriceDisplayDigits('crypto_prices_chainlink', false, 9.9999)).toBe(4)
  })

  it('uses 2 digits for crypto prices at or above 10', () => {
    expect(resolveLiveSeriesPriceDisplayDigits('crypto_prices_chainlink', false, 10)).toBe(2)
    expect(resolveLiveSeriesPriceDisplayDigits('crypto_prices_chainlink', false, 82450.21)).toBe(2)
  })

  it('defaults crypto precision to 4 digits when no reference price is available', () => {
    expect(resolveLiveSeriesPriceDisplayDigits('crypto_prices_chainlink', false, null)).toBe(4)
  })

  it('normalizes topic casing and spacing', () => {
    expect(resolveLiveSeriesPriceDisplayDigits('  CRYPTO_PRICES_CHAINLINK  ', true, 1.2)).toBe(4)
  })
})

describe('resolveLiveSeriesDeltaDisplayDigits', () => {
  it('shows cents when base price digits are hidden', () => {
    expect(resolveLiveSeriesDeltaDisplayDigits(0, 0.66)).toBe(2)
  })

  it('keeps 2-digit deltas for 2-digit prices', () => {
    expect(resolveLiveSeriesDeltaDisplayDigits(2, 0.66)).toBe(2)
  })

  it('keeps 4-digit deltas for low-price crypto series', () => {
    expect(resolveLiveSeriesDeltaDisplayDigits(4, 0.0066)).toBe(4)
  })

  it('hides decimals for positive deltas above one dollar', () => {
    expect(resolveLiveSeriesDeltaDisplayDigits(2, 1.01)).toBe(0)
  })

  it('hides decimals for negative deltas above one dollar in absolute value', () => {
    expect(resolveLiveSeriesDeltaDisplayDigits(2, -1.25)).toBe(0)
  })
})
