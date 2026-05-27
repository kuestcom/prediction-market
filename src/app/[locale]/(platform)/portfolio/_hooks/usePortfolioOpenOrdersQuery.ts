import type { PortfolioUserOpenOrder } from '@/app/[locale]/(platform)/portfolio/_types/PortfolioOpenOrdersTypes'
import { useInfiniteQuery } from '@tanstack/react-query'

async function fetchOpenOrders({
  pageParam,
  filters,
  signal,
}: {
  pageParam: string
  filters?: { id?: string, market?: string, assetId?: string }
  signal?: AbortSignal
}): Promise<{ data: PortfolioUserOpenOrder[], next_cursor: string }> {
  const params = new URLSearchParams({
    next_cursor: pageParam,
  })
  if (filters?.id) {
    params.set('id', filters.id)
  }
  if (filters?.market) {
    params.set('market', filters.market)
  }
  if (filters?.assetId) {
    params.set('asset_id', filters.assetId)
  }

  const response = await fetch(`/api/open-orders?${params.toString()}`, { signal })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.error || 'Failed to load open orders')
  }
  const payload = await response.json()
  if (Array.isArray(payload)) {
    return { data: payload, next_cursor: '' }
  }
  return {
    data: Array.isArray(payload?.data) ? payload.data : [],
    next_cursor: typeof payload?.next_cursor === 'string' ? payload.next_cursor : '',
  }
}

export function usePortfolioOpenOrdersQuery({
  userAddress,
  apiSearchKey,
  apiSearchFilters,
}: {
  userAddress: string
  apiSearchKey: string
  apiSearchFilters: { id?: string, market?: string, assetId?: string }
}) {
  return useInfiniteQuery<{ data: PortfolioUserOpenOrder[], next_cursor: string }>({
    queryKey: ['public-open-orders', userAddress, apiSearchKey],
    queryFn: ({ pageParam = 'MA==', signal }) => fetchOpenOrders({
      pageParam: pageParam as string,
      filters: apiSearchFilters,
      signal,
    }),
    getNextPageParam: (lastPage) => {
      if (lastPage?.next_cursor && lastPage.next_cursor !== 'LTE=') {
        return lastPage.next_cursor
      }
      return undefined
    },
    initialPageParam: 'MA==',
    enabled: Boolean(userAddress),
    staleTime: 1000 * 60,
    gcTime: 1000 * 60 * 5,
  })
}
