import { describe, expect, it } from 'vitest'
import { filterHomeEvents } from '@/lib/home-events'

describe('filterHomeEvents', () => {
  it('keeps hide-from-new events visible in the general home filters', () => {
    const visibleEvent = {
      id: 'visible-event',
      slug: 'visible-event',
      status: 'active' as const,
      created_at: '2026-03-20T12:00:00.000Z',
      updated_at: '2026-03-20T12:00:00.000Z',
      tags: [
        { slug: 'finance' },
        { slug: 'acquisitions' },
      ],
      markets: [{ is_resolved: false }],
    }
    const hiddenEvent = {
      id: 'hidden-event',
      slug: 'hidden-event',
      status: 'active' as const,
      created_at: '2026-03-20T12:05:00.000Z',
      updated_at: '2026-03-20T12:05:00.000Z',
      tags: [
        { slug: 'finance' },
        { slug: 'hide-from-new' },
      ],
      markets: [{ is_resolved: false }],
    }

    expect(filterHomeEvents([visibleEvent, hiddenEvent])).toEqual([visibleEvent, hiddenEvent])
  })

  it('does not hide events when hide-from-new appears in main_tag data', () => {
    const visibleEvent = {
      id: 'visible-event',
      slug: 'visible-event',
      status: 'active' as const,
      created_at: '2026-03-20T12:00:00.000Z',
      updated_at: '2026-03-20T12:00:00.000Z',
      main_tag: 'finance',
      markets: [{ is_resolved: false }],
    }
    const hiddenEvent = {
      id: 'hidden-event',
      slug: 'hidden-event',
      status: 'active' as const,
      created_at: '2026-03-20T12:05:00.000Z',
      updated_at: '2026-03-20T12:05:00.000Z',
      main_tag: 'hide-from-new',
      markets: [{ is_resolved: false }],
    }

    expect(filterHomeEvents([visibleEvent, hiddenEvent])).toEqual([visibleEvent, hiddenEvent])
  })

  it('keeps resolved events while still deduplicating active series entries for the all status', () => {
    const laterActiveEvent = {
      id: 'later-active-event',
      slug: 'later-active-event',
      series_slug: 'meta-series',
      status: 'active' as const,
      end_date: '2026-03-31T12:00:00.000Z',
      created_at: '2026-03-20T12:00:00.000Z',
      updated_at: '2026-03-20T12:00:00.000Z',
      markets: [{ is_resolved: false }],
    }
    const soonerActiveEvent = {
      id: 'sooner-active-event',
      slug: 'sooner-active-event',
      series_slug: 'meta-series',
      status: 'active' as const,
      end_date: '2026-03-27T12:00:00.000Z',
      created_at: '2026-03-21T12:00:00.000Z',
      updated_at: '2026-03-21T12:00:00.000Z',
      markets: [{ is_resolved: false }],
    }
    const resolvedEvent = {
      id: 'resolved-event',
      slug: 'resolved-event',
      series_slug: 'meta-series',
      status: 'resolved' as const,
      end_date: '2026-03-24T12:00:00.000Z',
      created_at: '2026-03-24T12:00:00.000Z',
      updated_at: '2026-03-24T12:00:00.000Z',
      markets: [{ is_resolved: true }],
    }

    expect(filterHomeEvents(
      [laterActiveEvent, soonerActiveEvent, resolvedEvent],
      {
        currentTimestamp: Date.parse('2026-03-25T12:00:00.000Z'),
        status: 'all',
      },
    )).toEqual([soonerActiveEvent, resolvedEvent])
  })
})
