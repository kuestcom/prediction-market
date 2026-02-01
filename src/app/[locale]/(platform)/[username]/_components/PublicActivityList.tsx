'use client'

import type { ActivitySort, ActivityTypeFilter } from '@/app/[locale]/(platform)/[username]/_types/PublicActivityTypes'
import { useEffect, useMemo, useRef, useState } from 'react'
import { usePublicActivityQuery } from '@/app/[locale]/(platform)/[username]/_hooks/usePublicActivityQuery'
import { buildActivityCsv, getActivityTimestampMs, matchesSearchQuery, matchesTypeFilter, toNumeric } from '@/app/[locale]/(platform)/[username]/_utils/PublicActivityUtils'
import PublicActivityFilters from './PublicActivityFilters'
import PublicActivityTable from './PublicActivityTable'

interface PublicActivityListProps {
  userAddress: string
}

export default function PublicActivityList({ userAddress }: PublicActivityListProps) {
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<ActivityTypeFilter>('all')
  const [sortFilter, setSortFilter] = useState<ActivitySort>('newest')
  const [infiniteScrollError, setInfiniteScrollError] = useState<string | null>(null)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  const {
    status,
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = usePublicActivityQuery({ userAddress, typeFilter, sortFilter })

  const hasUserAddress = Boolean(userAddress)
  const activities = useMemo(
    () => data?.pages.flat() ?? [],
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

  const isLoading = hasUserAddress && status === 'pending'
  const hasError = hasUserAddress && status === 'error'
  function handleExportCsv() {
    if (visibleActivities.length === 0) {
      return
    }

    const siteName = process.env.NEXT_PUBLIC_SITE_NAME!
    const { csvContent, filename } = buildActivityCsv(visibleActivities, siteName)
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

  useEffect(() => {
    if (!hasNextPage || !loadMoreRef.current) {
      return undefined
    }

    const observer = new IntersectionObserver((entries) => {
      const [entry] = entries
      if (entry?.isIntersecting && !isFetchingNextPage && !isLoadingMore && !infiniteScrollError) {
        setIsLoadingMore(true)
        fetchNextPage()
          .then(() => {
            setIsLoadingMore(false)
            setInfiniteScrollError(null)
          })
          .catch((error) => {
            setIsLoadingMore(false)
            if (error.name !== 'AbortError') {
              setInfiniteScrollError(error.message || 'Failed to load more activity.')
            }
          })
      }
    }, { rootMargin: '200px' })

    observer.observe(loadMoreRef.current)

    return () => observer.disconnect()
  }, [fetchNextPage, hasNextPage, infiniteScrollError, isFetchingNextPage, isLoadingMore])

  useEffect(() => {
    setInfiniteScrollError(null)
    setIsLoadingMore(false)
  }, [searchQuery, sortFilter, typeFilter, userAddress])

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
        onRetryLoadMore={() => {
          setInfiniteScrollError(null)
          setIsLoadingMore(true)
          fetchNextPage()
            .catch((error) => {
              if (error.name !== 'AbortError') {
                setInfiniteScrollError(error.message || 'Failed to load more activity.')
              }
            })
            .finally(() => {
              setIsLoadingMore(false)
            })
        }}
        loadMoreRef={loadMoreRef}
      />
    </div>
  )
}
