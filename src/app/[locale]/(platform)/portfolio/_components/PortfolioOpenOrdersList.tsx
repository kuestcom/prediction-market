'use client'

import type { InfiniteData } from '@tanstack/react-query'
import type { PortfolioOpenOrdersSort, PortfolioUserOpenOrder } from '@/app/[locale]/(platform)/portfolio/_types/PortfolioOpenOrdersTypes'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useTradingOnboarding } from '@/app/[locale]/(platform)/_providers/TradingOnboardingProvider'
import { cancelAllOrdersAction } from '@/app/[locale]/(platform)/portfolio/_actions/cancel-all-orders'
import { usePortfolioOpenOrdersQuery } from '@/app/[locale]/(platform)/portfolio/_hooks/usePortfolioOpenOrdersQuery'
import { matchesOpenOrdersSearchQuery, resolveOpenOrdersSearchParams, sortOpenOrders } from '@/app/[locale]/(platform)/portfolio/_utils/PortfolioOpenOrdersUtils'
import { Button } from '@/components/ui/button'
import { useDebounce } from '@/hooks/useDebounce'
import { isTradingAuthRequiredError } from '@/lib/trading-auth/errors'
import { useUser } from '@/stores/useUser'
import PortfolioOpenOrdersFilters from './PortfolioOpenOrdersFilters'
import PortfolioOpenOrdersTable from './PortfolioOpenOrdersTable'

interface PortfolioOpenOrdersListProps {
  userAddress: string
}

export default function PortfolioOpenOrdersList({ userAddress }: PortfolioOpenOrdersListProps) {
  const user = useUser()
  const queryClient = useQueryClient()
  const { openTradeRequirements } = useTradingOnboarding()
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearchQuery = useDebounce(searchQuery, 300)
  const [sortBy, setSortBy] = useState<PortfolioOpenOrdersSort>('market')
  const [isCancellingAll, setIsCancellingAll] = useState(false)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
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

  const orders = useMemo(() => data?.pages.flatMap(page => page.data) ?? [], [data?.pages])
  const visibleOrders = useMemo(() => {
    const filtered = orders.filter(order => matchesOpenOrdersSearchQuery(order, searchQuery))
    return sortOpenOrders(filtered, sortBy)
  }, [orders, searchQuery, sortBy])
  const canCancelAll = Boolean(
    user?.proxy_wallet_address
    && userAddress
    && user.proxy_wallet_address.toLowerCase() === userAddress.toLowerCase(),
  )

  const removeOrdersFromCache = useCallback((orderIds: string[]) => {
    if (!orderIds.length) {
      return
    }

    queryClient.setQueryData<InfiniteData<{ data: PortfolioUserOpenOrder[], next_cursor: string }>>(openOrdersQueryKey, (current) => {
      if (!current) {
        return current
      }

      const updatedPages = current.pages.map(page => ({
        ...page,
        data: page.data.filter(item => !orderIds.includes(item.id)),
      }))
      return { ...current, pages: updatedPages }
    })
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
        toast.success('All open orders cancelled')
      }
      else {
        toast.error(`Could not cancel ${failedCount} order${failedCount > 1 ? 's' : ''}.`)
      }

      if (result.cancelled.length) {
        removeOrdersFromCache(result.cancelled)
      }

      await queryClient.invalidateQueries({ queryKey: ['public-open-orders', userAddress] })
    }
    catch (error: any) {
      const message = typeof error?.message === 'string'
        ? error.message
        : 'Failed to cancel open orders.'
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
  }, [isCancellingAll, openTradeRequirements, orders.length, queryClient, removeOrdersFromCache, userAddress])

  useEffect(() => {
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
    return () => observer.disconnect()
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])

  const emptyText = userAddress
    ? (searchQuery.trim() ? 'No open orders match your search.' : 'No open orders found.')
    : 'Connect to view your open orders.'
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
                {isCancellingAll ? 'Cancelling...' : 'Cancel all'}
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
