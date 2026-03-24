import { describe, expect, it } from 'vitest'
import { filterHomeEvents, isHomeEventResolvedLike } from '@/lib/home-events'

describe('home-events', () => {
  it('treats active events with unresolved markets as not resolved-like', () => {
    const event = {
      id: 'event-1',
      slug: 'highest-temperature-in-sao-paulo-on-march-24-2026',
      status: 'active',
      created_at: '2026-03-24T00:00:00.000Z',
      updated_at: '2026-03-24T00:00:00.000Z',
      markets: [
        {
          is_resolved: true,
          condition: { resolved: true },
        },
        {
          is_resolved: false,
          condition: { resolved: false },
        },
      ],
      tags: [],
    } as any

    expect(isHomeEventResolvedLike(event)).toBe(false)
  })

  it('keeps only fully resolved events in the resolved home filter', () => {
    const partiallyResolvedEvent = {
      id: 'event-1',
      slug: 'highest-temperature-in-sao-paulo-on-march-24-2026',
      status: 'active',
      created_at: '2026-03-24T00:00:00.000Z',
      updated_at: '2026-03-24T00:00:00.000Z',
      markets: [
        {
          is_resolved: true,
          condition: { resolved: true },
        },
        {
          is_resolved: false,
          condition: { resolved: false },
        },
      ],
      tags: [],
    } as any

    const fullyResolvedEvent = {
      id: 'event-2',
      slug: 'bra-san-vas-2026-02-26',
      status: 'active',
      created_at: '2026-03-24T00:00:00.000Z',
      updated_at: '2026-03-24T00:00:00.000Z',
      markets: [
        {
          is_resolved: true,
          condition: { resolved: true },
        },
        {
          is_resolved: true,
          condition: { resolved: true },
        },
      ],
      tags: [],
    } as any

    const resolvedStatusEvent = {
      id: 'event-3',
      slug: 'resolved-event',
      status: 'resolved',
      created_at: '2026-03-24T00:00:00.000Z',
      updated_at: '2026-03-24T00:00:00.000Z',
      markets: [
        {
          is_resolved: true,
          condition: { resolved: true },
        },
      ],
      tags: [],
    } as any

    expect(filterHomeEvents(
      [partiallyResolvedEvent, fullyResolvedEvent, resolvedStatusEvent],
      { status: 'resolved' },
    )).toEqual([fullyResolvedEvent, resolvedStatusEvent])
  })
})
