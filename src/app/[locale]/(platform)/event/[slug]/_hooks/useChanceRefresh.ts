import type { QueryKey } from '@tanstack/react-query'

import { useIsFetching, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useRef, useState } from 'react'

interface UseChanceRefreshOptions {
  queryKeys: QueryKey[]
}

export interface ChanceRefreshResult {
  refresh: () => Promise<{ ok: true } | { ok: false; error?: unknown; reason?: 'IN_PROGRESS' }>
  isRefreshing: boolean
  isFetching: boolean
  isDisabled: boolean
}

function matchesQueryKey(target: QueryKey, full: QueryKey) {
  if (!Array.isArray(target) || !Array.isArray(full)) {
    return false
  }
  if (target.length > full.length) {
    return false
  }
  return target.every((value, index) => Object.is(value, full[index]))
}

export function useChanceRefresh({ queryKeys }: UseChanceRefreshOptions): ChanceRefreshResult {
  const queryClient = useQueryClient()
  const isFetching =
    useIsFetching({
      predicate: (query) => queryKeys.some((key) => matchesQueryKey(key, query.queryKey)),
    }) > 0
  const [isRefreshing, setIsRefreshing] = useState(false)
  const isRefreshingRef = useRef(false)

  const isDisabled = useMemo(() => isFetching || isRefreshing, [isFetching, isRefreshing])

  const refresh = useCallback(async () => {
    if (isFetching || isRefreshingRef.current) {
      return { ok: false as const, reason: 'IN_PROGRESS' as const }
    }

    isRefreshingRef.current = true
    setIsRefreshing(true)

    try {
      await Promise.all(queryKeys.map((key) => queryClient.invalidateQueries({ queryKey: key, refetchType: 'active' })))
      return { ok: true as const }
    } catch (error) {
      console.error('Failed to refresh chance data', error)
      return { ok: false as const, error }
    } finally {
      isRefreshingRef.current = false
      setIsRefreshing(false)
    }
  }, [isFetching, queryClient, queryKeys])

  return {
    refresh,
    isDisabled,
    isRefreshing,
    isFetching,
  }
}
