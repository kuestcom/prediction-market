import type { ActivitySort, ActivityTypeFilter } from '@/app/[locale]/(platform)/profile/_types/PublicActivityTypes'
import type { DataApiActivity } from '@/lib/data-api/user'
import type { ActivityOrder } from '@/types'
import { useInfiniteQuery } from '@tanstack/react-query'
import { resolveActivitySort, resolveActivityTypeParams } from '@/app/[locale]/(platform)/profile/_utils/PublicActivityUtils'
import { usePublicRuntimeConfig } from '@/hooks/usePublicRuntimeConfig'
import { mapDataApiActivityToActivityOrder } from '@/lib/data-api/user'

async function fetchUserActivity({
  dataUrl,
  pageParam,
  userAddress,
  typeFilter,
  sortFilter,
  signal,
}: {
  dataUrl: string
  pageParam: number
  userAddress: string
  typeFilter: ActivityTypeFilter
  sortFilter: ActivitySort
  signal?: AbortSignal
}): Promise<ActivityOrder[]> {
  const { sortBy, sortDirection } = resolveActivitySort(sortFilter)
  const { type, side } = resolveActivityTypeParams(typeFilter)

  const params = new URLSearchParams({
    user: userAddress,
    limit: '100',
    offset: pageParam.toString(),
    sortBy,
    sortDirection,
  })
  if (type) {
    params.set('type', type)
  }
  if (side) {
    params.set('side', side)
  }

  const response = await fetch(`${dataUrl}/activity?${params.toString()}`, { signal })

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null)
    const errorMessage = errorBody?.error || 'Failed to load activity.'
    throw new Error(errorMessage)
  }

  const result = await response.json()
  if (!Array.isArray(result)) {
    throw new TypeError('Unexpected response from data service.')
  }

  return (result as DataApiActivity[]).map(mapDataApiActivityToActivityOrder)
}

export function usePublicActivityQuery({
  userAddress,
  typeFilter,
  sortFilter,
}: {
  userAddress: string
  typeFilter: ActivityTypeFilter
  sortFilter: ActivitySort
}) {
  const { dataUrl } = usePublicRuntimeConfig()

  return useInfiniteQuery<ActivityOrder[]>({
    queryKey: ['user-activity', dataUrl, userAddress, typeFilter, sortFilter],
    queryFn: ({ pageParam = 0, signal }) => fetchUserActivity({
      dataUrl,
      pageParam: pageParam as number,
      userAddress,
      typeFilter,
      sortFilter,
      signal,
    }),
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length === 100) {
        return allPages.reduce((total, page) => total + page.length, 0)
      }
      return undefined
    },
    initialPageParam: 0,
    enabled: Boolean(userAddress),
    staleTime: 1000 * 60,
    gcTime: 1000 * 60 * 5,
  })
}
