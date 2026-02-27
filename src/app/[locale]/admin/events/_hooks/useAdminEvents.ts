import type { Event } from '@/types'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import { useDebounce } from '@/hooks/useDebounce'

export interface AdminEventRow {
  id: string
  slug: string
  title: string
  status: Event['status']
  icon_url: string
  livestream_url: string | null
  series_slug: string | null
  series_recurrence: string | null
  volume: number
  volume_24h: number
  is_hidden: boolean
  sports_score: string | null
  sports_live: boolean | null
  sports_ended: boolean | null
  is_sports_games_moneyline: boolean
  end_date: string | null
  created_at: string
  updated_at: string
}

interface UseAdminEventsParams {
  limit?: number
  search?: string
  sortBy?: 'title' | 'status' | 'volume' | 'volume_24h' | 'created_at' | 'updated_at' | 'end_date'
  sortOrder?: 'asc' | 'desc'
  pageIndex?: number
  mainCategorySlug?: string | null
  creator?: string | null
  seriesSlug?: string | null
  activeOnly?: boolean
}

interface AdminEventsResponse {
  data: AdminEventRow[]
  totalCount: number
  creatorOptions: string[]
  seriesOptions: string[]
}

async function fetchAdminEvents(params: UseAdminEventsParams): Promise<AdminEventsResponse> {
  const {
    limit = 50,
    search,
    sortBy = 'created_at',
    sortOrder = 'desc',
    pageIndex = 0,
    mainCategorySlug = null,
    creator = null,
    seriesSlug = null,
    activeOnly = false,
  } = params

  const offset = pageIndex * limit
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

  const response = await fetch(`/admin/api/events?${searchParams.toString()}`)
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    const message = typeof payload?.error === 'string' ? payload.error : response.statusText
    throw new Error(message || 'Failed to fetch events')
  }

  return response.json()
}

export function useAdminEvents(params: UseAdminEventsParams = {}) {
  const {
    limit = 50,
    search,
    sortBy = 'created_at',
    sortOrder = 'desc',
    pageIndex = 0,
    mainCategorySlug = null,
    creator = null,
    seriesSlug = null,
    activeOnly = false,
  } = params

  const debouncedSearch = useDebounce(search, 300)

  const queryKey = useMemo(() => [
    'admin-events',
    { limit, search: debouncedSearch, sortBy, sortOrder, pageIndex, mainCategorySlug, creator, seriesSlug, activeOnly },
  ], [limit, debouncedSearch, sortBy, sortOrder, pageIndex, mainCategorySlug, creator, seriesSlug, activeOnly])

  const query = useQuery({
    queryKey,
    queryFn: () => fetchAdminEvents({
      limit,
      search: debouncedSearch,
      sortBy,
      sortOrder,
      pageIndex,
      mainCategorySlug,
      creator,
      seriesSlug,
      activeOnly,
    }),
    staleTime: 30_000,
    gcTime: 300_000,
  })

  const retry = useCallback(() => {
    void query.refetch()
  }, [query])

  return {
    ...query,
    retry,
  }
}

export function useAdminEventsTable() {
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(50)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'title' | 'status' | 'volume' | 'volume_24h' | 'created_at' | 'updated_at' | 'end_date'>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [mainCategorySlug, setMainCategorySlug] = useState<string>('all')
  const [creator, setCreator] = useState<string>('all')
  const [seriesSlug, setSeriesSlug] = useState<string>('all')
  const [activeOnly, setActiveOnly] = useState(false)

  const { data, isLoading, error, retry } = useAdminEvents({
    limit: pageSize,
    search,
    sortBy,
    sortOrder,
    pageIndex,
    mainCategorySlug: mainCategorySlug === 'all' ? null : mainCategorySlug,
    creator: creator === 'all' ? null : creator,
    seriesSlug: seriesSlug === 'all' ? null : seriesSlug,
    activeOnly,
  })

  const handleSearchChange = useCallback((nextSearch: string) => {
    setSearch(nextSearch)
    setPageIndex(0)
  }, [])

  const handleSortChange = useCallback((column: string | null, order: 'asc' | 'desc' | null) => {
    if (column === null || order === null) {
      setSortBy('created_at')
      setSortOrder('desc')
    }
    else {
      setSortBy(column as 'title' | 'status' | 'volume' | 'volume_24h' | 'created_at' | 'updated_at' | 'end_date')
      setSortOrder(order)
    }
    setPageIndex(0)
  }, [])

  const handleMainCategoryChange = useCallback((nextMainCategorySlug: string) => {
    setMainCategorySlug(nextMainCategorySlug)
    setPageIndex(0)
  }, [])

  const handleActiveOnlyChange = useCallback((nextActiveOnly: boolean) => {
    setActiveOnly(nextActiveOnly)
    setPageIndex(0)
  }, [])

  const handleCreatorChange = useCallback((nextCreator: string) => {
    setCreator(nextCreator)
    setPageIndex(0)
  }, [])

  const handleSeriesSlugChange = useCallback((nextSeriesSlug: string) => {
    setSeriesSlug(nextSeriesSlug)
    setPageIndex(0)
  }, [])

  const handlePageChange = useCallback((newPageIndex: number) => {
    setPageIndex(newPageIndex)
  }, [])

  const handlePageSizeChange = useCallback((newPageSize: number) => {
    setPageSize(newPageSize)
    setPageIndex(0)
  }, [])

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
    mainCategorySlug,
    creator,
    seriesSlug,
    activeOnly,
    creatorOptions: data?.creatorOptions || [],
    seriesOptions: data?.seriesOptions || [],
    handleSearchChange,
    handleSortChange,
    handleMainCategoryChange,
    handleCreatorChange,
    handleSeriesSlugChange,
    handleActiveOnlyChange,
    handlePageChange,
    handlePageSizeChange,
  }
}
