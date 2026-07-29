import type { ReactNode } from 'react'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AdminEventsTableState } from '@/app/[locale]/admin/events/_lib/admin-events-table-state'

import { useAdminEventsTable } from '@/app/[locale]/admin/events/_hooks/useAdminEvents'
import { DEFAULT_ADMIN_EVENTS_TABLE_STATE } from '@/app/[locale]/admin/events/_lib/admin-events-table-state'

const fetchMock = vi.fn()

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('useAdminEventsTable', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [],
        totalCount: 0,
        creatorOptions: [],
        seriesOptions: [],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('fetches with the complete URL-controlled state', async () => {
    const onStateChange = vi.fn()
    const view = renderHook(
      ({ state }: { state: AdminEventsTableState }) => useAdminEventsTable(state, onStateChange),
      {
        initialProps: {
          state: {
            ...DEFAULT_ADMIN_EVENTS_TABLE_STATE,
            pageIndex: 2,
            pageSize: 25,
            search: 'election',
            sortBy: 'end_date',
            sortOrder: 'asc',
            mainCategorySlug: 'politics',
            creator: '0x1',
            seriesSlug: 'daily',
            activeOnly: true,
            attention: 'past-due-unresolved',
          },
        },
        wrapper: createWrapper(),
      },
    )

    await waitFor(() => {
      const requestUrl = String(fetchMock.mock.lastCall?.[0])
      expect(requestUrl).toContain('limit=25')
      expect(requestUrl).toContain('offset=50')
      expect(requestUrl).toContain('search=election')
      expect(requestUrl).toContain('sortBy=end_date')
      expect(requestUrl).toContain('sortOrder=asc')
      expect(requestUrl).toContain('mainCategorySlug=politics')
      expect(requestUrl).toContain('creator=0x1')
      expect(requestUrl).toContain('seriesSlug=daily')
      expect(requestUrl).toContain('activeOnly=1')
      expect(requestUrl).toContain('attention=past-due-unresolved')
    })

    expect(view.result.current.pageIndex).toBe(2)
  })

  it('writes every table control through state patches', async () => {
    const onStateChange = vi.fn()
    const view = renderHook(() => useAdminEventsTable(DEFAULT_ADMIN_EVENTS_TABLE_STATE, onStateChange), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())

    act(() => {
      view.result.current.handleSearchChange('election')
      view.result.current.handleSortChange('end_date', 'asc')
      view.result.current.handleFiltersChange({
        mainCategorySlug: 'politics',
        creator: '0x1',
        seriesSlug: 'daily',
        activeOnly: true,
        attention: 'past-due-unresolved',
      })
      view.result.current.handleActiveOnlyChange(true)
      view.result.current.handlePageChange(2)
      view.result.current.handlePageSizeChange(25)
    })

    expect(onStateChange.mock.calls).toEqual([
      [{ search: 'election', pageIndex: 0 }],
      [{ sortBy: 'end_date', sortOrder: 'asc', pageIndex: 0 }],
      [
        {
          mainCategorySlug: 'politics',
          creator: '0x1',
          seriesSlug: 'daily',
          activeOnly: true,
          attention: 'past-due-unresolved',
          pageIndex: 0,
        },
      ],
      [{ activeOnly: true, pageIndex: 0 }],
      [{ pageIndex: 2 }],
      [{ pageSize: 25, pageIndex: 0 }],
    ])
  })
})
