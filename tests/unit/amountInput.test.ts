import { describe, expect, it } from 'vitest'

import { formatDisplayAmount, getAmountSizeClass, MAX_AMOUNT_INPUT, sanitizeNumericInput } from '@/lib/amount-input'

describe('amount input helpers', () => {
  it('sanitizeNumericInput keeps digits and a single decimal with 2 places', () => {
    expect(sanitizeNumericInput('abc')).toBe('')
    expect(sanitizeNumericInput('$1,234.50')).toBe('1234.50')
    expect(sanitizeNumericInput('1.2.3')).toBe('1.23')
    expect(sanitizeNumericInput('00012.3400')).toBe('00012.34')
  })

  it('sanitizeNumericInput caps whole digits to MAX_AMOUNT_INPUT length', () => {
    const tooManyDigits = '9'.repeat(String(MAX_AMOUNT_INPUT).length + 5)
    expect(sanitizeNumericInput(tooManyDigits).length).toBe(String(MAX_AMOUNT_INPUT).length)
  })

  it('formatDisplayAmount adds commas and preserves trailing dot', () => {
    expect(formatDisplayAmount('')).toBe('')
    expect(formatDisplayAmount('1234')).toBe('1,234')
    expect(formatDisplayAmount('1234.')).toBe('1,234.')
    expect(formatDisplayAmount('1234.5')).toBe('1,234.5')
    expect(formatDisplayAmount('00012.34')).toBe('12.34')
  })

  it('getAmountSizeClass ignores leading zeros for digit count', () => {
    expect(getAmountSizeClass('0')).toBe('text-4xl')
    expect(getAmountSizeClass('0000000')).toBe('text-4xl')
    expect(getAmountSizeClass('1234567')).toBe('text-3xl')
    expect(getAmountSizeClass('123456789')).toBe('text-2xl')
  })
})
