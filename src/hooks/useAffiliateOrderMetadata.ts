import { useQuery } from '@tanstack/react-query'

import { ZERO_ADDRESS } from '@/lib/contracts'

interface AffiliateInfoResponse {
  referrerAddress: `0x${string}`
  affiliateAddress: `0x${string}`
  affiliateSharePercent: number
  tradeFeeBps: number
}

const WALLET_ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/

function resolveDefaultReferrerAddress() {
  const envAddress = process.env.NEXT_PUBLIC_FEE_RECIPIENT_WALLET?.trim()
  if (envAddress && WALLET_ADDRESS_PATTERN.test(envAddress)) {
    return envAddress as `0x${string}`
  }

  return ZERO_ADDRESS
}

const DEFAULT_RESPONSE: AffiliateInfoResponse = {
  referrerAddress: resolveDefaultReferrerAddress(),
  affiliateAddress: ZERO_ADDRESS,
  affiliateSharePercent: 0,
  tradeFeeBps: 200,
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
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })

  return data ?? DEFAULT_RESPONSE
}
