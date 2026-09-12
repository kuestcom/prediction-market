import { describe, expect, it } from 'bun:test'

import { formatEventExpiryCountdown } from '@/app/[locale]/(platform)/event/[slug]/_utils/eventExpiryCountdown'

const currentTimestamp = Date.parse('2026-09-12T12:00:00.000Z')

describe('formatEventExpiryCountdown', () => {
  it('keeps only days from seven days onward', () => {
    expect(formatEventExpiryCountdown(currentTimestamp + 7 * 86_400_000 + 4 * 3_600_000, currentTimestamp)).toBe('7d')
  })

  it('adds hours while the remaining time is below seven days', () => {
    expect(formatEventExpiryCountdown(currentTimestamp + 3 * 86_400_000 + 5 * 3_600_000, currentTimestamp)).toBe(
      '3d 5h',
    )
  })

  it('uses hours and minutes below one day, then minutes below one hour', () => {
    expect(formatEventExpiryCountdown(currentTimestamp + 5 * 3_600_000 + 12 * 60_000, currentTimestamp)).toBe('5h 12m')
    expect(formatEventExpiryCountdown(currentTimestamp + 42 * 60_000, currentTimestamp)).toBe('42m')
  })

  it('rounds a partial minute up so it never displays zero minutes for future time', () => {
    expect(formatEventExpiryCountdown(currentTimestamp + 1_000, currentTimestamp)).toBe('1m')
  })
})
