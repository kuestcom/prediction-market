import type { Event, Market } from '@/types'

export function mergeSportsEventGroupMarkets(eventsGroup: Array<Pick<Event, 'markets'>>) {
  const marketsByConditionId = new Map<string, Market>()

  for (const event of eventsGroup) {
    for (const market of event.markets ?? []) {
      if (!market?.condition_id || marketsByConditionId.has(market.condition_id)) {
        continue
      }

      marketsByConditionId.set(market.condition_id, market)
    }
  }

  return Array.from(marketsByConditionId.values())
}

export function sumFiniteSportsValues(values: Array<number | null | undefined>): number {
  return values.reduce<number>((sum, value) => {
    const numericValue = Number(value)
    return Number.isFinite(numericValue) ? sum + numericValue : sum
  }, 0)
}

export function resolveSportsMarketsVolume(markets: Array<Pick<Market, 'volume'>>) {
  return sumFiniteSportsValues(markets.map(market => market.volume))
}
