import { describe, expect, it } from 'vitest'
import { shouldShowEventNewBadge } from '@/lib/event-new-badge'

function buildEvent(overrides: Partial<Parameters<typeof shouldShowEventNewBadge>[0]> = {}): Parameters<typeof shouldShowEventNewBadge>[0] {
  return {
    status: 'active',
    series_recurrence: null,
    created_at: new Date(0).toISOString(),
    markets: [{ created_at: new Date(0).toISOString() }],
    ...overrides,
  }
}

describe('shouldShowEventNewBadge', () => {
  it('does not show NEW for resolved events', () => {
    const event = buildEvent({
      status: 'resolved',
      series_recurrence: 'daily',
      markets: [{ created_at: new Date(0).toISOString() }],
    })

    expect(shouldShowEventNewBadge(event, 30 * 60 * 1000)).toBe(false)
  })

  it('uses a 2-hour window for daily recurrence', () => {
    const event = buildEvent({
      series_recurrence: 'daily',
      markets: [{ created_at: new Date(0).toISOString() }],
    })

    expect(shouldShowEventNewBadge(event, 2 * 60 * 60 * 1000)).toBe(true)
    expect(shouldShowEventNewBadge(event, 2 * 60 * 60 * 1000 + 1)).toBe(false)
  })

  it('uses a 10-minute window for sub-hourly recurrence', () => {
    const event = buildEvent({
      series_recurrence: '30m',
      markets: [{ created_at: new Date(0).toISOString() }],
    })

    expect(shouldShowEventNewBadge(event, 10 * 60 * 1000)).toBe(true)
    expect(shouldShowEventNewBadge(event, 10 * 60 * 1000 + 1)).toBe(false)
  })

  it('uses a 24-hour window for other recurrence values', () => {
    const event = buildEvent({
      series_recurrence: 'weekly',
      markets: [{ created_at: new Date(0).toISOString() }],
    })

    expect(shouldShowEventNewBadge(event, 24 * 60 * 60 * 1000)).toBe(true)
    expect(shouldShowEventNewBadge(event, 24 * 60 * 60 * 1000 + 1)).toBe(false)
  })

  it('falls back to event created_at when market timestamps are invalid', () => {
    const event = buildEvent({
      created_at: new Date(0).toISOString(),
      markets: [{ created_at: 'invalid-date' }],
    })

    expect(shouldShowEventNewBadge(event, 24 * 60 * 60 * 1000)).toBe(true)
  })
})
