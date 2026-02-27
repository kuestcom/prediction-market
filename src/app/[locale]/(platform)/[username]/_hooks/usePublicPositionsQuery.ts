import type { PublicPosition } from '@/app/[locale]/(platform)/[username]/_components/PublicPositionItem'
import type { SortDirection, SortOption } from '@/app/[locale]/(platform)/[username]/_types/PublicPositionsTypes'
import { useInfiniteQuery } from '@tanstack/react-query'
import { isClientOnlySort, mapDataApiPosition, resolvePositionsSearchParams, resolvePositionsSortParams } from '@/app/[locale]/(platform)/[username]/_utils/PublicPositionsUtils'

const DATA_API_URL = process.env.DATA_URL!
const UNRESOLVED_STATUS_TTL_MS = 60_000
const conditionResolutionCache = new Map<string, { isResolved: boolean, checkedAt: number }>()

function normalizeConditionId(value: string | undefined) {
  const trimmed = value?.trim().toLowerCase()
  return trimmed && trimmed.length > 0 ? trimmed : null
}

async function populateConditionResolutionCache(conditionIds: string[], signal?: AbortSignal) {
  const now = Date.now()
  const pendingConditionIds = Array.from(new Set(
    conditionIds
      .map(normalizeConditionId)
      .filter((value): value is string => {
        if (!value) {
          return false
        }

        const cached = conditionResolutionCache.get(value)
        if (!cached) {
          return true
        }

        if (cached.isResolved) {
          return false
        }

        return now - cached.checkedAt >= UNRESOLVED_STATUS_TTL_MS
      }),
  ))

  if (pendingConditionIds.length === 0) {
    return
  }

  const response = await fetch('/api/markets/status', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ conditionIds: pendingConditionIds }),
    signal,
  })

  if (!response.ok) {
    throw new Error('Failed to fetch market resolution status.')
  }

  const payload = await response.json().catch(() => null)
  const rows = Array.isArray(payload?.data)
    ? payload.data as Array<{ condition_id?: string, is_resolved?: boolean }>
    : []
  rows.forEach((item) => {
    const conditionId = normalizeConditionId(item?.condition_id)
    if (!conditionId) {
      return
    }
    conditionResolutionCache.set(conditionId, {
      isResolved: Boolean(item?.is_resolved),
      checkedAt: Date.now(),
    })
  })
}

function shouldIncludeInActivePositions(position: PublicPosition) {
  if (position.redeemable || position.isResolved) {
    return false
  }

  const conditionId = normalizeConditionId(position.conditionId)
  if (!conditionId) {
    return true
  }

  return !conditionResolutionCache.get(conditionId)?.isResolved
}

async function fetchUserPositions({
  pageParam,
  userAddress,
  status,
  minAmountFilter,
  sortBy,
  sortDirection,
  searchQuery,
  signal,
}: {
  pageParam: number
  userAddress: string
  status: 'active' | 'closed'
  minAmountFilter: string
  sortBy: SortOption
  sortDirection: SortDirection
  searchQuery?: string
  signal?: AbortSignal
}): Promise<PublicPosition[]> {
  const endpoint = status === 'active' ? '/positions' : '/closed-positions'
  const { sortBy: apiSortBy, sortDirection: apiSortDirection } = resolvePositionsSortParams(sortBy, sortDirection)
  const { market, title } = resolvePositionsSearchParams(searchQuery ?? '')
  const shouldApplySort = status === 'active' && !isClientOnlySort(sortBy)
  const params = new URLSearchParams({
    user: userAddress,
    limit: '50',
    offset: pageParam.toString(),
  })

  if (status === 'active') {
    if (minAmountFilter && minAmountFilter !== 'All') {
      params.set('sizeThreshold', minAmountFilter)
    }
    else {
      params.set('sizeThreshold', '0.01')
    }
    if (shouldApplySort) {
      params.set('sortBy', apiSortBy)
      params.set('sortDirection', apiSortDirection)
    }
    if (market) {
      params.set('market', market)
    }
    else if (title) {
      params.set('title', title)
    }
  }

  if (status === 'closed') {
    params.set('sortBy', 'TIMESTAMP')
    params.set('sortDirection', 'DESC')
    params.set('sizeThreshold', '0.01')
    if (market) {
      params.set('market', market)
    }
    else if (title) {
      params.set('title', title)
    }
  }

  async function requestPositions(requestParams: URLSearchParams) {
    const response = await fetch(`${DATA_API_URL}${endpoint}?${requestParams.toString()}`, { signal })

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null)
      const errorMessage = errorBody?.error || 'Server error occurred. Please try again later.'
      throw new Error(errorMessage)
    }

    const result = await response.json()
    if (!Array.isArray(result)) {
      throw new TypeError('Unexpected response from data service.')
    }

    const mapped = result.map(item => mapDataApiPosition(item, status))
    if (status === 'active') {
      await populateConditionResolutionCache(
        mapped.map(position => position.conditionId ?? ''),
        signal,
      ).catch(() => {})
      return mapped.filter(shouldIncludeInActivePositions)
    }
    return mapped
  }

  try {
    return await requestPositions(params)
  }
  catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : ''
    const shouldRetry = (message.includes('sortby') || message.includes('sortdirection') || message.includes('unknown_field'))
      && (params.has('sortBy') || params.has('sortDirection'))
    if (!shouldRetry) {
      throw error
    }

    const fallbackParams = new URLSearchParams(params.toString())
    fallbackParams.delete('sortBy')
    fallbackParams.delete('sortDirection')
    return requestPositions(fallbackParams)
  }
}

export function usePublicPositionsQuery({
  userAddress,
  status,
  minAmountFilter,
  sortBy,
  sortDirection,
  searchQuery,
}: {
  userAddress: string
  status: 'active' | 'closed'
  minAmountFilter: string
  sortBy: SortOption
  sortDirection: SortDirection
  searchQuery: string
}) {
  return useInfiniteQuery<PublicPosition[]>({
    queryKey: ['user-positions', userAddress, status, minAmountFilter, searchQuery, sortBy, sortDirection],
    queryFn: ({ pageParam = 0, signal }) =>
      fetchUserPositions({
        pageParam: pageParam as unknown as number,
        userAddress,
        status,
        minAmountFilter,
        sortBy,
        sortDirection,
        searchQuery,
        signal,
      }),
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length === 50) {
        return allPages.reduce((total, page) => total + page.length, 0)
      }
      return undefined
    },
    initialPageParam: 0,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
    refetchInterval: 60_000,
    enabled: Boolean(userAddress),
  })
}
