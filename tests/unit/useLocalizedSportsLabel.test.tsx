import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useLocalizedSportsLabel } from '@/app/[locale]/(platform)/sports/_components/useLocalizedSportsLabel'

vi.mock('next-intl', () => ({
  useExtracted: () => (message: string) => {
    const translations: Record<string, string> = {
      Draw: 'Empate',
      Over: 'Acima',
      Under: 'Abaixo',
    }

    return translations[message] ?? message
  },
}))

describe('useLocalizedSportsLabel', () => {
  it('translates a known outcome before restoring its half suffix', () => {
    const { result } = renderHook(() => useLocalizedSportsLabel())

    expect(result.current('DRAW 1H')).toBe('Empate 1H')
    expect(result.current('DRAW 2H')).toBe('Empate 2H')
  })

  it('translates total outcomes while preserving their line value', () => {
    const { result } = renderHook(() => useLocalizedSportsLabel())

    expect(result.current('OVER 2.5')).toBe('Acima 2.5')
    expect(result.current('UNDER 1.5')).toBe('Abaixo 1.5')
  })

  it('does not treat unrelated labels beginning with over or under as totals', () => {
    const { result } = renderHook(() => useLocalizedSportsLabel())

    expect(result.current('Under contract')).toBe('Under contract')
    expect(result.current('Over budget')).toBe('Over budget')
  })
})
