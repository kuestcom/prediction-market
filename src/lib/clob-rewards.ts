export interface MarketRewardConfig {
  conditionId: string
  maxSpread: number
  minSize: number
  dailyRate: number
  minimumOrderAge: number
  midpointSource: string
}

interface RewardsMarketPayload {
  condition_id?: string
  rewards_max_spread?: number | string
  rewards_min_size?: number | string
  total_daily_rate?: number | string
  rate_per_day?: number | string
  minimum_order_age?: number | string
  midpoint_source?: string
}

interface RewardsMarketsResponse {
  data?: RewardsMarketPayload[]
}

function readNumber(value: unknown) {
  const parsed = typeof value === 'string' ? Number(value) : value
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : 0
}

export async function fetchMarketRewards(conditionIds: string[], clobUrl: string) {
  const uniqueIds = [...new Set(conditionIds.map((value) => value.trim()).filter(Boolean))]
  if (!uniqueIds.length) {
    return []
  }

  const params = new URLSearchParams({ condition_ids: uniqueIds.join(',') })
  const response = await fetch(`${clobUrl}/rewards/markets/multi?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  })
  const text = await response.text()
  if (!response.ok) {
    throw new Error(`Failed to fetch reward markets: ${response.status} ${text}`)
  }

  const payload = JSON.parse(text) as RewardsMarketsResponse
  return (payload.data ?? [])
    .map((market): MarketRewardConfig | null => {
      const conditionId = market.condition_id?.trim() ?? ''
      const dailyRate = readNumber(market.total_daily_rate ?? market.rate_per_day)
      if (!conditionId || dailyRate <= 0) {
        return null
      }
      return {
        conditionId,
        dailyRate,
        maxSpread: readNumber(market.rewards_max_spread),
        minSize: readNumber(market.rewards_min_size),
        minimumOrderAge: readNumber(market.minimum_order_age),
        midpointSource: market.midpoint_source?.trim() || 'kuest',
      }
    })
    .filter((market): market is MarketRewardConfig => market !== null)
}
