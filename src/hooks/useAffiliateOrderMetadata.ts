import { useQuery } from '@tanstack/react-query'

import { ZERO_ADDRESS } from '@/lib/contracts'
import { useUser } from '@/stores/useUser'

interface AffiliateInfoResponse {
  referrerAddress: `0x${string}`
  affiliateAddress: `0x${string}`
  affiliateSharePercent: number
  builderTakerFeeShareBps: number
  builderMakerFlatFeeBps: number
}

export interface AffiliateOrderMetadata extends AffiliateInfoResponse {
  isLoading: boolean
}

const DEFAULT_RESPONSE: AffiliateInfoResponse = {
  referrerAddress: ZERO_ADDRESS,
  affiliateAddress: ZERO_ADDRESS,
  affiliateSharePercent: 0,
  builderTakerFeeShareBps: 3000,
  builderMakerFlatFeeBps: 0,
}

export function getAffiliateOrderMetadataQueryKey(
  userId: string | null | undefined,
  referredByUserId: string | null | undefined,
) {
  return ['affiliate-order-info', userId ?? 'guest', referredByUserId ?? null] as const
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

export function useAffiliateOrderMetadata(): AffiliateOrderMetadata {
  const user = useUser()
  const { data, isLoading } = useQuery({
    queryKey: getAffiliateOrderMetadataQueryKey(user?.id, user?.referred_by_user_id),
    queryFn: fetchAffiliateInfo,
    staleTime: 'static',
    gcTime: 10 * 60 * 1000,
  })

  return {
    ...(data ?? DEFAULT_RESPONSE),
    isLoading,
  }
}
