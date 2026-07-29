import { describe, expect, it } from 'vitest'

import {
  resolveLiveSeriesPillLabel,
  resolveShortCadenceSeriesPillVisibility,
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

  it('keeps only two short-cadence pills visible and moves the rest into More', () => {
    const events = [
      { id: 'event-1', slug: 'event-1' },
      { id: 'event-2', slug: 'event-2' },
      { id: 'event-3', slug: 'event-3' },
      { id: 'event-4', slug: 'event-4' },
    ]

    expect(
      resolveShortCadenceSeriesPillVisibility({
        currentEventSlug: 'event-1',
        currentTradingEventId: 'event-1',
        events,
        isShortCadence: true,
      }),
    ).toEqual({
      visibleEvents: events.slice(0, 2),
      overflowEvents: events.slice(2),
    })
  })

  it('keeps a selected future short-cadence event visible', () => {
    const events = [
      { id: 'event-1', slug: 'event-1' },
      { id: 'event-2', slug: 'event-2' },
      { id: 'event-3', slug: 'event-3' },
      { id: 'event-4', slug: 'event-4' },
    ]

    const result = resolveShortCadenceSeriesPillVisibility({
      currentEventSlug: 'event-4',
      currentTradingEventId: 'event-1',
      events,
      isShortCadence: true,
    })

    expect(result.visibleEvents).toEqual(events.slice(2))
    expect(result.overflowEvents).toEqual(events.slice(0, 2))
  })

  it('does not collapse longer cadence pills', () => {
    const events = [
      { id: 'event-1', slug: 'event-1' },
      { id: 'event-2', slug: 'event-2' },
      { id: 'event-3', slug: 'event-3' },
    ]

    expect(
      resolveShortCadenceSeriesPillVisibility({
        currentEventSlug: 'event-1',
        currentTradingEventId: 'event-1',
        events,
        isShortCadence: false,
      }),
    ).toEqual({
      visibleEvents: events,
      overflowEvents: [],
    })
  })
})
