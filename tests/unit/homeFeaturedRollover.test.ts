import { describe, expect, it } from 'bun:test'

import type { Event, EventSeriesEntry } from '@/types'

import {
  findNextHomeFeaturedSeriesEvent,
  isHomeFeaturedEventEnded,
  resolveHomeFeaturedEventEndTimestamp,
} from '@/lib/home-featured-rollover'

function createEvent(): Event {
  return {
    id: 'current',
    slug: 'current-event',
    end_date: '2026-08-13T16:00:00.000Z',
    markets: [{ end_time: '2026-08-13T16:05:00.000Z' }],
  } as Event
}

function createSeriesEvent(id: string, endDate: string, status: Event['status'] = 'active'): EventSeriesEntry {
  return {
    id,
    slug: `${id}-event`,
    status,
    end_date: endDate,
    resolved_at: null,
    created_at: '2026-08-13T00:00:00.000Z',
    resolved_direction: null,
  }
}

describe('homeFeaturedRollover', () => {
  it('uses the latest market cutoff as the exact rollover time', () => {
    expect(resolveHomeFeaturedEventEndTimestamp(createEvent())).toBe(Date.parse('2026-08-13T16:05:00.000Z'))
  })

  it('allows rollover as soon as the current event is resolved', () => {
    expect(
      isHomeFeaturedEventEnded(
        createEventWithOverrides({ status: 'resolved', resolved_at: '2026-08-13T16:01:00.000Z' }),
        Date.parse('2026-08-13T16:02:00.000Z'),
      ),
    ).toBe(true)
  })

  it('treats an active event as ended after its latest market cutoff', () => {
    expect(isHomeFeaturedEventEnded(createEvent(), Date.parse('2026-08-13T16:05:00.000Z'))).toBe(true)
    expect(isHomeFeaturedEventEnded(createEvent(), Date.parse('2026-08-13T16:04:59.000Z'))).toBe(false)
  })

  it('selects the nearest active event after the current market', () => {
    const next = findNextHomeFeaturedSeriesEvent(
      [
        createSeriesEvent('later', '2026-08-13T16:15:00.000Z'),
        createSeriesEvent('resolved', '2026-08-13T16:06:00.000Z', 'resolved'),
        createSeriesEvent('next', '2026-08-13T16:10:00.000Z'),
      ],
      createEvent(),
    )

    expect(next?.id).toBe('next')
  })

  it('skips already expired successors when catching a stale featured card up to live', () => {
    const next = findNextHomeFeaturedSeriesEvent(
      [
        createSeriesEvent('expired-next', '2026-08-13T16:10:00.000Z'),
        createSeriesEvent('live-next', '2026-08-13T16:15:00.000Z'),
      ],
      createEvent(),
      Date.parse('2026-08-13T16:11:00.000Z'),
    )

    expect(next?.id).toBe('live-next')
  })
})

function createEventWithOverrides(overrides: Partial<Event>): Event {
  return { ...createEvent(), ...overrides }
}
