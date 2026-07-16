'use client'

import type { PolymarketTickSize } from '@/lib/polymarket-market'
import { useQuery } from '@tanstack/react-query'

export function usePolymarketMarketInfo(conditionId?: string | null) {
  return useQuery({
    queryKey: ['polymarket-market-info', conditionId],
    enabled: Boolean(conditionId),
    staleTime: 30_000,
    queryFn: async () => {
      const params = new URLSearchParams({ conditionId: conditionId! })
      const response = await fetch(`/api/arbitrage/market-info?${params}`)
      if (!response.ok) {
        throw new Error('Polymarket market info unavailable.')
      }
      return response.json() as Promise<{
        feeExponent: number
        feeRate: number
        minimumOrderSize: number
        minimumTickSize: PolymarketTickSize
      }>
    },
  })
}
