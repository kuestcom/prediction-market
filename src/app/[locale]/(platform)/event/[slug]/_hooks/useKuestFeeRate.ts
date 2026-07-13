import { useQuery } from '@tanstack/react-query'
import { usePublicRuntimeConfig } from '@/hooks/usePublicRuntimeConfig'
import { fetchKuestFeeRate } from '@/lib/clob'

export function useKuestFeeRate(tokenId: string | null, options?: { enabled?: boolean }) {
  const { clobUrl } = usePublicRuntimeConfig()
  const shouldEnable = options?.enabled ?? true

  return useQuery({
    queryKey: ['kuest-fee-rate', clobUrl, tokenId],
    queryFn: () => fetchKuestFeeRate(tokenId!, clobUrl),
    enabled: shouldEnable && Boolean(tokenId) && Boolean(clobUrl),
    staleTime: 15 * 60_000,
    gcTime: 30 * 60_000,
    retry: 1,
  })
}
