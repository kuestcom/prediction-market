import { describe, expect, it } from 'vitest'

import type { Event, EventSeriesEntry } from '@/types'

import { findNextHomeFeaturedSeriesEvent, resolveHomeFeaturedEventEndTimestamp } from '@/lib/home-featured-rollover'

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
})
