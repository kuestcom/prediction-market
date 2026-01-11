'use client'

import type { TimeRange } from '@/app/(platform)/event/[slug]/_hooks/useEventPriceHistory'
import type { EventChartProps } from '@/app/(platform)/event/[slug]/_types/EventChartTypes'
import type { PredictionChartCursorSnapshot, SeriesConfig } from '@/components/PredictionChart'
import type { Market } from '@/types'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { useMarketChannelSubscription } from '@/app/(platform)/event/[slug]/_components/EventMarketChannelProvider'
import {
  useEventOutcomeChanceChanges,
  useEventOutcomeChances,
  useMarketQuotes,
  useMarketYesPrices,
  useUpdateEventOutcomeChanceChanges,
  useUpdateEventOutcomeChances,
  useUpdateMarketQuotes,
  useUpdateMarketYesPrices,
} from '@/app/(platform)/event/[slug]/_components/EventOutcomeChanceProvider'
import { useEventMarketQuotes } from '@/app/(platform)/event/[slug]/_hooks/useEventMidPrices'
import {
  buildMarketTargets,
  TIME_RANGES,
  useEventPriceHistory,
} from '@/app/(platform)/event/[slug]/_hooks/useEventPriceHistory'
import {
  areNumberMapsEqual,
  areQuoteMapsEqual,
  buildChartSeries,
  buildMarketSignature,
  computeChanceChanges,
  filterChartDataForSeries,
  getMaxSeriesCount,
  getOutcomeLabelForMarket,
  getTopMarketIds,
} from '@/app/(platform)/event/[slug]/_utils/EventChartUtils'
import PredictionChart from '@/components/PredictionChart'
import { useWindowSize } from '@/hooks/useWindowSize'
import { OUTCOME_INDEX } from '@/lib/constants'
import { formatSharePriceLabel } from '@/lib/formatters'
import { resolveDisplayPrice } from '@/lib/market-chance'
import { useIsSingleMarket } from '@/stores/useOrder'
import EventChartControls from './EventChartControls'
import EventChartHeader from './EventChartHeader'
import EventChartLayout from './EventChartLayout'

interface TradeFlowLabelItem {
  id: string
  label: string
  outcome: 'yes' | 'no'
  createdAt: number
}

const tradeFlowMaxItems = 6
const tradeFlowTtlMs = 8000
const tradeFlowCleanupIntervalMs = 500

function getOutcomeTokenIds(market: Market | null) {
  if (!market) {
    return null
  }
  const yesOutcome = market.outcomes.find(outcome => outcome.outcome_index === OUTCOME_INDEX.YES)
  const noOutcome = market.outcomes.find(outcome => outcome.outcome_index === OUTCOME_INDEX.NO)

  if (!yesOutcome?.token_id || !noOutcome?.token_id) {
    return null
  }

  return {
    yesTokenId: String(yesOutcome.token_id),
    noTokenId: String(noOutcome.token_id),
  }
}

function buildTradeFlowLabel(price: number, size: number) {
  const notional = price * size
  if (!Number.isFinite(notional) || notional <= 0) {
    return null
  }
  return formatSharePriceLabel(notional / 100, { fallback: '0¢', currencyDigits: 0 })
}

function pruneTradeFlowItems(items: TradeFlowLabelItem[], now: number) {
  return items.filter(item => now - item.createdAt <= tradeFlowTtlMs)
}

function trimTradeFlowItems(items: TradeFlowLabelItem[]) {
  return items.slice(-tradeFlowMaxItems)
}

