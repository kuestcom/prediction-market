import type { Event, Market, Outcome } from '@/types'

export interface EventCardProps {
  event: Event
  priceOverridesByMarket?: Record<string, number>
  enableHomeSportsMoneylineLayout?: boolean
}

export interface SelectedOutcome {
  market: Market
  outcome: Outcome
  variant: 'yes' | 'no'
}

export interface OrderbookLevelSummary {
  price?: string
  size?: string
}

export interface OrderBookSummaryResponse {
  bids?: OrderbookLevelSummary[]
  asks?: OrderbookLevelSummary[]
}

export interface NormalizedBookLevel {
  priceCents: number
  priceDollars: number
  size: number
}
