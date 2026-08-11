import { useQuery } from '@tanstack/react-query'

import { ZERO_ADDRESS } from '@/lib/contracts'

interface AffiliateInfoResponse {
  referrerAddress: `0x${string}`
  affiliateAddress: `0x${string}`
  affiliateSharePercent: number
  builderTakerFeeShareBps: number
  builderMakerFlatFeeBps: number
}

const DEFAULT_RESPONSE: AffiliateInfoResponse = {
  referrerAddress: ZERO_ADDRESS,
  affiliateAddress: ZERO_ADDRESS,
  affiliateSharePercent: 0,
  builderTakerFeeShareBps: 3000,
  builderMakerFlatFeeBps: 0,
}

async function fetchAffiliateInfo(): Promise<AffiliateInfoResponse> {
  const response = await fetch('/api/affiliate-info', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error('Failed to load affiliate info')
  }

  return response.json()
}

export function useAffiliateOrderMetadata(): AffiliateInfoResponse {
  const { data } = useQuery({
    queryKey: ['affiliate-order-info'],
    queryFn: fetchAffiliateInfo,
    staleTime: 'static',
    gcTime: 10 * 60 * 1000,
  })

  return data ?? DEFAULT_RESPONSE
}
