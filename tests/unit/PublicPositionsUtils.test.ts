import { describe, expect, it } from 'vitest'
import { isActiveUserPositionsQueryKeyForAddress } from '@/app/[locale]/(platform)/profile/_utils/PublicPositionsUtils'

describe('publicPositionsUtils', () => {
  it('matches the current public positions query key shape', () => {
    expect(isActiveUserPositionsQueryKeyForAddress(
      ['user-positions', 'https://data-api.kuest.com', '0xAbC', 'active', 'All', '', 'currentValue', 'desc'],
      '0xabc',
    )).toBe(true)
  })

  it('keeps compatibility with the legacy public positions query key shape', () => {
    expect(isActiveUserPositionsQueryKeyForAddress(
      ['user-positions', '0xAbC', 'active'],
      '0xabc',
    )).toBe(true)
  })

  it('does not match closed positions or another address', () => {
    expect(isActiveUserPositionsQueryKeyForAddress(
      ['user-positions', 'https://data-api.kuest.com', '0xAbC', 'closed'],
      '0xabc',
    )).toBe(false)
    expect(isActiveUserPositionsQueryKeyForAddress(
      ['user-positions', 'https://data-api.kuest.com', '0xDef', 'active'],
      '0xabc',
    )).toBe(false)
  })
})
