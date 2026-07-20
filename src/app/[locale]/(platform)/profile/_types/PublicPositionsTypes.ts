export type SortOption
  = | 'currentValue'
    | 'trade'
    | 'pnlPercent'
    | 'pnlValue'
    | 'shares'
    | 'alpha'
    | 'endingSoon'
    | 'payout'
    | 'latestPrice'
    | 'avgCost'

export type SortDirection = 'asc' | 'desc'

export type MarketStatusFilter = 'active' | 'closed'

export interface PositionsTotals {
  trade: number
  value: number
  diff: number
  pct: number
  toWin: number
}

export type ConditionShares = Record<string, number>
