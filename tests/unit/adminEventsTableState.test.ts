import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ADMIN_EVENTS_TABLE_STATE,
  parseAdminEventsTableState,
  updateAdminEventsSearchParams,
} from '@/app/[locale]/admin/events/_lib/admin-events-table-state'
import { ADMIN_EVENT_ATTENTION_FILTERS } from '@/lib/admin-event-attention'

describe('admin events table URL state', () => {
  it.each(ADMIN_EVENT_ATTENTION_FILTERS)('preserves the shared attention filter %s', (attention) => {
    const state = parseAdminEventsTableState(new URLSearchParams({ attention }))

    expect(state.attention).toBe(attention)
  })

  it('parses every supported table parameter', () => {
    const state = parseAdminEventsTableState(new URLSearchParams(
      'search=election&category=politics&creator=0x1&series=daily&active=1'
      + '&attention=past-due-unresolved&sort=end_date&order=asc&page=3&pageSize=25',
    ))

    expect(state).toEqual({
      search: 'election',
      mainCategorySlug: 'politics',
      creator: '0x1',
      seriesSlug: 'daily',
      activeOnly: true,
      attention: 'past-due-unresolved',
      sortBy: 'end_date',
      sortOrder: 'asc',
      pageIndex: 2,
      pageSize: 25,
    })
  })

  it('falls back safely for invalid values', () => {
    const state = parseAdminEventsTableState(new URLSearchParams(
      'attention=invalid&sort=invalid&order=invalid&page=-1&pageSize=500',
    ))

    expect(state).toEqual(DEFAULT_ADMIN_EVENTS_TABLE_STATE)
  })

  it('serializes non-default state and preserves unrelated parameters', () => {
    const searchParams = updateAdminEventsSearchParams(
      new URLSearchParams('source=dashboard'),
      {
        search: 'election',
        mainCategorySlug: 'politics',
        creator: '0x1',
        seriesSlug: 'daily',
        activeOnly: true,
        attention: 'past-due-unresolved',
        sortBy: 'end_date',
        sortOrder: 'asc',
        pageIndex: 2,
        pageSize: 25,
      },
    )

    expect(searchParams.get('source')).toBe('dashboard')
    expect(parseAdminEventsTableState(searchParams)).toEqual({
      search: 'election',
      mainCategorySlug: 'politics',
      creator: '0x1',
      seriesSlug: 'daily',
      activeOnly: true,
      attention: 'past-due-unresolved',
      sortBy: 'end_date',
      sortOrder: 'asc',
      pageIndex: 2,
      pageSize: 25,
    })
  })

  it('removes default values from the query', () => {
    const searchParams = updateAdminEventsSearchParams(
      new URLSearchParams(
        'search=election&category=politics&creator=0x1&series=daily&active=1'
        + '&attention=past-due-unresolved&sort=end_date&order=asc&page=3&pageSize=25',
      ),
      DEFAULT_ADMIN_EVENTS_TABLE_STATE,
    )

    expect(searchParams.toString()).toBe('')
  })
})
