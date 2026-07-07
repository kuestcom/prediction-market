import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'

export type AdminSortOrder = 'asc' | 'desc'

export interface AdminPaginatedFetchParams<TSortBy extends string> {
  limit: number
  offset: number
  search: string
  sortBy: TSortBy
  sortOrder: AdminSortOrder
  pageIndex: number
}

interface UseAdminPaginatedResourceOptions<
  TData,
  TSortBy extends string,
  TFilters extends object,
  TQueryFilters extends object,
> {
  queryKey: string
  defaultSortBy: TSortBy
  defaultSortOrder: AdminSortOrder
  initialPageSize?: number
  initialFilters: TFilters
  resolveQueryFilters?: (filters: TFilters) => TQueryFilters
  fetchResource: (params: AdminPaginatedFetchParams<TSortBy> & TQueryFilters) => Promise<TData>
  staleTime?: number
  gcTime?: number
}

export function useAdminPaginatedResource<
  TData,
  TSortBy extends string,
  TFilters extends object = Record<string, never>,
  TQueryFilters extends object = TFilters,
>({
  queryKey,
  defaultSortBy,
  defaultSortOrder,
  initialPageSize = 50,
  initialFilters,
  resolveQueryFilters = filters => filters as unknown as TQueryFilters,
  fetchResource,
  staleTime = 30_000,
  gcTime = 300_000,
}: UseAdminPaginatedResourceOptions<TData, TSortBy, TFilters, TQueryFilters>) {
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<TSortBy>(defaultSortBy)
  const [sortOrder, setSortOrder] = useState<AdminSortOrder>(defaultSortOrder)
  const [filters, setFilters] = useState<TFilters>(initialFilters)

  const queryFilters = useMemo(
    () => resolveQueryFilters(filters),
    [filters, resolveQueryFilters],
  )
  const queryParams = useMemo<AdminPaginatedFetchParams<TSortBy> & TQueryFilters>(() => {
    const baseParams: AdminPaginatedFetchParams<TSortBy> = {
      limit: pageSize,
      offset: pageIndex * pageSize,
      search,
      sortBy,
      sortOrder,
      pageIndex,
    }

    return {
      ...baseParams,
      ...queryFilters,
    } as AdminPaginatedFetchParams<TSortBy> & TQueryFilters
  }, [pageIndex, pageSize, queryFilters, search, sortBy, sortOrder])

  const query = useQuery({
    queryKey: [queryKey, queryParams],
    queryFn: () => fetchResource(queryParams),
    staleTime,
    gcTime,
  })
  const { refetch } = query

  const retry = useCallback(() => {
    void refetch()
  }, [refetch])

  const handleSearchChange = useCallback((nextSearch: string) => {
    setSearch(nextSearch)
    setPageIndex(0)
  }, [])

  const handleSortChange = useCallback((column: string | null, order: AdminSortOrder | null) => {
    if (column === null || order === null) {
      setSortBy(defaultSortBy)
      setSortOrder(defaultSortOrder)
    }
    else {
      setSortBy(column as TSortBy)
      setSortOrder(order)
    }
    setPageIndex(0)
  }, [defaultSortBy, defaultSortOrder])

  const handlePageChange = useCallback((nextPageIndex: number) => {
    setPageIndex(nextPageIndex)
  }, [])

  const handlePageSizeChange = useCallback((nextPageSize: number) => {
    setPageSize(nextPageSize)
    setPageIndex(0)
  }, [])

  const handleFilterChange = useCallback(<K extends keyof TFilters>(key: K, value: TFilters[K]) => {
    setFilters(currentFilters => ({
      ...currentFilters,
      [key]: value,
    }) as TFilters)
    setPageIndex(0)
  }, [])

  return {
    ...query,
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
  }
}
