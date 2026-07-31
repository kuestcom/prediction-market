import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'

import type { AdminPaginatedFetchParams } from '@/app/[locale]/admin/_hooks/useAdminPaginatedResource'
import type {
  AdminEventsSortBy,
  AdminEventsTableState,
  AdminEventsTableStatePatch,
} from '@/app/[locale]/admin/events/_lib/admin-events-table-state'
import type { AdminEventAttentionFilter } from '@/lib/admin-event-attention'
import type { Event } from '@/types'

import {
  DEFAULT_ADMIN_EVENTS_TABLE_STATE,
  isAdminEventsSortBy,
} from '@/app/[locale]/admin/events/_lib/admin-events-table-state'

export interface AdminEventRow {
  id: string
  slug: string
  title: string
  status: Event['status']
  icon_url: string
  livestream_url: string | null
  additional_context: string | null
  additional_context_updated_at: string | null
  series_slug: string | null
  series_recurrence: string | null
  volume: number
  volume_24h: number
  is_hidden: boolean
  sports_score: string | null
  sports_live: boolean | null
  sports_ended: boolean | null
  sports_event_date: string | null
  sports_start_time: string | null
  sports_teams: Array<{ name?: string | null; abbreviation?: string | null; logo_url?: string | null }> | null
  sports_team_logo_urls: string[] | null
  sports_sport_slug: string | null
  sports_league_slug: string | null
  sports_series_slug: string | null
  sports_source_provider: string | null
  sports_source_event_id: string | null
  sports_source_game_id: string | null
  sports_source_league_id: string | null
  sports_source_league_label: string | null
  sports_source_match_confidence: string | null
  sports_vertical: 'sports' | 'esports' | null
  is_sports_games_moneyline: boolean
  end_date: string | null
  created_at: string
  updated_at: string
}

interface AdminEventsQueryFilters {
  mainCategorySlug?: string | null
  creator?: string | null
  seriesSlug?: string | null
  activeOnly: boolean
  attention?: AdminEventAttentionFilter | null
}

interface AdminEventsResponse {
  data: AdminEventRow[]
  totalCount: number
  creatorOptions: string[]
  seriesOptions: string[]
}

async function fetchAdminEvents(
  params: AdminPaginatedFetchParams<AdminEventsSortBy> & AdminEventsQueryFilters,
): Promise<AdminEventsResponse> {
  const {
    limit,
    offset,
    search,
    sortBy,
    sortOrder,
    mainCategorySlug = null,
    creator = null,
    seriesSlug = null,
    activeOnly,
    attention = null,
  } = params

  const searchParams = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
    sortBy,
    sortOrder,
  })

  if (search && search.trim()) {
    searchParams.set('search', search.trim())
  }
  if (mainCategorySlug && mainCategorySlug.trim()) {
    searchParams.set('mainCategorySlug', mainCategorySlug.trim())
  }
  if (creator && creator.trim()) {
    searchParams.set('creator', creator.trim())
  }
  if (seriesSlug && seriesSlug.trim()) {
    searchParams.set('seriesSlug', seriesSlug.trim())
  }
  if (activeOnly) {
    searchParams.set('activeOnly', '1')
  }
  if (attention) {
    searchParams.set('attention', attention)
  }

  const response = await fetch(`/admin/api/events?${searchParams.toString()}`)
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    const message = typeof payload?.error === 'string' ? payload.error : response.statusText
    throw new Error(message || 'Failed to fetch events')
  }

  return response.json()
}

function resolveAdminEventsQueryFilters(state: AdminEventsTableState): AdminEventsQueryFilters {
  return {
    mainCategorySlug: state.mainCategorySlug === 'all' ? null : state.mainCategorySlug,
    creator: state.creator === 'all' ? null : state.creator,
    seriesSlug: state.seriesSlug === 'all' ? null : state.seriesSlug,
    activeOnly: state.activeOnly,
    attention: state.attention === 'all' ? null : state.attention,
  }
}

export function useAdminEventsTable(
  state: AdminEventsTableState,
  onStateChange: (patch: AdminEventsTableStatePatch) => void,
) {
  const queryParams = useMemo(
    () => ({
      limit: state.pageSize,
      offset: state.pageIndex * state.pageSize,
      search: state.search,
      sortBy: state.sortBy,
      sortOrder: state.sortOrder,
      pageIndex: state.pageIndex,
      ...resolveAdminEventsQueryFilters(state),
    }),
    [state],
  )
  const query = useQuery({
    queryKey: ['admin-events', queryParams],
    queryFn: () => fetchAdminEvents(queryParams),
    staleTime: 30_000,
    gcTime: 300_000,
  })
  const { data, error, isLoading, refetch } = query

  const retry = useCallback(() => {
    void refetch()
  }, [refetch])

  const handleSearchChange = useCallback(
    (search: string) => {
      onStateChange({ search, pageIndex: 0 })
    },
    [onStateChange],
  )

  const handleSortChange = useCallback(
    (column: string | null, order: 'asc' | 'desc' | null) => {
      if (!column || !order || !isAdminEventsSortBy(column)) {
        onStateChange({
          sortBy: DEFAULT_ADMIN_EVENTS_TABLE_STATE.sortBy,
          sortOrder: DEFAULT_ADMIN_EVENTS_TABLE_STATE.sortOrder,
          pageIndex: 0,
        })
        return
      }

      onStateChange({ sortBy: column, sortOrder: order, pageIndex: 0 })
    },
    [onStateChange],
  )

  const handleFiltersChange = useCallback(
    (
      filters: Pick<AdminEventsTableState, 'mainCategorySlug' | 'creator' | 'seriesSlug' | 'activeOnly' | 'attention'>,
    ) => {
      onStateChange({ ...filters, pageIndex: 0 })
    },
    [onStateChange],
  )

  const handleActiveOnlyChange = useCallback(
    (activeOnly: boolean) => {
      onStateChange({ activeOnly, pageIndex: 0 })
    },
    [onStateChange],
  )

  const handlePageChange = useCallback(
    (pageIndex: number) => {
      onStateChange({ pageIndex })
    },
    [onStateChange],
  )

  const handlePageSizeChange = useCallback(
    (pageSize: number) => {
      onStateChange({ pageSize, pageIndex: 0 })
    },
    [onStateChange],
  )

  return {
    ...query,
    events: data?.data || [],
    totalCount: data?.totalCount || 0,
    isLoading,
    error: error?.message || null,
    retry,
    pageIndex: state.pageIndex,
    pageSize: state.pageSize,
    search: state.search,
    sortBy: state.sortBy,
    sortOrder: state.sortOrder,
    mainCategorySlug: state.mainCategorySlug,
    creator: state.creator,
    seriesSlug: state.seriesSlug,
    activeOnly: state.activeOnly,
    attention: state.attention,
    creatorOptions: data?.creatorOptions || [],
    seriesOptions: data?.seriesOptions || [],
    handleSearchChange,
    handleSortChange,
    handleFiltersChange,
    handleActiveOnlyChange,
    handlePageChange,
    handlePageSizeChange,
  }
}
