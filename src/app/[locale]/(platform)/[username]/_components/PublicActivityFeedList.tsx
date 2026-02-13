'use client'

import type { PublicActivity } from '@/types'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCwIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { PublicActivityItem } from '@/app/[locale]/(platform)/[username]/_components/PublicActivityItem'
import AlertBanner from '@/components/AlertBanner'
import { Button } from '@/components/ui/button'
import { fetchUserActivityData, mapDataApiActivityToPublicActivity } from '@/lib/data-api/user'
import { cn } from '@/lib/utils'
import PublicActivityEmpty from './PublicActivityEmpty'
import PublicActivityError from './PublicActivityError'
import { ActivitySkeletonRows } from './PublicActivitySkeleton'

interface PublicActivityFeedListProps {
  userAddress: string
}

export default function PublicActivityFeedList({ userAddress }: PublicActivityFeedListProps) {
  const queryClient = useQueryClient()
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  const [infiniteScrollError, setInfiniteScrollError] = useState<string | null>(null)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    queueMicrotask(() => {
      setInfiniteScrollError(null)
      setIsLoadingMore(false)
      setRetryCount(0)
    })
  }, [userAddress])

  const {
    status,
    data,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
    refetch,
  } = useInfiniteQuery<PublicActivity[]>({
    queryKey: ['user-activity', userAddress],
    queryFn: ({ pageParam = 0, signal }) =>
      fetchUserActivityData({
        pageParam: pageParam as unknown as number,
        userAddress,
        signal,
      }).then(activities => activities.map(mapDataApiActivityToPublicActivity)),
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length === 50) {
        return allPages.reduce((total, page) => total + page.length, 0)
      }
      return undefined
    },
    initialPageParam: 0,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
    enabled: Boolean(userAddress),
  })

  const activities = data?.pages.flat() ?? []
  const loading = status === 'pending'
  const hasInitialError = status === 'error'

  useEffect(() => {
    if (!hasNextPage || !loadMoreRef.current) {
      return undefined
    }

    const observer = new IntersectionObserver((entries) => {
      const [entry] = entries
      if (entry?.isIntersecting && !isFetchingNextPage && !isLoadingMore && !infiniteScrollError) {
        setIsLoadingMore(true)
        setInfiniteScrollError(null)

        fetchNextPage()
          .then(() => {
            setIsLoadingMore(false)
            setRetryCount(0)
          })
          .catch((error) => {
            setIsLoadingMore(false)
            if (error.name !== 'AbortError') {
              const errorMessage = error.message || 'Failed to load more activity'
              setInfiniteScrollError(errorMessage)
            }
          })
      }
    }, { rootMargin: '200px' })

    observer.observe(loadMoreRef.current)

    return () => observer.disconnect()
  }, [fetchNextPage, hasNextPage, infiniteScrollError, isFetchingNextPage, isLoadingMore])

  const retryInfiniteScroll = useCallback(() => {
    setInfiniteScrollError(null)
    setIsLoadingMore(true)
    setRetryCount(prev => prev + 1)

    fetchNextPage()
      .then(() => {
        setIsLoadingMore(false)
        setRetryCount(0)
      })
      .catch((error) => {
        setIsLoadingMore(false)
        if (error.name !== 'AbortError') {
          setInfiniteScrollError('Failed to load more activity')
        }
      })
  }, [fetchNextPage])

  const retryInitialLoad = useCallback(() => {
    setRetryCount(prev => prev + 1)
    setInfiniteScrollError(null)
    setIsLoadingMore(false)
    void refetch()
  }, [refetch])

  if (hasInitialError) {
    return (
      <div className="grid gap-6">
        <PublicActivityError
          retryCount={retryCount}
          isLoading={loading}
          onRetry={retryInitialLoad}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">

      <div className={`
        mb-2 flex items-center gap-3 px-3 py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase
        sm:gap-4 sm:px-5
      `}
      >
        <div className="w-12 sm:w-16">Type</div>
        <div className="flex-1">Market</div>
        <div className="text-right">Amount</div>
      </div>

      {loading && (
        <div className="overflow-hidden rounded-lg border border-border">
          <ActivitySkeletonRows />
          <div className="p-4 text-center">
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">
                {retryCount > 0 ? 'Retrying...' : 'Loading activity...'}
              </div>

            </div>
          </div>
        </div>
      )}

      {!loading && activities.length === 0 && <PublicActivityEmpty />}

      {!loading && activities.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="divide-y divide-border/70">
            {activities.map(activity => (
              <PublicActivityItem key={activity.id} item={activity} />
            ))}
          </div>

          {(isFetchingNextPage || isLoadingMore) && (
            <div className="border-t">
              <ActivitySkeletonRows count={3} />
            </div>
          )}

          {!hasNextPage && activities.length > 0 && !isFetchingNextPage && !isLoadingMore && (
            <div className="border-t bg-muted/20 p-6 text-center">
              <div className="space-y-3">
                <div className="text-sm font-medium text-foreground">
                  You've reached the end
                </div>
                <div className="text-xs text-muted-foreground">
                  {`All ${activities.length} trading activit${activities.length === 1 ? 'y' : 'ies'} loaded`}
                </div>
              </div>
            </div>
          )}

          {infiniteScrollError && (
            <div className="border-t bg-muted/30 p-4">
              <AlertBanner
                title="Failed to load more activity"
                description={(
                  <>
                    <p className="text-sm">
                      {retryCount > 0
                        ? `Unable to load more data after ${retryCount} attempt${retryCount > 1 ? 's' : ''}. Please check your connection.`
                        : 'There was a problem loading more activity data.'}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        onClick={retryInfiniteScroll}
                        size="sm"
                        variant="outline"
                        className="flex items-center gap-2"
                        disabled={isLoadingMore}
                      >
                        <RefreshCwIcon className={cn('size-3', { 'animate-spin': isLoadingMore })} />
                        {isLoadingMore ? 'Retrying...' : 'Try again'}
                      </Button>
                      {retryCount > 2 && (
                        <Button
                          type="button"
                          onClick={() => {
                            setInfiniteScrollError(null)
                            setRetryCount(0)
                            void queryClient.invalidateQueries({
                              queryKey: ['user-activity', userAddress],
                            })
                          }}
                          size="sm"
                          variant="ghost"
                        >
                          Start over
                        </Button>
                      )}
                    </div>
                  </>
                )}
                descriptionClassName="mt-2 space-y-3"
              />
            </div>
          )}
        </div>
      )}

      <div ref={loadMoreRef} />
    </div>
  )
}
