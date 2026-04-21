import type { Event, Outcome } from '@/types'
import { useMemo } from 'react'
import { useEventMarketChanceData } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventMarketChanceData'
import { OUTCOME_INDEX } from '@/lib/constants'
import { toCents } from '@/lib/formatters'
import { resolveFallbackOutcomeUnitPrice } from '@/lib/market-pricing'

interface BuildEventMarketRowsOptions {
  outcomeChances: Record<string, number>
  outcomeChanceChanges: Record<string, number>
  marketYesPrices: Record<string, number>
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
  { outcomeChances, outcomeChanceChanges, marketYesPrices }: BuildEventMarketRowsOptions,
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
    const rawChance = outcomeChances[market.condition_id]
    const hasMarketChance = Number.isFinite(rawChance)
    const normalizedChance = hasMarketChance
      ? clamp(rawChance ?? 0, MIN_PERCENT, MAX_PERCENT)
      : null
    const fallbackYesPrice = resolveFallbackOutcomeUnitPrice(market, yesOutcome)
      ?? normalizedYesPrice
      ?? (normalizedChance != null ? clamp(normalizedChance / 100, 0, 1) : null)
    const fallbackNoPrice = resolveFallbackOutcomeUnitPrice(market, noOutcome)
      ?? (fallbackYesPrice != null ? clamp(1 - fallbackYesPrice, 0, 1) : null)
    const yesPriceValue = fallbackYesPrice
    const noPriceValue = fallbackNoPrice
    const yesPriceCentsOverride = fallbackYesPrice != null ? toCents(fallbackYesPrice) : null
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
  const {
    chanceChangeByMarket: historicalChanceChangeByMarket,
    displayChanceByMarket,
    yesPriceHistory,
  } = useEventMarketChanceData({
    event,
    range: 'ALL',
    includePriceHistory: false,
  })
  const chanceChangeByMarket = useMemo(() => {
    if (Object.keys(historicalChanceChangeByMarket).length > 0) {
      return historicalChanceChangeByMarket
    }

    const entries = event.markets.map((market) => {
      const baselineChance = Number.isFinite(market.probability)
        ? market.probability
        : null
      const liveChance = displayChanceByMarket[market.condition_id]

      if (
        baselineChance == null
        || typeof liveChance !== 'number'
        || !Number.isFinite(liveChance)
      ) {
        return [market.condition_id, 0] as const
      }

      return [market.condition_id, liveChance - baselineChance] as const
    })

    return Object.fromEntries(entries)
  }, [displayChanceByMarket, event.markets, historicalChanceChangeByMarket])

  return useMemo(
    () => buildEventMarketRows(event, {
      outcomeChances: displayChanceByMarket,
      outcomeChanceChanges: chanceChangeByMarket,
      marketYesPrices: yesPriceHistory.latestRawPrices,
    }),
    [chanceChangeByMarket, displayChanceByMarket, event, yesPriceHistory.latestRawPrices],
  )
}
