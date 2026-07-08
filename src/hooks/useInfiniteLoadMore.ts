'use client'

import type { RefObject } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'

interface LoadMoreState {
  key: string
  infiniteScrollError: string | null
  isLoadingMore: boolean
}

interface UseInfiniteLoadMoreOptions {
  loadMoreScopeKey: string
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => Promise<unknown>
  errorMessage: string
  onSuccess?: () => void
}

export function useInfiniteLoadMore({
  loadMoreScopeKey,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  errorMessage,
  onSuccess,
}: UseInfiniteLoadMoreOptions): {
  infiniteScrollError: string | null
  isLoadingMore: boolean
  loadMoreRef: RefObject<HTMLDivElement | null>
  loadMore: () => void
  resetLoadMoreState: () => void
} {
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
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  const isLoadMoreInFlightRef = useRef(false)

  const resetLoadMoreState = useCallback(function resetLoadMoreState() {
    isLoadMoreInFlightRef.current = false
    setLoadMoreState({
      key: loadMoreScopeKey,
      infiniteScrollError: null,
      isLoadingMore: false,
    })
  }, [loadMoreScopeKey])

  const loadMore = useCallback(function loadMore() {
    if (
      !hasNextPage
      || isFetchingNextPage
      || scopedLoadMoreState.isLoadingMore
      || isLoadMoreInFlightRef.current
    ) {
      return
    }

    isLoadMoreInFlightRef.current = true
    setLoadMoreState({
      key: loadMoreScopeKey,
      infiniteScrollError: null,
      isLoadingMore: true,
    })

    fetchNextPage()
      .then(() => {
        isLoadMoreInFlightRef.current = false
        setLoadMoreState({
          key: loadMoreScopeKey,
          infiniteScrollError: null,
          isLoadingMore: false,
        })
        onSuccess?.()
      })
      .catch((error: any) => {
        isLoadMoreInFlightRef.current = false
        setLoadMoreState({
          key: loadMoreScopeKey,
          infiniteScrollError: error?.name === 'AbortError' ? null : error?.message || errorMessage,
          isLoadingMore: false,
        })
      })
  }, [
    errorMessage,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    loadMoreScopeKey,
    onSuccess,
    scopedLoadMoreState.isLoadingMore,
  ])

  useEffect(function observeLoadMoreSentinel() {
    if (!hasNextPage || !loadMoreRef.current) {
      return undefined
    }

    const observer = new IntersectionObserver((entries) => {
      const [entry] = entries
      if (
        entry?.isIntersecting
        && !isFetchingNextPage
        && !scopedLoadMoreState.isLoadingMore
        && !scopedLoadMoreState.infiniteScrollError
      ) {
        loadMore()
      }
    }, { rootMargin: '200px' })

    observer.observe(loadMoreRef.current)

    return function disconnectLoadMoreObserver() {
      observer.disconnect()
    }
  }, [
    hasNextPage,
    isFetchingNextPage,
    loadMore,
    scopedLoadMoreState.infiniteScrollError,
    scopedLoadMoreState.isLoadingMore,
  ])

  return {
    infiniteScrollError: scopedLoadMoreState.infiniteScrollError,
    isLoadingMore: scopedLoadMoreState.isLoadingMore,
    loadMoreRef,
    loadMore,
    resetLoadMoreState,
  }
}
