interface LeaderboardWalletAliases {
  proxyWallet?: string
  proxy_wallet?: string
  proxyAddress?: string
  proxy_address?: string
  proxyWalletAddress?: string
  proxy_wallet_address?: string
}

export interface LeaderboardEntry extends LeaderboardWalletAliases {
  rank?: number | string
  userName?: string
  vol?: number
  pnl?: number
  profileImage?: string
  xUsername?: string
  verifiedBadge?: boolean
}

export interface BiggestWinEntry extends LeaderboardWalletAliases {
  rank?: number | string
  winRank?: number | string
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
