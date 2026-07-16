'use client'

import type { OrderBookSummariesResponse } from '@/app/[locale]/(platform)/event/[slug]/_types/EventOrderBookTypes'
import { useQuery } from '@tanstack/react-query'

export function usePolymarketOrderBooks(tokenIds: string[], enabled = true) {
  const tokenIdsKey = tokenIds.slice().sort().join(',')

  return useQuery({
    queryKey: ['polymarket-order-books', tokenIdsKey],
    enabled: enabled && tokenIds.length > 0,
    staleTime: 2_000,
    refetchInterval: 5_000,
    queryFn: async () => {
      const response = await fetch('/api/arbitrage/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenIds }),
      })
      if (!response.ok) {
        throw new Error('Polymarket order book unavailable.')
      }
      return response.json() as Promise<OrderBookSummariesResponse>
    },
  })
}
