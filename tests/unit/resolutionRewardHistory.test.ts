import { describe, expect, it } from 'vitest'

import { parseResolutionHistoryCount } from '@/lib/resolution-reward-history'

describe('parseResolutionHistoryCount', () => {
  it.each([
    ['4', 4],
    [0, 0],
    [12, 12],
  ])('accepts a safe non-negative integer count', (value, expected) => {
    expect(parseResolutionHistoryCount(value)).toBe(expected)
  })

  it.each([-1, '-1', 1.5, '1.5', Number.POSITIVE_INFINITY, 'invalid', '', null, true])(
    'rejects an invalid count',
    (value) => {
      expect(parseResolutionHistoryCount(value)).toBeNull()
    },
  )
})
