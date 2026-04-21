import type { TimeRange } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventPriceHistory'
import type { Event } from '@/types'
import { useMemo } from 'react'
import { useEventLastTrades } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventLastTrades'
import { useEventMarketQuotes } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventMidPrices'
import {
  buildMarketTargets,
  useEventPriceHistory,
} from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventPriceHistory'
import {
  computeChanceChanges,
  resolveEventHistoryEndAt,
} from '@/app/[locale]/(platform)/event/[slug]/_utils/EventChartUtils'
import { resolveDisplayPrice } from '@/lib/market-chance'

interface UseEventMarketChanceDataParams {
  event: Event
  range: TimeRange
  enabled?: boolean
  includePriceHistory?: boolean
}

export function useEventMarketChanceData({
  event,
  range,
  enabled = true,
  includePriceHistory = true,
}: UseEventMarketChanceDataParams) {
  const eventHistoryEndAt = useMemo(
    () => resolveEventHistoryEndAt(event),
    [event],
  )
  const yesMarketTargets = useMemo(
    () => buildMarketTargets(event.markets),
    [event.markets],
  )
  const yesPriceHistory = useEventPriceHistory({
    eventId: event.id,
    range,
    targets: includePriceHistory && enabled ? yesMarketTargets : [],
    eventCreatedAt: event.created_at,
    eventResolvedAt: eventHistoryEndAt,
  })
  const fallbackLastTradesByMarket = useEventLastTrades(
    enabled && !includePriceHistory ? yesMarketTargets : [],
  )
  const marketLastTradesByMarket = includePriceHistory
    ? yesPriceHistory.latestRawPrices
    : fallbackLastTradesByMarket
  const marketQuotesByMarket = useEventMarketQuotes(yesMarketTargets, { enabled })
  const displayChanceByMarket = useMemo(() => {
    const marketIds = new Set([
      ...Object.keys(marketQuotesByMarket),
      ...Object.keys(marketLastTradesByMarket),
    ])
    const entries: Array<[string, number]> = []

    marketIds.forEach((marketId) => {
      const quote = marketQuotesByMarket[marketId]
      const lastTrade = marketLastTradesByMarket[marketId]
      const displayPrice = resolveDisplayPrice({
        bid: quote?.bid ?? null,
        ask: quote?.ask ?? null,
        midpoint: quote?.mid ?? null,
        lastTrade,
      })

      if (displayPrice != null) {
        entries.push([marketId, displayPrice * 100])
      }
    })

    return Object.fromEntries(entries)
  }, [marketLastTradesByMarket, marketQuotesByMarket])
  const chanceChangeByMarket = useMemo(() => {
    if (!includePriceHistory) {
      return {}
    }

    return computeChanceChanges(yesPriceHistory.normalizedHistory)
  }, [includePriceHistory, yesPriceHistory.normalizedHistory])

  return {
    displayChanceByMarket,
    chanceChangeByMarket,
    marketQuotesByMarket,
    yesMarketTargets,
    yesPriceHistory,
  }
}
