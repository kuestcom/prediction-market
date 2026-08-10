import { useQuery } from '@tanstack/react-query'

import { usePublicRuntimeConfig } from '@/hooks/usePublicRuntimeConfig'
import { fetchMarketRewards } from '@/lib/clob-rewards'

export function useMarketRewards(conditionIds: string[]) {
  const { clobUrl } = usePublicRuntimeConfig()
  const stableIds = [...new Set(conditionIds.filter(Boolean))].sort()

  return useQuery({
    queryKey: ['market-rewards', clobUrl, stableIds],
    queryFn: () => fetchMarketRewards(stableIds, clobUrl),
    enabled: Boolean(clobUrl) && stableIds.length > 0,
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
    retry: 1,
  })
}
