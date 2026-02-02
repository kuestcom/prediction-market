import type { UserOpenOrder } from '@/types'
import { useInfiniteQuery } from '@tanstack/react-query'

interface FetchUserOpenOrdersParams {
  pageParam: string
  eventSlug: string
  conditionId: string
  signal?: AbortSignal
}

interface OpenOrdersPage {
  data: UserOpenOrder[]
  next_cursor: string
}

interface UseUserOpenOrdersArgs {
  userId?: string | null
  eventSlug?: string
  conditionId?: string
  enabled?: boolean
}

export function buildUserOpenOrdersQueryKey(userId?: string | null, eventSlug?: string, conditionId?: string) {
  return ['user-open-orders', userId, eventSlug, conditionId] as const
}

export function useUserOpenOrdersQuery({
  userId,
  eventSlug,
  conditionId,
  enabled = true,
}: UseUserOpenOrdersArgs) {
  return useInfiniteQuery<OpenOrdersPage>({
    queryKey: buildUserOpenOrdersQueryKey(userId, eventSlug, conditionId),
    queryFn: ({ pageParam = 'MA==', signal }) =>
      fetchUserOpenOrders({
        pageParam: pageParam as string,
        eventSlug: eventSlug ?? '',
        conditionId: conditionId ?? '',
        signal,
      }),
    getNextPageParam: (lastPage) => {
      if (lastPage?.next_cursor && lastPage.next_cursor !== 'LTE=') {
        return lastPage.next_cursor
      }
      return undefined
    },
    enabled: Boolean(enabled && userId && eventSlug),
    initialPageParam: 'MA==',
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
  })
}

export async function fetchUserOpenOrders({
  pageParam,
  eventSlug,
  conditionId,
  signal,
}: FetchUserOpenOrdersParams): Promise<OpenOrdersPage> {
  const params = new URLSearchParams({
    next_cursor: pageParam,
  })

  if (conditionId) {
    params.set('conditionId', conditionId)
  }

  const response = await fetch(`/api/events/${encodeURIComponent(eventSlug)}/open-orders?${params}`, {
    signal,
  })

  if (!response.ok) {
    throw new Error('Failed to fetch open orders')
  }

  const payload = await response.json()
  if (Array.isArray(payload)) {
    return { data: payload, next_cursor: 'LTE=' }
  }
  return {
    data: Array.isArray(payload?.data) ? payload.data : [],
    next_cursor: typeof payload?.next_cursor === 'string' ? payload.next_cursor : 'LTE=',
  }
}
