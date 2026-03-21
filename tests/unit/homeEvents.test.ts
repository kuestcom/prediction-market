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
})
