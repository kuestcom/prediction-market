'use client'

import type { OrderBookSummariesResponse } from '@/app/[locale]/(platform)/event/[slug]/_types/EventOrderBookTypes'
import { useQuery } from '@tanstack/react-query'

class PolymarketOrderBookError extends Error {
  status: number
  body: string

  constructor(status: number, body: string) {
    super(`Polymarket order book unavailable (${status}).${body ? ` ${body}` : ''}`)
    this.name = 'PolymarketOrderBookError'
    this.status = status
    this.body = body
  }
}

export function usePolymarketOrderBooks(tokenIds: string[], enabled = true) {
  const tokenIdsKey = tokenIds.slice().sort().join(',')

  return useQuery({
    queryKey: ['polymarket-order-books', tokenIdsKey],
    enabled: enabled && tokenIds.length > 0,
    staleTime: 2_000,
    refetchInterval: 5_000,
    retry: 1,
    queryFn: async () => {
      const response = await fetch('/api/arbitrage/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenIds }),
      })
      if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw new PolymarketOrderBookError(response.status, body.slice(0, 500))
      }
      return response.json() as Promise<OrderBookSummariesResponse>
    },
  })
}
