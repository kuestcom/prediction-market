import { useQuery } from '@tanstack/react-query'
import { fetchOrderBookSummaries } from '@/app/[locale]/(platform)/event/[slug]/_utils/EventOrderBookUtils'
import { usePublicRuntimeConfig } from '@/hooks/usePublicRuntimeConfig'

export function useOrderBookSummaries(tokenIds: string[], options?: { enabled?: boolean }) {
  const { clobUrl } = usePublicRuntimeConfig()
  const tokenIdsKey = tokenIds.slice().sort().join(',')
  const shouldEnable = options?.enabled ?? true

  return useQuery({
    queryKey: ['orderbook-summary', clobUrl, tokenIdsKey],
    queryFn: () => fetchOrderBookSummaries(tokenIds, clobUrl),
    enabled: shouldEnable && tokenIds.length > 0 && Boolean(clobUrl),
    staleTime: 10_000,
    gcTime: 60_000,
    retry: 1,
  })
}
