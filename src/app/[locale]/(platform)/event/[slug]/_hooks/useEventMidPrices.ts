import type { MarketTokenTarget } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventPriceHistory'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

interface PriceApiResponse {
  [tokenId: string]: { BUY?: string, SELL?: string } | undefined
}

interface MidpointApiResponse {
  mid?: string
}

export interface MarketQuote {
  bid: number | null
  ask: number | null
  mid: number | null
}

export type MarketQuotesByMarket = Record<string, MarketQuote>

const PRICE_REFRESH_INTERVAL_MS = 60_000
const CLOB_BASE_URL = process.env.CLOB_URL

function normalizePrice(value: string | number | undefined | null) {
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

function resolveQuote(
  priceBySide: { BUY?: string, SELL?: string } | undefined,
  midpoint: number | null,
): MarketQuote {
  // CLOB /prices returns BUY as best ask and SELL as best bid for the token.
  const ask = normalizePrice(priceBySide?.BUY)
  const bid = normalizePrice(priceBySide?.SELL)
  const normalizedMidpoint = normalizePrice(midpoint)
  const mid = bid != null && ask != null
    ? (normalizedMidpoint ?? (bid + ask) / 2)
    : (normalizedMidpoint ?? ask ?? bid ?? null)

  return { bid, ask, mid }
}

async function fetchMidpointByToken(tokenId: string): Promise<number | null> {
  if (!CLOB_BASE_URL) {
    return null
  }

  try {
    const response = await fetch(`${CLOB_BASE_URL}/midpoint?token_id=${encodeURIComponent(tokenId)}`)
    if (!response.ok) {
      return null
    }

    const payload = await response.json() as MidpointApiResponse
    return normalizePrice(payload?.mid)
  }
  catch {
    return null
  }
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

  const [data, midpointResults] = await Promise.all([
    response.json() as Promise<PriceApiResponse>,
    Promise.allSettled(uniqueTokenIds.map(tokenId => fetchMidpointByToken(tokenId))),
  ])
  const quotesByToken = new Map<string, MarketQuote>()
  const midpointByToken = new Map<string, number | null>()

  midpointResults.forEach((result, index) => {
    const tokenId = uniqueTokenIds[index]
    midpointByToken.set(tokenId, result.status === 'fulfilled' ? result.value : null)
  })

  uniqueTokenIds.forEach((tokenId) => {
    quotesByToken.set(tokenId, resolveQuote(data?.[tokenId], midpointByToken.get(tokenId) ?? null))
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
