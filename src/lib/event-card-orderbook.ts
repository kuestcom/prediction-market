import type { NormalizedBookLevel, OrderbookLevelSummary, OrderBookSummaryResponse } from '@/types/EventCardTypes'

const PRICE_EPSILON = 1e-8
const MAX_LIMIT_PRICE = 99.9
const CLOB_BASE_URL = process.env.CLOB_URL

export async function fetchClobJson<T>(path: string, body: unknown): Promise<T> {
  if (!CLOB_BASE_URL) {
    throw new Error('CLOB URL is not configured.')
  }

  const response = await fetch(`${CLOB_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const text = await response.text()
  if (!response.ok) {
    throw new Error(`Failed to fetch ${path}: ${response.status} ${text}`)
  }

  try {
    return JSON.parse(text) as T
  }
  catch (error) {
    console.error(`Failed to parse response from ${path}`, error)
    throw new Error(`Failed to parse response from ${path}`)
  }
}

export async function fetchOrderBookSummary(tokenId: string): Promise<OrderBookSummaryResponse> {
  const payload = [{ token_id: tokenId }]
  const orderBooks = await fetchClobJson<Array<OrderBookSummaryResponse & { asset_id?: string, token_id?: string }>>('/books', payload)

  const entry = Array.isArray(orderBooks)
    ? orderBooks.find(item => item && (item.asset_id === tokenId || (item as any).token_id === tokenId))
    : null

  if (!entry) {
    return {}
  }

  return {
    bids: entry.bids ?? [],
    asks: entry.asks ?? [],
  }
}

export function getRoundedCents(rawPrice: number, side: 'ask' | 'bid') {
  const cents = rawPrice * 100
  if (!Number.isFinite(cents)) {
    return 0
  }

  const scaled = cents * 10
  const roundedScaled = side === 'bid'
    ? Math.floor(scaled + PRICE_EPSILON)
    : Math.ceil(scaled - PRICE_EPSILON)

  const normalized = Math.max(0, Math.min(roundedScaled / 10, MAX_LIMIT_PRICE))
  return Number(normalized.toFixed(1))
}

export function normalizeBookLevels(levels: OrderbookLevelSummary[] | undefined, side: 'ask' | 'bid'): NormalizedBookLevel[] {
  if (!levels?.length) {
    return []
  }

  return levels
    .map((entry) => {
      const price = Number(entry.price)
      const size = Number(entry.size)
      if (!Number.isFinite(price) || !Number.isFinite(size) || price <= 0 || size <= 0) {
        return null
      }

      const priceCents = getRoundedCents(price, side)
      const priceDollars = priceCents / 100
      if (priceCents <= 0 || priceDollars <= 0) {
        return null
      }

      return {
        priceCents,
        priceDollars,
        size: Number(size.toFixed(2)),
      }
    })
    .filter((entry): entry is NormalizedBookLevel => entry !== null)
    .sort((a, b) => (side === 'ask' ? a.priceDollars - b.priceDollars : b.priceDollars - a.priceDollars))
}

export function calculateMarketFill(value: number, asks: NormalizedBookLevel[]) {
  if (!asks.length || value <= 0) {
    return {
      avgPriceCents: null as number | null,
      filledShares: 0,
      totalCost: 0,
    }
  }

  let remainingBudget = value
  let filledShares = 0
  let totalCost = 0

  for (const level of asks) {
    if (remainingBudget <= 0) {
      break
    }

    const maxSharesAtLevel = level.priceDollars > 0 ? remainingBudget / level.priceDollars : 0
    const fill = Math.min(level.size, maxSharesAtLevel)
    if (fill <= 0) {
      continue
    }
    const cost = fill * level.priceDollars
    filledShares = Number((filledShares + fill).toFixed(4))
    totalCost = Number((totalCost + cost).toFixed(4))
    remainingBudget = Math.max(0, Number((remainingBudget - cost).toFixed(4)))
  }

  const avgPriceCents = filledShares > 0
    ? Number(((totalCost / filledShares) * 100).toFixed(1))
    : null

  return {
    avgPriceCents,
    filledShares: Number(filledShares.toFixed(4)),
    totalCost: Number(totalCost.toFixed(4)),
  }
}
