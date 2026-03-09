import type { Event } from '@/types'

export interface EventCardProps {
  event: Event
  priceOverridesByMarket?: Record<string, number>
  enableHomeSportsMoneylineLayout?: boolean
  currentTimestamp?: number | null
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
