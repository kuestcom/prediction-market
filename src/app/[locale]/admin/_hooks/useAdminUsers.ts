import type { AdminPaginatedFetchParams } from '@/app/[locale]/admin/_hooks/useAdminPaginatedResource'
import { useAdminPaginatedResource } from '@/app/[locale]/admin/_hooks/useAdminPaginatedResource'

interface AdminUserRow {
  id: string
  username: string
  email: string
  address: string
  created_label: string
  affiliate_code?: string | null
  referred_by_display?: string | null
  referred_by_profile_url?: string | null
  is_admin: boolean
  avatarUrl: string
  profileUrl: string
  created_at: string
  search_text: string
}

type AdminUsersSortBy = 'username' | 'email' | 'address' | 'created_at'

interface AdminUsersResponse {
  data: AdminUserRow[]
  count: number
  totalCount: number
}

async function fetchAdminUsers(params: AdminPaginatedFetchParams<AdminUsersSortBy>): Promise<AdminUsersResponse> {
  const { limit, offset, search, sortBy, sortOrder } = params
  const searchParams = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
    sortBy,
    sortOrder,
  })

  if (search && search.trim()) {
    searchParams.set('search', search.trim())
  }

  const response = await fetch(`/admin/api/users?${searchParams.toString()}`)

  if (!response.ok) {
    throw new Error(`Failed to fetch users: ${response.statusText}`)
  }

  return response.json()
}

export function useAdminUsersTable() {
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
    handleSearchChange,
    handleSortChange,
    handlePageChange,
    handlePageSizeChange,
  } = useAdminPaginatedResource<AdminUsersResponse, AdminUsersSortBy>({
    queryKey: 'admin-users',
    defaultSortBy: 'created_at',
    defaultSortOrder: 'desc',
    initialFilters: {},
    fetchResource: fetchAdminUsers,
  })

  return {
    // Data
    users: data?.data || [],
    totalCount: data?.totalCount || 0,

    // Loading states
    isLoading,
    error: error?.message || null,
    retry,

    // Table state
    pageIndex,
    pageSize,
    search,
    sortBy,
    sortOrder,

    // State setters
    handleSearchChange,
    handleSortChange,
    handlePageChange,
    handlePageSizeChange,
  }
}
