'use client'

import type { ActivitySort, ActivityTypeFilter } from '@/app/[locale]/(platform)/profile/_types/PublicActivityTypes'
import { useMemo, useState } from 'react'
import { usePublicActivityQuery } from '@/app/[locale]/(platform)/profile/_hooks/usePublicActivityQuery'
import {
  buildActivityCsv,
  getActivityTimestampMs,
  matchesSearchQuery,
  matchesTypeFilter,
  normalizeActivityHistoryDisplay,
  toNumeric,
} from '@/app/[locale]/(platform)/profile/_utils/PublicActivityUtils'
import { useInfiniteLoadMore } from '@/hooks/useInfiniteLoadMore'
import { useSiteIdentity } from '@/hooks/useSiteIdentity'
import PublicActivityFilters from './PublicActivityFilters'
import PublicActivityTable from './PublicActivityTable'

interface PublicActivityListProps {
  userAddress: string
}

type PublicActivityItem = ReturnType<typeof usePublicActivityQuery>['data'] extends infer T
  ? T extends { pages: (infer P)[] }
    ? P extends (infer Item)[] ? Item : never
    : never
  : never

function usePublicActivityFilters() {
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<ActivityTypeFilter>('all')
  const [sortFilter, setSortFilter] = useState<ActivitySort>('newest')

  return { searchQuery, setSearchQuery, typeFilter, setTypeFilter, sortFilter, setSortFilter }
}

function useVisibleActivities({
  data,
  searchQuery,
  typeFilter,
  sortFilter,
}: {
  data: ReturnType<typeof usePublicActivityQuery>['data']
  searchQuery: string
  typeFilter: ActivityTypeFilter
  sortFilter: ActivitySort
}) {
  const activities = useMemo(
    () => normalizeActivityHistoryDisplay(data?.pages.flat() ?? []),
    [data?.pages],
  )
  const visibleActivities = useMemo(() => {
    const filtered = activities
      .filter(activity => matchesSearchQuery(activity, searchQuery))
      .filter(activity => matchesTypeFilter(activity, typeFilter))

    const sorted = [...filtered]
    sorted.sort((a, b) => {
      if (sortFilter === 'oldest') {
        return getActivityTimestampMs(a) - getActivityTimestampMs(b)
      }
      if (sortFilter === 'value') {
        return Math.abs(toNumeric(b.total_value)) - Math.abs(toNumeric(a.total_value))
      }
      if (sortFilter === 'shares') {
        return Math.abs(toNumeric(b.amount)) - Math.abs(toNumeric(a.amount))
      }
      return getActivityTimestampMs(b) - getActivityTimestampMs(a)
    })

    return sorted
  }, [activities, searchQuery, sortFilter, typeFilter])

  return { activities, visibleActivities }
}

export default function PublicActivityList({ userAddress }: PublicActivityListProps) {
  const { searchQuery, setSearchQuery, typeFilter, setTypeFilter, sortFilter, setSortFilter } = usePublicActivityFilters()
  const loadMoreScopeKey = `${userAddress}:${searchQuery}:${typeFilter}:${sortFilter}`
  const site = useSiteIdentity()

  const {
    status,
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = usePublicActivityQuery({ userAddress, typeFilter, sortFilter })

  const hasUserAddress = Boolean(userAddress)
  const { visibleActivities } = useVisibleActivities({ data, searchQuery, typeFilter, sortFilter })

  const {
    infiniteScrollError,
    isLoadingMore,
    loadMoreRef,
    loadMore,
  } = useInfiniteLoadMore({
    loadMoreScopeKey,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    errorMessage: 'Failed to load more activity.',
  })

  const isLoading = hasUserAddress && status === 'pending'
  const hasError = hasUserAddress && status === 'error'

  function handleExportCsv() {
    if (visibleActivities.length === 0) {
      return
    }

    const siteName = site.name
    const { csvContent, filename } = buildActivityCsv(visibleActivities as PublicActivityItem[], siteName)
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-3 pb-0">
      <PublicActivityFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        typeFilter={typeFilter}
        onTypeChange={setTypeFilter}
        sortFilter={sortFilter}
        onSortChange={setSortFilter}
        onExport={handleExportCsv}
        disableExport={visibleActivities.length === 0}
      />

      <PublicActivityTable
        activities={visibleActivities}
        isLoading={isLoading}
        hasError={hasError}
        onRetry={() => refetch()}
        isFetchingNextPage={isFetchingNextPage}
        isLoadingMore={isLoadingMore}
        infiniteScrollError={infiniteScrollError}
        onRetryLoadMore={loadMore}
        loadMoreRef={loadMoreRef}
      />
    </div>
  )
}
