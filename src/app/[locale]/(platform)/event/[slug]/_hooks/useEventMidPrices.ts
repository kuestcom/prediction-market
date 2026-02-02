import type { MarketTokenTarget } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventPriceHistory'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

interface PriceApiResponse {
  [tokenId: string]: { BUY?: string, SELL?: string } | undefined
}

export interface MarketQuote {
  bid: number | null
  ask: number | null
  mid: number | null
}

export type MarketQuotesByMarket = Record<string, MarketQuote>

const PRICE_REFRESH_INTERVAL_MS = 60_000
const CLOB_BASE_URL = process.env.CLOB_URL

function normalizePrice(value: string | undefined) {
  if (value == null) {
    return null
  }
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return null
  }
  if (parsed < 0) {
    return 0
  }
  if (parsed > 1) {
    return 1
  }
  return parsed
}

function resolveQuote(priceBySide: { BUY?: string, SELL?: string } | undefined): MarketQuote {
  const bid = normalizePrice(priceBySide?.BUY)
  const ask = normalizePrice(priceBySide?.SELL)
  const mid = bid != null && ask != null
    ? (bid + ask) / 2
    : (ask ?? bid ?? null)

  return { bid, ask, mid }
}

async function fetchQuotesByMarket(targets: MarketTokenTarget[]): Promise<MarketQuotesByMarket> {
  const uniqueTokenIds = Array.from(
    new Set(targets.map(target => target.tokenId).filter(Boolean)),
  )

  if (!uniqueTokenIds.length) {
    return {}
  }

  if (!CLOB_BASE_URL) {
    throw new Error('CLOB URL is not configured.')
  }

  const response = await fetch(`${CLOB_BASE_URL}/prices`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(uniqueTokenIds.map(tokenId => ({ token_id: tokenId }))),
  })

  if (!response.ok) {
    const message = `Failed to fetch market quotes (${response.status} ${response.statusText}).`
    console.error(message)
    throw new Error(message)
  }

  const data = await response.json() as PriceApiResponse
  const quotesByToken = new Map<string, MarketQuote>()

  uniqueTokenIds.forEach((tokenId) => {
    quotesByToken.set(tokenId, resolveQuote(data?.[tokenId]))
  })

  return targets.reduce<MarketQuotesByMarket>((acc, target) => {
    const quote = quotesByToken.get(target.tokenId)
    if (quote) {
      acc[target.conditionId] = quote
    }
    return acc
  }, {})
}

export function useEventMarketQuotes(targets: MarketTokenTarget[]) {
  const tokenSignature = useMemo(
    () => targets.map(target => `${target.conditionId}:${target.tokenId}`).sort().join(','),
    [targets],
  )

  const { data } = useQuery({
    queryKey: ['event-market-quotes', tokenSignature],
    queryFn: () => fetchQuotesByMarket(targets),
    enabled: targets.length > 0,
    staleTime: PRICE_REFRESH_INTERVAL_MS,
    gcTime: PRICE_REFRESH_INTERVAL_MS,
    refetchInterval: PRICE_REFRESH_INTERVAL_MS,
    refetchIntervalInBackground: true,
    placeholderData: keepPreviousData,
  })

  return data ?? {}
}
