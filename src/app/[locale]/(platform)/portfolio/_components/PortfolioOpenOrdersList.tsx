'use client'

import type { InfiniteData } from '@tanstack/react-query'
import type { RefObject } from 'react'
import type { PortfolioOpenOrdersSort, PortfolioUserOpenOrder } from '@/app/[locale]/(platform)/portfolio/_types/PortfolioOpenOrdersTypes'
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
import { useInfiniteLoadMore } from '@/hooks/useInfiniteLoadMore'
import { useOpenOrdersCacheInvalidation } from '@/hooks/useOpenOrdersCacheInvalidation'
import { isTradingAuthRequiredError } from '@/lib/trading-auth/errors'
import { useUser } from '@/stores/useUser'
import PortfolioOpenOrdersFilters from './PortfolioOpenOrdersFilters'
import PortfolioOpenOrdersTable from './PortfolioOpenOrdersTable'

interface PortfolioOpenOrdersListProps {
  userAddress: string
}

type OpenTradeRequirements = ReturnType<typeof useTradingOnboarding>['openTradeRequirements']

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
  orders,
  removeOrdersFromCache,
  invalidateAfterCancel,
  openTradeRequirements,
}: {
  orders: PortfolioUserOpenOrder[]
  removeOrdersFromCache: (orderIds: string[]) => void
  invalidateAfterCancel: () => Promise<void>
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

      await invalidateAfterCancel()
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
  }, [invalidateAfterCancel, isCancellingAll, openTradeRequirements, orders.length, removeOrdersFromCache, t])

  return { isCancellingAll, handleCancelAll }
}

function useCancelOpenOrder({
  removeOrdersFromCache,
  invalidateAfterCancel,
  openTradeRequirements,
}: {
  removeOrdersFromCache: (orderIds: string[]) => void
  invalidateAfterCancel: () => Promise<void>
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
      await invalidateAfterCancel()
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
  }, [invalidateAfterCancel, openTradeRequirements, pendingCancelIds, removeOrdersFromCache, t])

  return { pendingCancelIds, handleCancelOrder }
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
  const openOrdersCacheQueryKeys = useMemo(
    () => [openOrdersQueryKey],
    [openOrdersQueryKey],
  )
  const openOrdersInvalidateQueryKeys = useMemo(
    () => [['public-open-orders', userAddress]],
    [userAddress],
  )
  const matchingOpenOrdersQueryKey = useMemo(() => ['user-open-orders'], [])
  const { removeOrdersFromCache, invalidateAfterCancel } = useOpenOrdersCacheInvalidation({
    queryClient,
    queryKeys: openOrdersCacheQueryKeys,
    invalidateQueryKeys: openOrdersInvalidateQueryKeys,
    matchingQueryKey: matchingOpenOrdersQueryKey,
  })
  const { pendingCancelIds, handleCancelOrder } = useCancelOpenOrder({
    removeOrdersFromCache,
    invalidateAfterCancel,
    openTradeRequirements,
  })

  const { isCancellingAll, handleCancelAll } = useCancelAllOpenOrders({
    orders,
    removeOrdersFromCache,
    invalidateAfterCancel,
    openTradeRequirements,
  })

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
    errorMessage: t('Failed to load more open orders'),
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
        onRetryLoadMore={loadMore}
        onCancelOrder={handleCancelOrder}
        pendingCancelIds={pendingCancelIds}
      />
    </div>
  )
}
