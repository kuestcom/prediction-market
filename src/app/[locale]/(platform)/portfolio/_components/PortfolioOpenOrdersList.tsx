'use client'

import type { InfiniteData, QueryClient } from '@tanstack/react-query'
import type { RefObject } from 'react'
import type { PortfolioOpenOrdersSort, PortfolioUserOpenOrder } from '@/app/[locale]/(platform)/portfolio/_types/PortfolioOpenOrdersTypes'
import type { UserOpenOrder } from '@/types'
import { useQueryClient } from '@tanstack/react-query'
import { useExtracted } from 'next-intl'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useTradingOnboarding } from '@/app/[locale]/(platform)/_providers/TradingOnboardingProvider'
import { cancelOrderAction } from '@/app/[locale]/(platform)/event/[slug]/_actions/cancel-order'
import { cancelAllOrdersAction } from '@/app/[locale]/(platform)/portfolio/_actions/cancel-all-orders'
import { usePortfolioOpenOrdersQuery } from '@/app/[locale]/(platform)/portfolio/_hooks/usePortfolioOpenOrdersQuery'
import { matchesOpenOrdersSearchQuery, resolveOpenOrdersSearchParams, sortOpenOrders } from '@/app/[locale]/(platform)/portfolio/_utils/PortfolioOpenOrdersUtils'
import { Button } from '@/components/ui/button'
import { useDebounce } from '@/hooks/useDebounce'
import { removeOpenOrdersFromInfiniteData, updateQueryDataWhere } from '@/lib/optimistic-trading'
import { isTradingAuthRequiredError } from '@/lib/trading-auth/errors'
import { useUser } from '@/stores/useUser'
import PortfolioOpenOrdersFilters from './PortfolioOpenOrdersFilters'
import PortfolioOpenOrdersTable from './PortfolioOpenOrdersTable'

interface PortfolioOpenOrdersListProps {
  userAddress: string
}

type OpenTradeRequirements = ReturnType<typeof useTradingOnboarding>['openTradeRequirements']

interface LoadMoreStateValue {
  key: string
  infiniteScrollError: string | null
  isLoadingMore: boolean
}

function useRemoveOpenOrdersFromCache({
  queryClient,
  openOrdersQueryKey,
}: {
  queryClient: QueryClient
  openOrdersQueryKey: (string | undefined)[]
}) {
  return useCallback(function removeOrdersFromCache(orderIds: string[]) {
    if (!orderIds.length) {
      return
    }

    queryClient.setQueryData<InfiniteData<{ data: PortfolioUserOpenOrder[], next_cursor: string }>>(openOrdersQueryKey, current =>
      removeOpenOrdersFromInfiniteData(current, orderIds))

    updateQueryDataWhere<InfiniteData<{ data: UserOpenOrder[], next_cursor: string }>>(
      queryClient,
      ['user-open-orders'],
      () => true,
      current => removeOpenOrdersFromInfiniteData(current, orderIds),
    )
  }, [openOrdersQueryKey, queryClient])
}

function useOpenOrdersFilterState(userAddress: string) {
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearchQuery = useDebounce(searchQuery, 300)
  const [sortBy, setSortBy] = useState<PortfolioOpenOrdersSort>('market')
  const apiSearchFilters = useMemo(
    () => resolveOpenOrdersSearchParams(debouncedSearchQuery),
    [debouncedSearchQuery],
  )
  const apiSearchKey = useMemo(() => (
    `${apiSearchFilters.id ?? ''}|${apiSearchFilters.market ?? ''}|${apiSearchFilters.assetId ?? ''}`
  ), [apiSearchFilters])
  const openOrdersQueryKey = useMemo(
    () => ['public-open-orders', userAddress, apiSearchKey],
    [apiSearchKey, userAddress],
  )

  return {
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    apiSearchFilters,
    apiSearchKey,
    openOrdersQueryKey,
  }
}

