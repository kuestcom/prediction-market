import type { Event } from '@/types'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import { useDebounce } from '@/hooks/useDebounce'

export interface AdminEventRow {
  id: string
  slug: string
  title: string
  status: Event['status']
  livestream_url: string | null
  volume: number
  volume_24h: number
  is_hidden: boolean
  created_at: string
  updated_at: string
}

interface UseAdminEventsParams {
  limit?: number
  search?: string
  sortBy?: 'title' | 'status' | 'volume' | 'volume_24h' | 'created_at' | 'updated_at'
  sortOrder?: 'asc' | 'desc'
  pageIndex?: number
}

interface AdminEventsResponse {
  data: AdminEventRow[]
  totalCount: number
}

async function fetchAdminEvents(params: UseAdminEventsParams): Promise<AdminEventsResponse> {
  const {
    limit = 50,
    search,
    sortBy = 'updated_at',
    sortOrder = 'desc',
    pageIndex = 0,
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
    sortBy = 'updated_at',
    sortOrder = 'desc',
    pageIndex = 0,
  } = params

  const debouncedSearch = useDebounce(search, 300)

  const queryKey = useMemo(() => [
    'admin-events',
    { limit, search: debouncedSearch, sortBy, sortOrder, pageIndex },
  ], [limit, debouncedSearch, sortBy, sortOrder, pageIndex])

  const query = useQuery({
    queryKey,
    queryFn: () => fetchAdminEvents({
      limit,
      search: debouncedSearch,
      sortBy,
      sortOrder,
      pageIndex,
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
  const [sortBy, setSortBy] = useState<'title' | 'status' | 'volume' | 'volume_24h' | 'created_at' | 'updated_at'>('updated_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const { data, isLoading, error, retry } = useAdminEvents({
    limit: pageSize,
    search,
    sortBy,
    sortOrder,
    pageIndex,
  })

  const handleSearchChange = useCallback((nextSearch: string) => {
    setSearch(nextSearch)
    setPageIndex(0)
  }, [])

  const handleSortChange = useCallback((column: string | null, order: 'asc' | 'desc' | null) => {
    if (column === null || order === null) {
      setSortBy('updated_at')
      setSortOrder('desc')
    }
    else {
      setSortBy(column as 'title' | 'status' | 'volume' | 'volume_24h' | 'created_at' | 'updated_at')
      setSortOrder(order)
    }
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
    handleSearchChange,
    handleSortChange,
    handlePageChange,
    handlePageSizeChange,
  }
}
