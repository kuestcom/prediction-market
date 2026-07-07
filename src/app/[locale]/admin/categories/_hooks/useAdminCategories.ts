import type { AdminPaginatedFetchParams } from '@/app/[locale]/admin/_hooks/useAdminPaginatedResource'
import type { NonDefaultLocale } from '@/i18n/locales'
import { useCallback } from 'react'
import { useAdminPaginatedResource } from '@/app/[locale]/admin/_hooks/useAdminPaginatedResource'

export interface AdminCategoryRow {
  id: number
  name: string
  slug: string
  is_main_category: boolean
  is_hidden: boolean
  hide_events: boolean
  event_page_note: string | null
  display_order: number
  active_markets_count: number
  active_events_count: number
  created_at: string
  updated_at: string
  translations: Partial<Record<NonDefaultLocale, string>>
}

type AdminCategoriesSortBy = 'name' | 'slug' | 'display_order' | 'created_at' | 'updated_at' | 'active_events_count'

interface AdminCategoriesTableFilters {
  mainOnly: boolean
}

interface AdminCategoriesResponse {
  data: AdminCategoryRow[]
  totalCount: number
}

async function fetchAdminCategories(
  params: AdminPaginatedFetchParams<AdminCategoriesSortBy> & AdminCategoriesTableFilters,
): Promise<AdminCategoriesResponse> {
  const { limit, offset, search, sortBy, sortOrder, mainOnly } = params
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

export function useAdminCategoriesTable() {
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
  } = useAdminPaginatedResource<AdminCategoriesResponse, AdminCategoriesSortBy, AdminCategoriesTableFilters>({
    queryKey: 'admin-categories',
    defaultSortBy: 'display_order',
    defaultSortOrder: 'asc',
    initialFilters: { mainOnly: false },
    fetchResource: fetchAdminCategories,
  })

  const handleMainOnlyChange = useCallback((nextMainOnly: boolean) => {
    handleFilterChange('mainOnly', nextMainOnly)
  }, [handleFilterChange])

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
    mainOnly: filters.mainOnly,
    handleSearchChange,
    handleSortChange,
    handleMainOnlyChange,
    handlePageChange,
    handlePageSizeChange,
  }
}