function useLoadMoreState(loadMoreScopeKey: string) {
  const [loadMoreState, setLoadMoreState] = useState<LoadMoreStateValue>({
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

function useVisibleOpenOrders({
  data,
  searchQuery,
  sortBy,
}: {
  data: InfiniteData<{ data: PortfolioUserOpenOrder[], next_cursor: string }> | undefined
  searchQuery: string
  sortBy: PortfolioOpenOrdersSort
}) {
  const orders = useMemo(() => data?.pages.flatMap(page => page.data) ?? [], [data?.pages])
  const visibleOrders = useMemo(() => {
    const filtered = orders.filter(order => matchesOpenOrdersSearchQuery(order, searchQuery))
    return sortOpenOrders(filtered, sortBy)
  }, [orders, searchQuery, sortBy])

  return { orders, visibleOrders }
}

function useCancelAllOpenOrders({
  userAddress,
  orders,
  queryClient,
  removeOrdersFromCache,
  openTradeRequirements,
}: {
  userAddress: string
  orders: PortfolioUserOpenOrder[]
  queryClient: QueryClient
  removeOrdersFromCache: (orderIds: string[]) => void
  openTradeRequirements: OpenTradeRequirements
}) {
  const t = useExtracted()
  const [isCancellingAll, setIsCancellingAll] = useState(false)

  const handleCancelAll = useCallback(async () => {
    if (isCancellingAll || !orders.length) {
      return
    }

    setIsCancellingAll(true)

    try {
      const result = await cancelAllOrdersAction()
      if (result.error) {
        throw new Error(result.error)
      }

      const failedCount = Object.keys(result.notCanceled ?? {}).length
      if (failedCount === 0) {
        toast.success(t('All open orders cancelled'))
      }
      else {
        toast.error(t(
          'Could not cancel {count} order{count, plural, one {} other {s}}.',
          { count: failedCount as never },
        ))
      }

      if (result.cancelled.length) {
        removeOrdersFromCache(result.cancelled)
      }

      await queryClient.invalidateQueries({ queryKey: ['public-open-orders', userAddress] })
    }
    catch (error: any) {
      const message = typeof error?.message === 'string'
        ? error.message
        : t('Failed to cancel open orders.')
      if (isTradingAuthRequiredError(message)) {
        openTradeRequirements({ forceTradingAuth: true })
      }
      else {
        toast.error(message)
      }
    }
    finally {
      setIsCancellingAll(false)
    }
  }, [isCancellingAll, openTradeRequirements, orders.length, queryClient, removeOrdersFromCache, t, userAddress])

  return { isCancellingAll, handleCancelAll }
}

function useCancelOpenOrder({
  userAddress,
  queryClient,
  removeOrdersFromCache,
  openTradeRequirements,
}: {
  userAddress: string
  queryClient: QueryClient
  removeOrdersFromCache: (orderIds: string[]) => void
  openTradeRequirements: OpenTradeRequirements
}) {
  const t = useExtracted()
  const [pendingCancelIds, setPendingCancelIds] = useState<Set<string>>(() => new Set())

  const handleCancelOrder = useCallback(async function handleCancelOrder(order: PortfolioUserOpenOrder) {
    if (pendingCancelIds.has(order.id)) {
      return
    }

    setPendingCancelIds((current) => {
      const next = new Set(current)
      next.add(order.id)
      return next
    })

    try {
      const response = await cancelOrderAction(order.id)
      if (response?.error) {
        throw new Error(response.error)
      }

      toast.success(t('Order cancelled'))

      removeOrdersFromCache([order.id])
      await queryClient.invalidateQueries({ queryKey: ['public-open-orders', userAddress] })
      void queryClient.invalidateQueries({ queryKey: ['orderbook-summary'] })
    }
    catch (error: any) {
      const message = typeof error?.message === 'string'
        ? error.message
        : t('Failed to cancel order.')
      if (isTradingAuthRequiredError(message)) {
        openTradeRequirements({ forceTradingAuth: true })
      }
      else {
        toast.error(message)
      }
    }
    finally {
      setPendingCancelIds((current) => {
        const next = new Set(current)
        next.delete(order.id)
        return next
      })
    }
  }, [openTradeRequirements, pendingCancelIds, queryClient, removeOrdersFromCache, t, userAddress])

  return { pendingCancelIds, handleCancelOrder }
}

function useLoadMoreOpenOrders({
  fetchNextPage,
  loadMoreErrorMessage,
  loadMoreScopeKey,
  setLoadMoreState,
}: {
  fetchNextPage: () => Promise<unknown>
  loadMoreErrorMessage: string
  loadMoreScopeKey: string
  setLoadMoreState: (value: LoadMoreStateValue) => void
}) {
  return useCallback(() => {
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
      .catch((error: any) => {
        setLoadMoreState({
          key: loadMoreScopeKey,
          infiniteScrollError: error?.name === 'AbortError' ? null : error?.message || loadMoreErrorMessage,
          isLoadingMore: false,
        })
      })
  }, [fetchNextPage, loadMoreErrorMessage, loadMoreScopeKey, setLoadMoreState])
}

function useInfiniteScrollSentinel({
  hasNextPage,
  infiniteScrollError,
  isFetchingNextPage,
  isLoadingMore,
  loadMoreOpenOrders,
}: {
  hasNextPage: boolean
  infiniteScrollError: string | null
  isFetchingNextPage: boolean
  isLoadingMore: boolean
  loadMoreOpenOrders: () => void
}): { loadMoreRef: RefObject<HTMLDivElement | null> } {
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  useEffect(function observeLoadMoreSentinel() {
    if (!hasNextPage || !loadMoreRef.current) {
      return undefined
    }

    const observer = new IntersectionObserver((entries) => {
      const [entry] = entries
      if (entry?.isIntersecting && !isFetchingNextPage && !isLoadingMore && !infiniteScrollError) {
        loadMoreOpenOrders()
      }
    }, { rootMargin: '200px' })

    observer.observe(loadMoreRef.current)
    return function disconnectLoadMoreObserver() {
      observer.disconnect()
    }
  }, [hasNextPage, infiniteScrollError, isFetchingNextPage, isLoadingMore, loadMoreOpenOrders])

  return { loadMoreRef }
}

function promptTradingAuthForOpenOrdersError({
  error,
  hasPromptedTradingAuthRef,
  openTradeRequirements,
  status,
}: {
  error: Error | null
  hasPromptedTradingAuthRef: RefObject<boolean>
  openTradeRequirements: OpenTradeRequirements
  status: 'error' | 'pending' | 'success'
}) {
  if (status !== 'error') {
    hasPromptedTradingAuthRef.current = false
    return
  }

  const message = error instanceof Error ? error.message : ''
  if (hasPromptedTradingAuthRef.current || !isTradingAuthRequiredError(message)) {
    return
  }

  hasPromptedTradingAuthRef.current = true
  openTradeRequirements({ forceTradingAuth: true })
}

export default function PortfolioOpenOrdersList({ userAddress }: PortfolioOpenOrdersListProps) {
  const user = useUser()
  const t = useExtracted()
  const queryClient = useQueryClient()
  const { openTradeRequirements } = useTradingOnboarding()
  const {
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    apiSearchFilters,
    apiSearchKey,
    openOrdersQueryKey,
  } = useOpenOrdersFilterState(userAddress)
  const loadMoreScopeKey = `${userAddress}:${apiSearchKey}:${searchQuery}:${sortBy}`
  const { infiniteScrollError, isLoadingMore, setLoadMoreState } = useLoadMoreState(loadMoreScopeKey)

  const {
    status,
    error,
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = usePortfolioOpenOrdersQuery({
    userAddress,
    apiSearchKey,
    apiSearchFilters,
  })

  const { orders, visibleOrders } = useVisibleOpenOrders({ data, searchQuery, sortBy })
  const hasPromptedTradingAuthRef = useRef(false)

  useEffect(function handleOpenOrdersTradingAuthError() {
    promptTradingAuthForOpenOrdersError({
      error,
      hasPromptedTradingAuthRef,
      openTradeRequirements,
      status,
    })
  }, [error, openTradeRequirements, status])

  const canCancelAll = Boolean(
    user?.deposit_wallet_address
    && userAddress
    && user.deposit_wallet_address.toLowerCase() === userAddress.toLowerCase(),
  )
  const removeOrdersFromCache = useRemoveOpenOrdersFromCache({
    queryClient,
    openOrdersQueryKey,
  })
  const { pendingCancelIds, handleCancelOrder } = useCancelOpenOrder({
    userAddress,
    queryClient,
    removeOrdersFromCache,
    openTradeRequirements,
  })

  const { isCancellingAll, handleCancelAll } = useCancelAllOpenOrders({
    userAddress,
    orders,
    queryClient,
    removeOrdersFromCache,
    openTradeRequirements,
  })

  const loadMoreOpenOrders = useLoadMoreOpenOrders({
    fetchNextPage,
    loadMoreErrorMessage: t('Failed to load more open orders'),
    loadMoreScopeKey,
    setLoadMoreState,
  })

  const { loadMoreRef } = useInfiniteScrollSentinel({
    hasNextPage,
    infiniteScrollError,
    isFetchingNextPage,
    isLoadingMore,
    loadMoreOpenOrders,
  })

  const emptyText = userAddress
    ? (searchQuery.trim() ? t('No open orders match your search.') : t('No open orders found.'))
    : t('Connect to view your open orders.')
  const loading = status === 'pending'

  return (
    <div className="space-y-3 pb-0">
      <PortfolioOpenOrdersFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sortBy={sortBy}
        onSortChange={setSortBy}
        action={canCancelAll && orders.length > 0
          ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 rounded-md text-xs font-semibold text-destructive uppercase"
                onClick={handleCancelAll}
                disabled={isCancellingAll || orders.length === 0}
              >
                {isCancellingAll ? t('Cancelling...') : t('Cancel all')}
              </Button>
            )
          : null}
      />

      <PortfolioOpenOrdersTable
        orders={visibleOrders}
        isLoading={loading}
        emptyText={emptyText}
        isFetchingNextPage={isFetchingNextPage}
        infiniteScrollError={infiniteScrollError}
        isLoadingMore={isLoadingMore}
        loadMoreRef={loadMoreRef}
        onRetryLoadMore={loadMoreOpenOrders}
        onCancelOrder={handleCancelOrder}
        pendingCancelIds={pendingCancelIds}
      />
    </div>
  )
}
