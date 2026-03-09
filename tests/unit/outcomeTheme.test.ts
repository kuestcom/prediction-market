import { describe, expect, it } from 'vitest'
import { resolveOutcomeButtonTheme } from '@/lib/outcome-theme'

describe('resolveOutcomeButtonTheme', () => {
  it('matches whole outcome words without false positives from names', () => {
    expect(resolveOutcomeButtonTheme('North Carolina', 0)).toEqual({
      background: '#eef4ff',
      color: '#3468d6',
    })
    expect(resolveOutcomeButtonTheme('Novak Djokovic', 1)).toEqual({
      background: '#f4efff',
      color: '#7c4ed8',
    })
    expect(resolveOutcomeButtonTheme('Norway', 0)).toEqual({
      background: '#eef4ff',
      color: '#3468d6',
    })
  })

  it('preserves expected positive and negative outcome styling', () => {
    expect(resolveOutcomeButtonTheme('No', 0)).toEqual({
      background: '#fbeaea',
      color: '#d65757',
    })
    expect(resolveOutcomeButtonTheme('Under 2.5', 0)).toEqual({
      background: '#fbeaea',
      color: '#d65757',
    })
    expect(resolveOutcomeButtonTheme('Will win', 0)).toEqual({
      background: '#e8f5ee',
      color: '#2b9a68',
    })
  })
})
