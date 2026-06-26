'use client'

import type { RefObject } from 'react'
import type { ActivitySort, ActivityTypeFilter } from '@/app/[locale]/(platform)/profile/_types/PublicActivityTypes'
import { useEffect, useMemo, useRef, useState } from 'react'
import { usePublicActivityQuery } from '@/app/[locale]/(platform)/profile/_hooks/usePublicActivityQuery'
import {
  buildActivityCsv,
  getActivityTimestampMs,
  matchesSearchQuery,
  matchesTypeFilter,
  normalizeActivityHistoryDisplay,
  toNumeric,
} from '@/app/[locale]/(platform)/profile/_utils/PublicActivityUtils'
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

interface LoadMoreState {
  key: string
  infiniteScrollError: string | null
  isLoadingMore: boolean
}

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

function useLoadMoreScopedState(loadMoreScopeKey: string) {
  const [loadMoreState, setLoadMoreState] = useState<LoadMoreState>({
    key: loadMoreScopeKey,
    infiniteScrollError: null,
    isLoadingMore: false,
  })
  const scopedLoadMoreState = loadMoreState.key === loadMoreScopeKey
    ? loadMoreState
    : {
        key: loadMoreScopeKey,
        infiniteScrollError: null,
        isLoadingMore: false,
      }

  return {
    infiniteScrollError: scopedLoadMoreState.infiniteScrollError,
    isLoadingMore: scopedLoadMoreState.isLoadingMore,
    setLoadMoreState,
  }
}

function useActivityInfiniteScrollSentinel({
  hasNextPage,
  isFetchingNextPage,
  isLoadingMore,
  infiniteScrollError,
  fetchNextPage,
  loadMoreScopeKey,
  setLoadMoreState,
}: {
  hasNextPage: boolean
  isFetchingNextPage: boolean
  isLoadingMore: boolean
  infiniteScrollError: string | null
  fetchNextPage: () => Promise<unknown>
  loadMoreScopeKey: string
  setLoadMoreState: (state: LoadMoreState) => void
}): { loadMoreRef: RefObject<HTMLDivElement | null> } {
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  useEffect(function observeActivityLoadMoreSentinel() {
    if (!hasNextPage || !loadMoreRef.current) {
      return undefined
    }

    const observer = new IntersectionObserver((entries) => {
      const [entry] = entries
      if (entry?.isIntersecting && !isFetchingNextPage && !isLoadingMore && !infiniteScrollError) {
        setLoadMoreState({
          key: loadMoreScopeKey,
          infiniteScrollError: null,
          isLoadingMore: true,
        })
        fetchNextPage()
          .then(() => {
            setLoadMoreState({
              key: loadMoreScopeKey,
              infiniteScrollError: null,
              isLoadingMore: false,
            })
          })
          .catch((error) => {
            if (error.name !== 'AbortError') {
              setLoadMoreState({
                key: loadMoreScopeKey,
                infiniteScrollError: error.message || 'Failed to load more activity.',
                isLoadingMore: false,
              })
              return
            }
            setLoadMoreState({
              key: loadMoreScopeKey,
              infiniteScrollError: null,
              isLoadingMore: false,
            })
          })
      }
    }, { rootMargin: '200px' })

    observer.observe(loadMoreRef.current)

    return function disconnectActivityLoadMoreObserver() {
      observer.disconnect()
    }
  }, [fetchNextPage, hasNextPage, infiniteScrollError, isFetchingNextPage, isLoadingMore, loadMoreScopeKey, setLoadMoreState])

  return { loadMoreRef }
}

export default function PublicActivityList({ userAddress }: PublicActivityListProps) {
  const { searchQuery, setSearchQuery, typeFilter, setTypeFilter, sortFilter, setSortFilter } = usePublicActivityFilters()
  const loadMoreScopeKey = `${userAddress}:${searchQuery}:${typeFilter}:${sortFilter}`
  const { infiniteScrollError, isLoadingMore, setLoadMoreState } = useLoadMoreScopedState(loadMoreScopeKey)
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

  const { loadMoreRef } = useActivityInfiniteScrollSentinel({
    hasNextPage,
    isFetchingNextPage,
    isLoadingMore,
    infiniteScrollError,
    fetchNextPage,
    loadMoreScopeKey,
    setLoadMoreState,
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

  function handleRetryLoadMore() {
    setLoadMoreState({
      key: loadMoreScopeKey,
      infiniteScrollError: null,
      isLoadingMore: true,
    })
    fetchNextPage()
      .then(() => {
        setLoadMoreState({
          key: loadMoreScopeKey,
          infiniteScrollError: null,
          isLoadingMore: false,
        })
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setLoadMoreState({
            key: loadMoreScopeKey,
            infiniteScrollError: error.message || 'Failed to load more activity.',
            isLoadingMore: false,
          })
          return
        }
        setLoadMoreState({
          key: loadMoreScopeKey,
          infiniteScrollError: null,
          isLoadingMore: false,
        })
      })
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
        onRetryLoadMore={handleRetryLoadMore}
        loadMoreRef={loadMoreRef}
      />
    </div>
  )
}
