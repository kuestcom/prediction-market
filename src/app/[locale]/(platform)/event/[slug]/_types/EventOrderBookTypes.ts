import type { Market, Outcome } from '@/types'

export interface OrderBookLevel {
  side: 'ask' | 'bid'
  rawPrice: number
  priceCents: number
  shares: number
  total: number
  cumulativeShares: number
}

export interface EventOrderBookProps {
  market: Market
  outcome?: Outcome
  summaries?: OrderBookSummariesResponse
  isLoadingSummaries: boolean
  eventSlug: string
  surfaceVariant?: 'default' | 'sportsCard'
  tradeLabel?: string
  onToggleOutcome?: () => void
  toggleOutcomeTooltip?: string
}

export interface OrderbookLevelSummary {
  price: string
  size: string
}

export interface OrderBookSummaryResponse {
  bids?: OrderbookLevelSummary[]
  asks?: OrderbookLevelSummary[]
  spread?: string
  last_trade_price?: string
  last_trade_side?: 'BUY' | 'SELL'
}

export interface ClobOrderbookSummary {
  asset_id: string
  bids?: OrderbookLevelSummary[]
  asks?: OrderbookLevelSummary[]
}

export interface LastTradePriceEntry {
  token_id: string
  price: string
  side: 'BUY' | 'SELL'
}

export type OrderBookSummariesResponse = Record<string, OrderBookSummaryResponse>

export interface OrderBookSnapshot {
  asks: OrderBookLevel[]
  bids: OrderBookLevel[]
  lastPrice: number | null
  spread: number | null
  maxTotal: number
  outcomeLabel: string
}

export interface OrderBookUserOrder {
  id: string
  priceCents: number
  totalShares: number
  filledShares: number
  side: 'ask' | 'bid'
}
