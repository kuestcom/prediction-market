import type { AdminPaginatedFetchParams } from '@/app/[locale]/admin/_hooks/useAdminPaginatedResource'
import type { AdminEventAttentionFilter } from '@/lib/db/queries/admin-event-attention'
import type { Event } from '@/types'
import { useCallback } from 'react'
import { useAdminPaginatedResource } from '@/app/[locale]/admin/_hooks/useAdminPaginatedResource'

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
  sports_teams: Array<{ name?: string | null, abbreviation?: string | null }> | null
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

type AdminEventsSortBy = 'title' | 'status' | 'volume' | 'volume_24h' | 'created_at' | 'updated_at' | 'end_date'

interface AdminEventsTableFilters {
  mainCategorySlug: string
  creator: string
  seriesSlug: string
  activeOnly: boolean
  attention: AdminEventAttentionFilter | 'all'
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

function resolveAdminEventsQueryFilters(filters: AdminEventsTableFilters): AdminEventsQueryFilters {
  return {
    mainCategorySlug: filters.mainCategorySlug === 'all' ? null : filters.mainCategorySlug,
    creator: filters.creator === 'all' ? null : filters.creator,
    seriesSlug: filters.seriesSlug === 'all' ? null : filters.seriesSlug,
    activeOnly: filters.activeOnly,
    attention: filters.attention === 'all' ? null : filters.attention,
  }
}

export function useAdminEventsTable(initialAttention: AdminEventAttentionFilter | 'all' = 'all') {
  const {
    data,
    isLoading,
    error,
    retry,
    pageIndex,
    pageSize,
    search,
    sortBy,
    sortOrder,
    filters,
    handleSearchChange,
    handleSortChange,
    handlePageChange,
    handlePageSizeChange,
    handleFilterChange,
  } = useAdminPaginatedResource<
    AdminEventsResponse,
    AdminEventsSortBy,
    AdminEventsTableFilters,
    AdminEventsQueryFilters
  >({
    queryKey: 'admin-events',
    defaultSortBy: 'created_at',
    defaultSortOrder: 'desc',
    initialFilters: {
      mainCategorySlug: 'all',
      creator: 'all',
      seriesSlug: 'all',
      activeOnly: false,
      attention: initialAttention,
    },
    resolveQueryFilters: resolveAdminEventsQueryFilters,
    fetchResource: fetchAdminEvents,
  })

  const handleMainCategoryChange = useCallback((nextMainCategorySlug: string) => {
    handleFilterChange('mainCategorySlug', nextMainCategorySlug)
  }, [handleFilterChange])

  const handleActiveOnlyChange = useCallback((nextActiveOnly: boolean) => {
    handleFilterChange('activeOnly', nextActiveOnly)
  }, [handleFilterChange])

  const handleCreatorChange = useCallback((nextCreator: string) => {
    handleFilterChange('creator', nextCreator)
  }, [handleFilterChange])

  const handleSeriesSlugChange = useCallback((nextSeriesSlug: string) => {
    handleFilterChange('seriesSlug', nextSeriesSlug)
  }, [handleFilterChange])

  const handleAttentionChange = useCallback((nextAttention: AdminEventAttentionFilter | 'all') => {
    handleFilterChange('attention', nextAttention)
  }, [handleFilterChange])

  return {
    events: data?.data || [],
    totalCount: data?.totalCount || 0,
    isLoading,
    error: error?.message || null,
    retry,
    pageIndex,
    pageSize,
    search,
    sortBy,
    sortOrder,
    mainCategorySlug: filters.mainCategorySlug,
    creator: filters.creator,
    seriesSlug: filters.seriesSlug,
    activeOnly: filters.activeOnly,
    attention: filters.attention,
    creatorOptions: data?.creatorOptions || [],
    seriesOptions: data?.seriesOptions || [],
    handleSearchChange,
    handleSortChange,
    handleMainCategoryChange,
    handleCreatorChange,
    handleSeriesSlugChange,
    handleActiveOnlyChange,
    handleAttentionChange,
    handlePageChange,
    handlePageSizeChange,
  }
}
