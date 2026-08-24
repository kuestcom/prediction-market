export type MarketMakingSourceFilter = 'all' | 'mine' | 'kuest' | 'polymarket'

export interface MarketMakingDiscoveryMarket {
  id: string
  title: string
  conditionId: string
  kuestConditionId: string | null
  polymarketConditionId: string | null
  iconUrl: string | null
  endDate: string | null
  liquidity: number
  volume: number
  volume24h: number
}

export interface MarketMakingDiscoveryItem {
  id: string
  source: 'kuest' | 'polymarket'
  title: string
  slug: string | null
  iconUrl: string | null
  endDate: string | null
  liquidity: number
  volume: number
  volume24h: number
  markets: MarketMakingDiscoveryMarket[]
  isMine: boolean
  isOnKuest: boolean
  hedgeAvailable: boolean
  needsDeployment: boolean
  isNegRisk: boolean
  showMarketIcons: boolean
  seriesSlug: string | null
  seriesRecurrence: string | null
  creatorFilter: string | null
}

export interface MarketMakingDiscoveryResponse {
  data: MarketMakingDiscoveryItem[]
  volumeSource: 'clob' | 'database' | 'mixed'
}
