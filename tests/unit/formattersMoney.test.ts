import { describe, expect, it } from 'vitest'
import { formatAmountInputValue, formatCentsLabel, formatCentsValueLabel, formatCurrency, formatDate, formatDollarValueLabel, formatPercent, formatSharePriceLabel, formatTimeAgo, formatVolume, fromMicro, toCents, toMicro, truncateAddress } from '@/lib/formatters'

describe('money/price formatters', () => {
  it('toMicro rounds to nearest micro', () => {
    expect(toMicro(0)).toBe('0')
    expect(toMicro(1)).toBe('1000000')
    expect(toMicro(0.0000004)).toBe('0')
    expect(toMicro(0.0000005)).toBe('1')
    expect(toMicro('12.3456789')).toBe('12345679')
  })

  it('fromMicro formats with precision', () => {
    expect(fromMicro('0')).toBe('0.0')
    expect(fromMicro('1000000')).toBe('1.0')
    expect(fromMicro('1234567', 6)).toBe('1.234567')
    expect(fromMicro('not-a-number', 2)).toBe('0.00')
  })

  it('toCents clamps numeric 0..1 and returns null for nullish', () => {
    expect(toCents(null)).toBeNull()
    expect(toCents(undefined)).toBeNull()
    expect(toCents(-10)).toBe(0)
    expect(toCents(0.3333)).toBe(33.3)
    expect(toCents(10)).toBe(100)
  })

  it('formatCentsLabel handles null/NaN and <1 vs >=1 inputs', () => {
    expect(formatCentsLabel(null)).toBe('—')
    expect(formatCentsLabel('nope')).toBe('—')
    expect(formatCentsLabel(0.5)).toBe('50¢')
    expect(formatCentsLabel(0.03)).toBe('3¢')
    expect(formatCentsLabel(55.56)).toBe('55.6¢')
  })

  it('formatCentsValueLabel treats input as cents', () => {
    expect(formatCentsValueLabel(null)).toBe('—')
    expect(formatCentsValueLabel('nope')).toBe('—')
    expect(formatCentsValueLabel(-1)).toBe('0¢')
    expect(formatCentsValueLabel(0.1)).toBe('0.1¢')
    expect(formatCentsValueLabel(1)).toBe('1¢')
    expect(formatCentsValueLabel(100)).toBe('100¢')
  })

  it('formatSharePriceLabel formats sub-dollar as cents and >=1 as currency', () => {
    expect(formatSharePriceLabel(null)).toBe('50.0¢')
    expect(formatSharePriceLabel(-0.01)).toBe('0¢')
    expect(formatSharePriceLabel(0.01)).toBe('1¢')
    expect(formatSharePriceLabel('0.5')).toBe('50¢')
    expect(formatSharePriceLabel(1)).toBe('$1.00')
    expect(formatSharePriceLabel(12.345, { currencyDigits: 1 })).toBe('$12.3')
  })

  it('formatDollarValueLabel formats sub-dollar totals as cents', () => {
    expect(formatDollarValueLabel(null)).toBe('—')
    expect(formatDollarValueLabel(0.001)).toBe('0.1¢')
    expect(formatDollarValueLabel(0.01)).toBe('1¢')
    expect(formatDollarValueLabel(1)).toBe('$1.00')
    expect(formatDollarValueLabel(12.345)).toBe('$12.35')
  })

  it('formatAmountInputValue normalizes to 2 decimals and omits zeros', () => {
    expect(formatAmountInputValue(Number.NaN)).toBe('')
    expect(formatAmountInputValue(0)).toBe('')
    expect(formatAmountInputValue(0.001)).toBe('')
    expect(formatAmountInputValue(1)).toBe('1')
    expect(formatAmountInputValue(1.239)).toBe('1.24')
    expect(formatAmountInputValue(-10)).toBe('')
  })

  it('formatCurrency supports stripping the symbol', () => {
    expect(formatCurrency(12.3, { includeSymbol: false })).toBe('12.30')
    expect(formatCurrency(Number.NaN, { includeSymbol: false })).toBe('0.00')
  })

  it('formatPercent supports stripping the symbol', () => {
    expect(formatPercent(1, { includeSymbol: false })).toBe('1.00')
    expect(formatPercent(Number.NaN, { includeSymbol: false })).toBe('0.00')
  })

  it('formatVolume handles negatives and scales', () => {
    expect(formatVolume(-1)).toBe('$0')
    expect(formatVolume(999)).toBe('$999')
    expect(formatVolume(1000)).toBe('$1k')
    expect(formatVolume(1_000_000)).toBe('$1.0M')
  })

  it('formatDate and formatTimeAgo are deterministic enough', () => {
    expect(formatDate(new Date(Date.UTC(2020, 0, 2)))).toBe('Jan 2, 2020')
    expect(formatTimeAgo(new Date(Date.now()).toISOString())).toMatch(/s ago$/)
  })

  it('formatTimeAgo clamps near-future timestamps to 0s ago', () => {
    const futureDate = new Date(Date.now() + 500).toISOString()
    expect(formatTimeAgo(futureDate)).toBe('0s ago')
  })

  it('truncateAddress shortens and handles empty', () => {
    expect(truncateAddress('')).toBe('')
    expect(truncateAddress('0x1234567890abcdef')).toBe('0x12…abcdef')
  })
})
