import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useOrderFeedbackTranslate } from '@/app/[locale]/(platform)/event/[slug]/_components/feedback'

vi.mock('next-intl', () => ({
  useExtracted: () => (message: string) => {
    if (message === 'An unexpected error occurred. Please try again.') {
      return 'Ocorreu um erro inesperado. Tente novamente.'
    }

    return message
  },
}))

describe('useOrderFeedbackTranslate', () => {
  it('translates the unexpected error used by the sell flow', () => {
    const { result } = renderHook(() => useOrderFeedbackTranslate())

    expect(result.current('An unexpected error occurred. Please try again.')).toBe(
      'Ocorreu um erro inesperado. Tente novamente.',
    )
  })
})