function EventChartComponent({ event, isMobile }: EventChartProps) {
  const isSingleMarket = useIsSingleMarket()
  const currentOutcomeChances = useEventOutcomeChances()
  const currentOutcomeChanceChanges = useEventOutcomeChanceChanges()
  const currentMarketQuotes = useMarketQuotes()
  const currentMarketYesPrices = useMarketYesPrices()
  const updateOutcomeChances = useUpdateEventOutcomeChances()
  const updateMarketYesPrices = useUpdateMarketYesPrices()
  const updateMarketQuotes = useUpdateMarketQuotes()
  const updateOutcomeChanceChanges = useUpdateEventOutcomeChanceChanges()

  const [activeTimeRange, setActiveTimeRange] = useState<TimeRange>('ALL')
  const [activeOutcomeIndex, setActiveOutcomeIndex] = useState<
    typeof OUTCOME_INDEX.YES | typeof OUTCOME_INDEX.NO
  >(OUTCOME_INDEX.YES)
  const [cursorSnapshot, setCursorSnapshot] = useState<PredictionChartCursorSnapshot | null>(null)
  const [tradeFlowItems, setTradeFlowItems] = useState<TradeFlowLabelItem[]>([])
  const tradeFlowIdRef = useRef(0)

  useEffect(() => {
    setCursorSnapshot(null)
  }, [activeTimeRange, event.slug, activeOutcomeIndex])

  const yesMarketTargets = useMemo(
    () => buildMarketTargets(event.markets, OUTCOME_INDEX.YES),
    [event.markets],
  )
  const noMarketTargets = useMemo(
    () => (isSingleMarket ? buildMarketTargets(event.markets, OUTCOME_INDEX.NO) : []),
    [event.markets, isSingleMarket],
  )

  const yesPriceHistory = useEventPriceHistory({
    eventId: event.id,
    range: activeTimeRange,
    targets: yesMarketTargets,
    eventCreatedAt: event.created_at,
  })
  const noPriceHistory = useEventPriceHistory({
    eventId: event.id,
    range: activeTimeRange,
    targets: noMarketTargets,
    eventCreatedAt: event.created_at,
  })
  const marketQuotesByMarket = useEventMarketQuotes(yesMarketTargets)
  const chanceChangeByMarket = useMemo(
    () => computeChanceChanges(yesPriceHistory.normalizedHistory),
    [yesPriceHistory.normalizedHistory],
  )
  const displayChanceByMarket = useMemo(() => {
    const marketIds = new Set([
      ...Object.keys(marketQuotesByMarket),
      ...Object.keys(yesPriceHistory.latestRawPrices),
    ])
    const entries: Array<[string, number]> = []

    marketIds.forEach((marketId) => {
      const quote = marketQuotesByMarket[marketId]
      const lastTrade = yesPriceHistory.latestRawPrices[marketId]
      const displayPrice = resolveDisplayPrice({
        bid: quote?.bid ?? null,
        ask: quote?.ask ?? null,
        lastTrade,
      })

      if (displayPrice != null) {
        entries.push([marketId, displayPrice * 100])
      }
    })

    return Object.fromEntries(entries)
  }, [marketQuotesByMarket, yesPriceHistory.latestRawPrices])

  const chartHistory = isSingleMarket && activeOutcomeIndex === OUTCOME_INDEX.NO
    ? noPriceHistory
    : yesPriceHistory
  const normalizedHistory = chartHistory.normalizedHistory
  const latestSnapshot = chartHistory.latestSnapshot

  useEffect(() => {
    if (Object.keys(displayChanceByMarket).length > 0) {
      if (areNumberMapsEqual(displayChanceByMarket, currentOutcomeChances)) {
        return
      }
      updateOutcomeChances(displayChanceByMarket)
    }
  }, [currentOutcomeChances, displayChanceByMarket, updateOutcomeChances])

  useEffect(() => {
    if (Object.keys(yesPriceHistory.latestRawPrices).length > 0) {
      if (areNumberMapsEqual(yesPriceHistory.latestRawPrices, currentMarketYesPrices)) {
        return
      }
      updateMarketYesPrices(yesPriceHistory.latestRawPrices)
    }
  }, [currentMarketYesPrices, yesPriceHistory.latestRawPrices, updateMarketYesPrices])

  useEffect(() => {
    if (Object.keys(chanceChangeByMarket).length > 0) {
      if (areNumberMapsEqual(chanceChangeByMarket, currentOutcomeChanceChanges)) {
        return
      }
      updateOutcomeChanceChanges(chanceChangeByMarket)
    }
  }, [chanceChangeByMarket, currentOutcomeChanceChanges, updateOutcomeChanceChanges])

  useEffect(() => {
    if (Object.keys(marketQuotesByMarket).length > 0) {
      if (areQuoteMapsEqual(marketQuotesByMarket, currentMarketQuotes)) {
        return
      }
      updateMarketQuotes(marketQuotesByMarket)
    }
  }, [currentMarketQuotes, marketQuotesByMarket, updateMarketQuotes])

  const topMarketIds = useMemo(
    () => getTopMarketIds(latestSnapshot, getMaxSeriesCount()),
    [latestSnapshot],
  )

  const chartSeries = useMemo(
    () => buildChartSeries(event, topMarketIds),
    [event, topMarketIds],
  )

  const fallbackMarketIds = useMemo(
    () => event.markets
      .map(market => market.condition_id)
      .filter((conditionId): conditionId is string => Boolean(conditionId))
      .slice(0, getMaxSeriesCount()),
    [event.markets],
  )

  const fallbackChartSeries = useMemo(
    () => buildChartSeries(event, fallbackMarketIds),
    [event, fallbackMarketIds],
  )

  const baseSeries = useMemo(
    () => (chartSeries.length > 0 ? chartSeries : fallbackChartSeries),
    [chartSeries, fallbackChartSeries],
  )

  const effectiveSeries = useMemo(() => {
    if (!isSingleMarket || baseSeries.length === 0) {
      return baseSeries
    }
    const primaryColor = activeOutcomeIndex === OUTCOME_INDEX.NO ? '#FF6600' : '#2D9CDB'
    return baseSeries.map((seriesItem, index) => (index === 0
      ? { ...seriesItem, color: primaryColor }
      : seriesItem))
  }, [activeOutcomeIndex, baseSeries, isSingleMarket])

  const watermark = useMemo(
    () => ({
      iconSvg: process.env.NEXT_PUBLIC_SITE_LOGO_SVG,
      label: process.env.NEXT_PUBLIC_SITE_NAME,
    }),
    [],
  )

  const legendSeries = effectiveSeries
  const hasLegendSeries = legendSeries.length > 0

  const primaryMarket = useMemo(
    () => {
      const primaryId = legendSeries[0]?.key
      return (primaryId
        ? event.markets.find(market => market.condition_id === primaryId)
        : null) ?? event.markets[0]
    },
    [event.markets, legendSeries],
  )
  const primarySeriesColor = legendSeries[0]?.color ?? 'currentColor'
  const oppositeOutcomeIndex = activeOutcomeIndex === OUTCOME_INDEX.YES
    ? OUTCOME_INDEX.NO
    : OUTCOME_INDEX.YES
  const oppositeOutcomeLabel = getOutcomeLabelForMarket(primaryMarket, oppositeOutcomeIndex)
  const activeOutcomeLabel = getOutcomeLabelForMarket(primaryMarket, activeOutcomeIndex)
  const outcomeTokenIds = useMemo(
    () => {
      return getOutcomeTokenIds(primaryMarket)
    },
    [primaryMarket],
  )

  const chartData = useMemo(
    () => filterChartDataForSeries(
      normalizedHistory,
      effectiveSeries.map(series => series.key),
    ),
    [normalizedHistory, effectiveSeries],
  )
  const hasChartData = chartData.length > 0
  const chartSignature = useMemo(() => {
    const seriesKeys = effectiveSeries.map(series => series.key).join(',')
    return `${event.id}:${activeTimeRange}:${activeOutcomeIndex}:${seriesKeys}`
  }, [event.id, activeTimeRange, activeOutcomeIndex, effectiveSeries])

  const { width: windowWidth } = useWindowSize()
  const chartWidth = isMobile ? ((windowWidth || 400) * 0.84) : Math.min((windowWidth ?? 1440) * 0.55, 900)

  const legendEntries = useMemo<Array<SeriesConfig & { value: number | null }>>(
    () => legendSeries.map((seriesItem) => {
      const hoveredValue = cursorSnapshot?.values?.[seriesItem.key]
      const snapshotValue = currentOutcomeChances[seriesItem.key] ?? latestSnapshot[seriesItem.key]
      const value = typeof hoveredValue === 'number' && Number.isFinite(hoveredValue)
        ? hoveredValue
        : (Number.isFinite(snapshotValue)
            ? snapshotValue
            : null)
      return { ...seriesItem, value }
    }),
    [legendSeries, cursorSnapshot, currentOutcomeChances, latestSnapshot],
  )

  const leadingMarket = legendSeries[0]
  const hoveredYesChance = leadingMarket
    ? cursorSnapshot?.values?.[leadingMarket.key]
    : null
  const storedYesChance = leadingMarket
    ? currentOutcomeChances[leadingMarket.key]
    : null
  const latestYesChance = leadingMarket
    ? yesPriceHistory.latestSnapshot[leadingMarket.key]
    : null
  const baseYesChance = typeof storedYesChance === 'number' && Number.isFinite(storedYesChance)
    ? storedYesChance
    : (typeof latestYesChance === 'number' && Number.isFinite(latestYesChance)
        ? latestYesChance
        : null)
  const baseActiveChance = typeof baseYesChance === 'number'
    ? (activeOutcomeIndex === OUTCOME_INDEX.NO
        ? Math.max(0, Math.min(100, 100 - baseYesChance))
        : baseYesChance)
    : null
  const resolvedYesChance = typeof hoveredYesChance === 'number' && Number.isFinite(hoveredYesChance)
    ? hoveredYesChance
    : (typeof baseActiveChance === 'number' && Number.isFinite(baseActiveChance)
        ? baseActiveChance
        : null)
  const yesChanceValue = typeof resolvedYesChance === 'number' ? resolvedYesChance : null
  const legendEntriesWithValues = useMemo(
    () => legendEntries.filter(entry => typeof entry.value === 'number' && Number.isFinite(entry.value)),
    [legendEntries],
  )
  const shouldRenderLegendEntries = chartSeries.length > 0 && legendEntriesWithValues.length > 0
  const cursorYesChance = typeof hoveredYesChance === 'number' && Number.isFinite(hoveredYesChance)
    ? hoveredYesChance
    : null
  const defaultBaselineYesChance = useMemo(() => {
    if (!leadingMarket) {
      return null
    }
    for (const point of chartData) {
      const value = point[leadingMarket.key]
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value
      }
    }
    return null
  }, [chartData, leadingMarket])
  const defaultCurrentYesChance = useMemo(() => {
    if (!leadingMarket) {
      return null
    }
    for (let index = chartData.length - 1; index >= 0; index -= 1) {
      const value = chartData[index]?.[leadingMarket.key]
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value
      }
    }
    return null
  }, [chartData, leadingMarket])
  const isHovering = cursorSnapshot !== null
    && cursorYesChance !== null
    && Number.isFinite(cursorYesChance)
  const effectiveBaselineYesChance = defaultBaselineYesChance
  const effectiveCurrentYesChance = isHovering
    ? cursorYesChance
    : defaultCurrentYesChance
  const hasTradeFlowLabels = tradeFlowItems.length > 0

  useEffect(() => {
    if (!outcomeTokenIds) {
      setTradeFlowItems([])
    }
  }, [outcomeTokenIds])

  useMarketChannelSubscription((payload) => {
    if (!outcomeTokenIds) {
      return
    }

    if (payload?.event_type !== 'last_trade_price') {
      return
    }

    const { yesTokenId, noTokenId } = outcomeTokenIds
    const assetId = payload.asset_id
    const price = Number(payload.price)
    const size = Number(payload.size)
    const label = buildTradeFlowLabel(price, size)

    if (!label) {
      return
    }

    let outcome: 'yes' | 'no' | null = null

    if (assetId === yesTokenId) {
      outcome = 'yes'
    }

    if (assetId === noTokenId) {
      outcome = 'no'
    }

    if (!outcome) {
      return
    }

    const createdAt = Date.now()
    const id = String(tradeFlowIdRef.current)
    tradeFlowIdRef.current += 1

    setTradeFlowItems((prev) => {
      const next = [...prev, { id, label, outcome, createdAt }]
      return trimTradeFlowItems(pruneTradeFlowItems(next, createdAt))
    })
  })

  useEffect(() => {
    if (!hasTradeFlowLabels) {
      return
    }

    const interval = window.setInterval(() => {
      const now = Date.now()
      setTradeFlowItems((prev) => {
        const next = pruneTradeFlowItems(prev, now)
        if (next.length === prev.length) {
          return prev
        }
        return next
      })
    }, tradeFlowCleanupIntervalMs)

    return () => {
      window.clearInterval(interval)
    }
  }, [hasTradeFlowLabels])

  const legendContent = shouldRenderLegendEntries
    ? (
        <div className="flex min-h-5 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
          {legendEntriesWithValues.map((entry) => {
            const resolvedValue = entry.value as number
            return (
              <div key={entry.key} className="flex items-center gap-2">
                <div
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="inline-flex w-fit items-center gap-0.5 text-xs font-medium text-muted-foreground">
                  <span>{entry.name}</span>
                  <span className="inline-flex w-6 items-baseline justify-end font-semibold tabular-nums">
                    {resolvedValue.toFixed(0)}
                    <span className="text-2xs">%</span>
                  </span>
                </span>
              </div>
            )
          })}
        </div>
      )
    : null

  if (!hasLegendSeries) {
    return null
  }
  return (
    <EventChartLayout
      header={(
        <EventChartHeader
          isSingleMarket={isSingleMarket}
          activeOutcomeIndex={activeOutcomeIndex}
          activeOutcomeLabel={activeOutcomeLabel}
          primarySeriesColor={primarySeriesColor}
          yesChanceValue={yesChanceValue}
          effectiveBaselineYesChance={effectiveBaselineYesChance}
          effectiveCurrentYesChance={effectiveCurrentYesChance}
          watermark={watermark}
        />
      )}
      chart={(
        <div className="relative">
          <PredictionChart
            data={chartData}
            series={legendSeries}
            width={chartWidth}
            height={280}
            margin={{ top: 30, right: 40, bottom: 52, left: 0 }}
            dataSignature={chartSignature}
            onCursorDataChange={setCursorSnapshot}
            xAxisTickCount={isMobile ? 3 : 6}
            legendContent={legendContent}
            showLegend={!isSingleMarket}
            watermark={isSingleMarket ? undefined : watermark}
          />
          {hasTradeFlowLabels
            ? (
                <div className={`
                  pointer-events-none absolute bottom-6 left-4 flex flex-col gap-1 text-sm font-semibold tabular-nums
                `}
                >
                  {tradeFlowItems.map(item => (
                    <span
                      key={item.id}
                      className={`${item.outcome === 'yes' ? 'text-yes' : 'text-no'} animate-trade-flow-rise`}
                    >
                      +
                      {item.label}
                    </span>
                  ))}
                </div>
              )
            : null}
        </div>
      )}
      controls={(
        <EventChartControls
          hasChartData={hasChartData}
          timeRanges={TIME_RANGES}
          activeTimeRange={activeTimeRange}
          onTimeRangeChange={setActiveTimeRange}
          showOutcomeSwitch={isSingleMarket}
          oppositeOutcomeLabel={oppositeOutcomeLabel}
          onShuffle={() => {
            setActiveOutcomeIndex(oppositeOutcomeIndex)
            setCursorSnapshot(null)
          }}
        />
      )}
    />
  )
}

function areChartPropsEqual(prev: EventChartProps, next: EventChartProps) {
  if (prev.isMobile !== next.isMobile) {
    return false
  }
  if (prev.event.id !== next.event.id) {
    return false
  }
  if (prev.event.updated_at !== next.event.updated_at) {
    return false
  }

  return buildMarketSignature(prev.event) === buildMarketSignature(next.event)
}

export default memo(EventChartComponent, areChartPropsEqual)
