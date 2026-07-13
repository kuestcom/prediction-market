import type { InfiniteData, QueryClient, QueryKey } from '@tanstack/react-query'
import { useCallback, useEffect, useRef } from 'react'
import { DEPOSIT_WALLET_BALANCE_QUERY_KEY } from '@/hooks/useBalance'
import { removeOpenOrdersFromInfiniteData, updateQueryDataWhere } from '@/lib/optimistic-trading'
import { scheduleOrderBookRefresh } from '@/lib/trading-cache'

type OpenOrderCacheData = InfiniteData<{
  data: { id: string }[]
  next_cursor: string
}>

interface UseOpenOrdersCacheInvalidationParams {
  queryClient: QueryClient
  queryKeys: QueryKey[]
  invalidateQueryKeys?: QueryKey[]
  matchingQueryKey?: QueryKey
  includeWalletBalance?: boolean
}

export function useOpenOrdersCacheInvalidation({
  queryClient,
  queryKeys,
  invalidateQueryKeys = queryKeys,
  matchingQueryKey,
  includeWalletBalance = true,
}: UseOpenOrdersCacheInvalidationParams) {
  const openOrdersRefreshTimeoutRef = useRef<number | null>(null)
  const walletBalanceRefreshTimeoutRef = useRef<number | null>(null)

  useEffect(function clearOpenOrdersInvalidationTimeouts() {
    return function clearInvalidationTimeouts() {
      if (openOrdersRefreshTimeoutRef.current) {
        window.clearTimeout(openOrdersRefreshTimeoutRef.current)
      }
      if (walletBalanceRefreshTimeoutRef.current) {
        window.clearTimeout(walletBalanceRefreshTimeoutRef.current)
      }
    }
  }, [])

  const removeOrdersFromCache = useCallback(function removeOrdersFromCache(orderIds: string[]) {
    if (!orderIds.length) {
      return
    }

    queryKeys.forEach((queryKey) => {
      queryClient.setQueryData<OpenOrderCacheData>(queryKey, current =>
        removeOpenOrdersFromInfiniteData(current, orderIds))
    })

    if (matchingQueryKey) {
      updateQueryDataWhere<OpenOrderCacheData>(
        queryClient,
        matchingQueryKey,
        () => true,
        current => removeOpenOrdersFromInfiniteData(current, orderIds),
      )
    }
  }, [matchingQueryKey, queryClient, queryKeys])

  const scheduleOpenOrdersRefresh = useCallback(function scheduleOpenOrdersRefresh() {
    if (typeof window === 'undefined') {
      return
    }
    if (openOrdersRefreshTimeoutRef.current) {
      window.clearTimeout(openOrdersRefreshTimeoutRef.current)
    }

    openOrdersRefreshTimeoutRef.current = window.setTimeout(() => {
      invalidateQueryKeys.forEach((queryKey) => {
        void queryClient.invalidateQueries({ queryKey })
      })
    }, 10_000)
  }, [invalidateQueryKeys, queryClient])

  const invalidateAfterCancel = useCallback(async function invalidateAfterCancel() {
    const [primaryQueryKey, ...remainingQueryKeys] = invalidateQueryKeys
    if (primaryQueryKey) {
      await queryClient.invalidateQueries({ queryKey: primaryQueryKey })
    }
    remainingQueryKeys.forEach((queryKey) => {
      void queryClient.invalidateQueries({ queryKey })
    })
    if (matchingQueryKey) {
      void queryClient.invalidateQueries({ queryKey: matchingQueryKey })
    }

    scheduleOrderBookRefresh(queryClient)
    if (includeWalletBalance) {
      void queryClient.invalidateQueries({ queryKey: [DEPOSIT_WALLET_BALANCE_QUERY_KEY] })
      if (typeof window !== 'undefined') {
        if (walletBalanceRefreshTimeoutRef.current) {
          window.clearTimeout(walletBalanceRefreshTimeoutRef.current)
        }
        walletBalanceRefreshTimeoutRef.current = window.setTimeout(() => {
          void queryClient.invalidateQueries({ queryKey: [DEPOSIT_WALLET_BALANCE_QUERY_KEY] })
        }, 3000)
      }
    }
    scheduleOpenOrdersRefresh()
  }, [includeWalletBalance, invalidateQueryKeys, matchingQueryKey, queryClient, scheduleOpenOrdersRefresh])

  return {
    removeOrdersFromCache,
    invalidateAfterCancel,
    scheduleOpenOrdersRefresh,
  }
}
