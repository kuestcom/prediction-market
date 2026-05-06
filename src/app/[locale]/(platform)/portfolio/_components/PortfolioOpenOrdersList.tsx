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
  userAddress,
  orders,
  queryClient,
  openOrdersQueryKey,
  openTradeRequirements,
}: {
  userAddress: string
  orders: PortfolioUserOpenOrder[]
  queryClient: QueryClient
  openOrdersQueryKey: (string | undefined)[]
  openTradeRequirements: ReturnType<typeof useTradingOnboarding>['openTradeRequirements']
}) {
  const t = useExtracted()
  const [isCancellingAll, setIsCancellingAll] = useState(false)

  const removeOrdersFromCache = useCallback((orderIds: string[]) => {
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

function useInfiniteScrollSentinel({
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: {
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => Promise<unknown>
}): { loadMoreRef: RefObject<HTMLDivElement | null> } {
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  useEffect(function observeLoadMoreSentinel() {
    if (!hasNextPage || !loadMoreRef.current) {
      return undefined
    }

    const observer = new IntersectionObserver((entries) => {
      const [entry] = entries
      if (entry?.isIntersecting && !isFetchingNextPage) {
        void fetchNextPage()
      }
    }, { rootMargin: '200px' })

    observer.observe(loadMoreRef.current)
    return function disconnectLoadMoreObserver() {
      observer.disconnect()
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])

  return { loadMoreRef }
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

  const {
    status,
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

  const canCancelAll = Boolean(
    user?.deposit_wallet_address
    && userAddress
    && user.deposit_wallet_address.toLowerCase() === userAddress.toLowerCase(),
  )

  const { isCancellingAll, handleCancelAll } = useCancelAllOpenOrders({
    userAddress,
    orders,
    queryClient,
    openOrdersQueryKey,
    openTradeRequirements,
  })

  const { loadMoreRef } = useInfiniteScrollSentinel({
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
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
        loadMoreRef={loadMoreRef}
      />
    </div>
  )
}
