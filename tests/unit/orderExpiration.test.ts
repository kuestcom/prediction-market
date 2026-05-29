import { describe, expect, it } from 'vitest'
import {
  resolveEndOfDayTimestamp,
  resolveOrderExpirationTimestamp,
  resolveValidCustomExpirationTimestamp,
} from '@/lib/orders/expiration'

describe('order expiration helpers', () => {
  it('returns null for never and preserves valid custom timestamps', () => {
    expect(resolveOrderExpirationTimestamp({
      limitExpirationOption: 'never',
      limitExpirationTimestamp: null,
      nowMs: 1_700_000_000_500,
    })).toBeNull()

    expect(resolveValidCustomExpirationTimestamp({
      limitExpirationOption: 'custom',
      limitExpirationTimestamp: 1_700_000_100,
      nowSeconds: 1_700_000_000,
    })).toBe(1_700_000_100)

    expect(resolveValidCustomExpirationTimestamp({
      limitExpirationOption: 'custom',
      limitExpirationTimestamp: 1_699_999_999,
      nowSeconds: 1_700_000_000,
    })).toBeNull()
  })

  it('calculates preset expirations from the current timestamp', () => {
    expect(resolveOrderExpirationTimestamp({
      limitExpirationOption: '5m',
      limitExpirationTimestamp: null,
      nowMs: 1_700_000_000_500,
    })).toBe(1_700_000_300)

    expect(resolveOrderExpirationTimestamp({
      limitExpirationOption: '24h',
      limitExpirationTimestamp: null,
      nowMs: 1_700_000_000_500,
    })).toBe(1_700_086_400)
  })

  it('keeps end of day in the future even at the day boundary', () => {
    const midday = new Date(2026, 0, 1, 12, 0, 0, 0)
    const middayExpected = new Date(midday.getTime())
    middayExpected.setHours(23, 59, 59, 0)
    expect(resolveEndOfDayTimestamp(midday.getTime())).toBe(Math.floor(middayExpected.getTime() / 1000))

    const boundary = new Date(2026, 0, 1, 23, 59, 59, 500)
    const boundaryExpected = new Date(boundary.getTime())
    boundaryExpected.setDate(boundaryExpected.getDate() + 1)
    boundaryExpected.setHours(23, 59, 59, 0)
    expect(resolveEndOfDayTimestamp(boundary.getTime())).toBe(Math.floor(boundaryExpected.getTime() / 1000))
  })
})
