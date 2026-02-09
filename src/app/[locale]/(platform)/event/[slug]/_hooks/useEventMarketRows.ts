import type { MarketQuote } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventMidPrices'
import type { Event, Outcome } from '@/types'
import { useEffect, useMemo } from 'react'
import { useEventOutcomeChanceChanges, useEventOutcomeChances, useMarketQuotes, useMarketYesPrices } from '@/app/[locale]/(platform)/event/[slug]/_components/EventOutcomeChanceProvider'
import { OUTCOME_INDEX } from '@/lib/constants'
import { toCents } from '@/lib/formatters'

interface BuildEventMarketRowsOptions {
  outcomeChances: Record<string, number>
  outcomeChanceChanges: Record<string, number>
  marketYesPrices: Record<string, number>
  marketQuotesByMarket?: Record<string, MarketQuote>
}

export interface EventMarketRowChanceMeta {
  chanceDisplay: string
  normalizedChance: number
  isSubOnePercent: boolean
  shouldShowChanceChange: boolean
  chanceChangeLabel: string
  isChanceChangePositive: boolean
}

export interface EventMarketRow {
  market: Event['markets'][number]
  yesOutcome?: Outcome
  noOutcome?: Outcome
  yesPriceValue: number | null
  noPriceValue: number | null
  yesPriceCentsOverride: number | null
  chanceMeta: EventMarketRowChanceMeta
}

export interface EventMarketRowsResult {
  hasChanceData: boolean
  rows: EventMarketRow[]
}

const MIN_PERCENT = 0
const MAX_PERCENT = 100

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function buildEventMarketRows(
  event: Event,
  { outcomeChances, outcomeChanceChanges, marketYesPrices, marketQuotesByMarket = {} }: BuildEventMarketRowsOptions,
): EventMarketRowsResult {
  const hasChanceData = event.markets.every(market => Number.isFinite(outcomeChances[market.condition_id]))

  const sortedMarkets = [...event.markets].sort((a, b) => {
    const aChance = outcomeChances[a.condition_id]
    const bChance = outcomeChances[b.condition_id]
    return (bChance ?? 0) - (aChance ?? 0)
  })

  const rows = sortedMarkets.map((market) => {
    const yesOutcome = market.outcomes[OUTCOME_INDEX.YES]
    const noOutcome = market.outcomes[OUTCOME_INDEX.NO]
    const yesPriceOverride = marketYesPrices[market.condition_id]
    const normalizedYesPrice = typeof yesPriceOverride === 'number'
      ? clamp(yesPriceOverride, 0, 1)
      : null
    const marketQuote = marketQuotesByMarket[market.condition_id]
    const normalizedBestAsk = typeof marketQuote?.ask === 'number'
      ? clamp(marketQuote.ask, 0, 1)
      : null
    const normalizedBestBid = typeof marketQuote?.bid === 'number'
      ? clamp(marketQuote.bid, 0, 1)
      : null
    const yesPriceValue = normalizedBestAsk ?? normalizedYesPrice
    const noPriceValue = normalizedBestBid != null
      ? clamp(1 - normalizedBestBid, 0, 1)
      : (normalizedYesPrice != null ? clamp(1 - normalizedYesPrice, 0, 1) : null)
    const yesPriceCentsOverride = normalizedYesPrice != null ? toCents(normalizedYesPrice) : null

    const rawChance = outcomeChances[market.condition_id]
    const hasMarketChance = Number.isFinite(rawChance)
    const normalizedChance = hasMarketChance
      ? clamp(rawChance ?? 0, MIN_PERCENT, MAX_PERCENT)
      : null
    const normalizedChanceValue = normalizedChance ?? 0
    const roundedChance = Math.round(normalizedChanceValue)
    const isSubOnePercent = normalizedChance != null && normalizedChance < 1
    const chanceDisplay = normalizedChance != null
      ? (isSubOnePercent ? '<1%' : `${roundedChance}%`)
      : '—'

    const rawChanceChange = outcomeChanceChanges[market.condition_id]
    const normalizedChanceChange = typeof rawChanceChange === 'number' && Number.isFinite(rawChanceChange)
      ? rawChanceChange
      : 0
    const absoluteChanceChange = Math.abs(normalizedChanceChange)
    const roundedChanceChange = Math.round(absoluteChanceChange)
    const shouldShowChanceChange = hasMarketChance && roundedChanceChange >= 1
    const chanceChangeLabel = shouldShowChanceChange ? `${roundedChanceChange}%` : ''
    const isChanceChangePositive = normalizedChanceChange > 0

    return {
      market,
      yesOutcome,
      noOutcome,
      yesPriceValue,
      noPriceValue,
      yesPriceCentsOverride,
      chanceMeta: {
        chanceDisplay,
        normalizedChance: normalizedChance ?? 0,
        isSubOnePercent,
        shouldShowChanceChange,
        chanceChangeLabel,
        isChanceChangePositive,
      },
    }
  })

  return { hasChanceData, rows }
}

export function useEventMarketRows(event: Event): EventMarketRowsResult {
  const outcomeChances = useEventOutcomeChances()
  const outcomeChanceChanges = useEventOutcomeChanceChanges()
  const marketYesPrices = useMarketYesPrices()
  const marketQuotesByMarket = useMarketQuotes()

  const result = useMemo(
    () => buildEventMarketRows(event, {
      outcomeChances,
      outcomeChanceChanges,
      marketYesPrices,
      marketQuotesByMarket,
    }),
    [event, outcomeChances, outcomeChanceChanges, marketYesPrices, marketQuotesByMarket],
  )

  useEffect(() => {
    if (!result.hasChanceData) {
      console.info('[MarketRows] Chance data unavailable, rendering placeholders for event', event.id)
    }
  }, [event.id, result.hasChanceData])

  return result
}
