export interface LeaderboardEntry {
  rank?: number | string
  proxyWallet?: string
  userName?: string
  vol?: number
  pnl?: number
  profileImage?: string
  xUsername?: string
  verifiedBadge?: boolean
}

export interface BiggestWinEntry {
  rank?: number | string
  winRank?: number | string
  proxyWallet?: string
  userName?: string
  profileImage?: string
  xUsername?: string
  eventTitle?: string
  eventSlug?: string
  marketSlug?: string
  amountIn?: number
  amountOut?: number
  [key: string]: unknown
}

export interface TimeframePnlBatchResponse {
  values?: Record<string, number>
}
