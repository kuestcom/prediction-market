import type { NonDefaultLocale } from '@/i18n/locales'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'

export interface AdminCategoryRow {
  id: number
  name: string
  slug: string
  is_main_category: boolean
  is_hidden: boolean
  hide_events: boolean
  display_order: number
  active_markets_count: number
  active_events_count: number
  created_at: string
  updated_at: string
  translations: Partial<Record<NonDefaultLocale, string>>
}

interface UseAdminCategoriesParams {
  limit?: number
  search?: string
  sortBy?: 'name' | 'slug' | 'display_order' | 'created_at' | 'updated_at' | 'active_events_count'
  sortOrder?: 'asc' | 'desc'
  pageIndex?: number
  mainOnly?: boolean
}

interface AdminCategoriesResponse {
  data: AdminCategoryRow[]
  totalCount: number
}

async function fetchAdminCategories(params: UseAdminCategoriesParams): Promise<AdminCategoriesResponse> {
  const {
    limit = 50,
    search,
    sortBy = 'display_order',
    sortOrder = 'asc',
    pageIndex = 0,
    mainOnly = false,
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
  if (mainOnly) {
    searchParams.set('mainOnly', '1')
  }

  const response = await fetch(`/admin/api/categories?${searchParams.toString()}`)

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    const message = typeof payload?.error === 'string' ? payload.error : response.statusText
    throw new Error(message || 'Failed to fetch categories')
  }

  return response.json()
}

export function useAdminCategories(params: UseAdminCategoriesParams = {}) {
  const {
    limit = 50,
    search,
    sortBy = 'display_order',
    sortOrder = 'asc',
    pageIndex = 0,
    mainOnly = false,
  } = params

  const queryKey = useMemo(() => [
    'admin-categories',
    { limit, search, sortBy, sortOrder, pageIndex, mainOnly },
  ], [limit, search, sortBy, sortOrder, pageIndex, mainOnly])

  const query = useQuery({
    queryKey,
    queryFn: () => fetchAdminCategories({
      limit,
      search,
      sortBy,
      sortOrder,
      pageIndex,
      mainOnly,
    }),
    staleTime: 30_000,
    gcTime: 300_000,
  })

  const retry = useCallback(() => {
    query.refetch()
  }, [query])

  return {
    ...query,
    retry,
  }
}

export function useAdminCategoriesTable() {
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(50)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'slug' | 'display_order' | 'created_at' | 'updated_at' | 'active_events_count'>('display_order')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [mainOnly, setMainOnly] = useState(false)

  const { data, isLoading, error, retry } = useAdminCategories({
    limit: pageSize,
    search,
    sortBy,
    sortOrder,
    pageIndex,
    mainOnly,
  })

  const handleSearchChange = useCallback((newSearch: string) => {
    setSearch(newSearch)
    setPageIndex(0)
  }, [])

  const handleSortChange = useCallback((column: string | null, order: 'asc' | 'desc' | null) => {
    if (column === null || order === null) {
      setSortBy('display_order')
      setSortOrder('asc')
    }
    else {
      setSortBy(column as typeof sortBy)
      setSortOrder(order)
    }
    setPageIndex(0)
  }, [])

  const handleMainOnlyChange = useCallback((nextMainOnly: boolean) => {
    setMainOnly(nextMainOnly)
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
    categories: data?.data || [],
    totalCount: data?.totalCount || 0,
    isLoading,
    error: error?.message || null,
    retry,
    pageIndex,
    pageSize,
    search,
    sortBy,
    sortOrder,
    mainOnly,
    handleSearchChange,
    handleSortChange,
    handleMainOnlyChange,
    handlePageChange,
    handlePageSizeChange,
  }
}
