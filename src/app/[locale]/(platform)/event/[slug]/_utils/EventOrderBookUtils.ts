import type {
  ClobOrderbookSummary,
  LastTradePriceEntry,
  OrderBookLevel,
  OrderbookLevelSummary,
  OrderBookSnapshot,
  OrderBookSummariesResponse,
  OrderBookSummaryResponse,
} from '@/app/[locale]/(platform)/event/[slug]/_types/EventOrderBookTypes'
import type { Market, Outcome } from '@/types'
import { MICRO_UNIT, OUTCOME_INDEX } from '@/lib/constants'
import { formatCentsLabel, formatSharesLabel, toCents } from '@/lib/formatters'

const DEFAULT_MAX_LEVELS = 12
const MAX_LIMIT_PRICE = 99.9
const PRICE_EPSILON = 1e-8
const CLOB_BASE_URL = process.env.CLOB_URL

export async function fetchClobJson<T>(path: string, body: unknown): Promise<T> {
  if (!CLOB_BASE_URL) {
    throw new Error('CLOB URL is not configured.')
  }

  const endpoint = `${CLOB_BASE_URL}${path}`
  const response = await fetch(endpoint, {
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

export async function fetchOrderBookSummaries(tokenIds: string[]): Promise<OrderBookSummariesResponse> {
  if (!tokenIds.length) {
    return {}
  }

  const payload = tokenIds.map(tokenId => ({ token_id: tokenId }))

  const [orderBooks, lastTrades] = await Promise.all([
    fetchClobJson<ClobOrderbookSummary[]>('/books', payload),
    fetchClobJson<LastTradePriceEntry[]>('/last-trades-prices', payload).catch((error) => {
      console.error('Failed to fetch last trades prices', error)
      return null
    }),
  ])

  if (!Array.isArray(orderBooks)) {
    throw new TypeError('Unexpected response format from /books')
  }

  const orderBookByToken = new Map<string, ClobOrderbookSummary>()
  orderBooks.forEach((entry) => {
    if (entry?.asset_id) {
      orderBookByToken.set(entry.asset_id, entry)
    }
  })

  const lastTradesByToken = new Map<string, LastTradePriceEntry>()
  lastTrades?.forEach((entry) => {
    if (entry?.token_id) {
      lastTradesByToken.set(entry.token_id, entry)
    }
  })

  const combined: Record<string, OrderBookSummaryResponse> = {}

  tokenIds.forEach((tokenId) => {
    const orderbookEntry = orderBookByToken.get(tokenId)
    const lastTradeEntry = lastTradesByToken.get(tokenId)

    combined[tokenId] = {
      bids: orderbookEntry?.bids ?? [],
      asks: orderbookEntry?.asks ?? [],
      last_trade_price: lastTradeEntry?.price,
      last_trade_side: lastTradeEntry?.side,
    }
  })

  return combined
}

export function buildOrderBookSnapshot(
  summary: OrderBookSummaryResponse | null,
  market: Market,
  outcome: Outcome | undefined,
): OrderBookSnapshot {
  const outcomeToUse = outcome ?? market.outcomes[0]
  const normalizedAsks = normalizeLevels(summary?.asks, 'ask')
  const normalizedBids = normalizeLevels(summary?.bids, 'bid')
  const maxTotal = Math.max(
    1,
    normalizedAsks.reduce((max, level) => Math.max(max, level.total), 0),
    normalizedBids.reduce((max, level) => Math.max(max, level.total), 0),
  )

  const bestAsk = normalizedAsks[0]?.priceCents
  const bestBid = normalizedBids[0]?.priceCents
  const lastTradeOverride = toCents(summary?.last_trade_price)

  let lastPrice: number | null = lastTradeOverride ?? null
  if (lastPrice === null) {
    if (typeof bestBid === 'number') {
      lastPrice = bestBid
    }
    else if (typeof bestAsk === 'number') {
      lastPrice = bestAsk
    }
  }

  const spread = typeof bestAsk === 'number' && typeof bestBid === 'number'
    ? Math.max(0, Number((bestAsk - bestBid).toFixed(1)))
    : null

  return {
    asks: normalizedAsks,
    bids: normalizedBids,
    maxTotal,
    lastPrice,
    spread,
    outcomeLabel: outcomeToUse?.outcome_index === OUTCOME_INDEX.YES ? 'Yes' : 'No',
  }
}

export function getExecutableLimitPrice(level: OrderBookLevel) {
  return getRoundedCents(level.rawPrice, level.side).toFixed(1)
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

function normalizeLevels(levels: OrderbookLevelSummary[] | undefined, side: 'ask' | 'bid'): OrderBookLevel[] {
  if (!levels?.length) {
    return []
  }

  const parsed = levels
    .map((entry) => {
      const price = Number(entry.price)
      const size = Number(entry.size)
      if (!Number.isFinite(price) || !Number.isFinite(size) || price <= 0 || size <= 0) {
        return null
      }

      return { price, size }
    })
    .filter((entry): entry is { price: number, size: number } => entry !== null)

  const sorted = parsed
    .sort((a, b) => (side === 'ask' ? a.price - b.price : b.price - a.price))
    .map(entry => ({
      price: entry.price,
      size: Number(entry.size.toFixed(2)),
    }))
    .filter(entry => entry.size > 0)
    .slice(0, DEFAULT_MAX_LEVELS)

  let runningTotal = 0
  let runningShares = 0

  return sorted.map((entry) => {
    const displayCents = getRoundedCents(entry.price, side)
    runningTotal += entry.price * entry.size
    runningShares = Number((runningShares + entry.size).toFixed(2))

    return {
      side,
      rawPrice: entry.price,
      priceCents: displayCents,
      shares: entry.size,
      cumulativeShares: runningShares,
      total: runningTotal,
    }
  })
}

export function getOrderBookUserKey(side: 'ask' | 'bid', priceCents: number) {
  return `${side}:${priceCents.toFixed(1)}`
}

export function microToUnit(value?: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0
  }
  return value / MICRO_UNIT
}

export function formatSharesInput(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return '0'
  }

  return Number(value.toFixed(2)).toString()
}

export function calculateLimitAmount(priceCents: string, shares: string) {
  const priceValue = Number.parseFloat(priceCents)
  const sharesValue = Number.parseFloat(shares)

  if (!Number.isFinite(priceValue) || !Number.isFinite(sharesValue)) {
    return null
  }

  const total = (priceValue * sharesValue) / 100
  if (!Number.isFinite(total) || total <= 0) {
    return null
  }

  return total.toFixed(2)
}

export function formatTooltipShares(value: number) {
  if (!Number.isFinite(value)) {
    return '0'
  }
  return formatSharesLabel(value)
}

export function formatOrderBookPrice(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return formatCentsLabel(null)
  }

  const normalized = value <= 1 ? value / 100 : value
  return formatCentsLabel(normalized)
}
