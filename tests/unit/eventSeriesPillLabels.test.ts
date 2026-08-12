import { describe, expect, it } from 'vitest'

import {
  isLiveSeriesPillStackCadence,
  resolveLiveSeriesPillLabel,
  resolveLiveSeriesPillVisibility,
} from '@/app/[locale]/(platform)/event/[slug]/_utils/eventSeriesPillLabels'

describe('resolveLiveSeriesPillLabel', () => {
  it('shows only the date for daily series', () => {
    expect(
      resolveLiveSeriesPillLabel({
        dateLabel: 'Jul 23',
        isDailySeries: true,
        isToday: true,
        timeLabel: '12 PM',
      }),
    ).toBe('Jul 23')

    expect(
      resolveLiveSeriesPillLabel({
        dateLabel: 'Jul 24',
        isDailySeries: true,
        isToday: false,
        timeLabel: '12 PM',
      }),
    ).toBe('Jul 24')
  })

  it('keeps time labels for intraday series', () => {
    expect(
      resolveLiveSeriesPillLabel({
        dateLabel: 'Jul 23',
        isDailySeries: false,
        isToday: true,
        timeLabel: '2 PM',
      }),
    ).toBe('2 PM')

    expect(
      resolveLiveSeriesPillLabel({
        dateLabel: 'Jul 24',
        isDailySeries: false,
        isToday: false,
        timeLabel: '2 PM',
      }),
    ).toBe('2 PM Jul 24')
  })

  it('keeps LIVE and the next three short-cadence pills visible and moves the rest into More', () => {
    const events = [
      { id: 'event-1', slug: 'event-1' },
      { id: 'event-2', slug: 'event-2' },
      { id: 'event-3', slug: 'event-3' },
      { id: 'event-4', slug: 'event-4' },
      { id: 'event-5', slug: 'event-5' },
      { id: 'event-6', slug: 'event-6' },
    ]

    expect(
      resolveLiveSeriesPillVisibility({
        currentEventSlug: 'event-1',
        currentTradingEventId: 'event-1',
        events,
        shouldStack: true,
      }),
    ).toEqual({
      visibleEvents: events.slice(0, 4),
      overflowEvents: events.slice(4),
    })
  })

  it('keeps a selected future short-cadence event visible', () => {
    const events = [
      { id: 'event-1', slug: 'event-1' },
      { id: 'event-2', slug: 'event-2' },
      { id: 'event-3', slug: 'event-3' },
      { id: 'event-4', slug: 'event-4' },
      { id: 'event-5', slug: 'event-5' },
      { id: 'event-6', slug: 'event-6' },
    ]

    const result = resolveLiveSeriesPillVisibility({
      currentEventSlug: 'event-6',
      currentTradingEventId: 'event-1',
      events,
      shouldStack: true,
    })

    expect(result.visibleEvents).toEqual([...events.slice(0, 4), events[5]])
    expect(result.overflowEvents).toEqual([events[4]])
  })

  it('keeps two future pills visible without More', () => {
    const events = [
      { id: 'event-1', slug: 'event-1' },
      { id: 'event-2', slug: 'event-2' },
      { id: 'event-3', slug: 'event-3' },
    ]

    expect(
      resolveLiveSeriesPillVisibility({
        currentEventSlug: 'event-1',
        currentTradingEventId: 'event-1',
        events,
        shouldStack: true,
      }),
    ).toEqual({
      visibleEvents: events,
      overflowEvents: [],
    })
  })

  it('does not stack daily cadence pills', () => {
    const events = [
      { id: 'event-1', slug: 'event-1' },
      { id: 'event-2', slug: 'event-2' },
      { id: 'event-3', slug: 'event-3' },
      { id: 'event-4', slug: 'event-4' },
    ]

    expect(
      resolveLiveSeriesPillVisibility({
        currentEventSlug: 'event-1',
        currentTradingEventId: 'event-1',
        events,
        shouldStack: false,
      }),
    ).toEqual({
      visibleEvents: events,
      overflowEvents: [],
    })
  })
})

describe('isLiveSeriesPillStackCadence', () => {
  it.each([5, 15, 60, 4 * 60])('stacks %i-minute series', (minutes) => {
    expect(isLiveSeriesPillStackCadence(minutes * 60 * 1000)).toBe(true)
  })

  it('does not stack daily series', () => {
    expect(isLiveSeriesPillStackCadence(24 * 60 * 60 * 1000)).toBe(false)
  })
})
