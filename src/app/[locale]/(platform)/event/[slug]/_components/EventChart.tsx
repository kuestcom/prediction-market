'use client'

import type { TimeRange } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventPriceHistory'
import type { EventChartProps } from '@/app/[locale]/(platform)/event/[slug]/_types/EventChartTypes'
import type { Market } from '@/types'
import type {
  DataPoint,
  PredictionChartCursorSnapshot,
  PredictionChartProps,
  SeriesConfig,
} from '@/types/PredictionChartTypes'
import dynamic from 'next/dynamic'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMarketChannelSubscription } from '@/app/[locale]/(platform)/event/[slug]/_components/EventMarketChannelProvider'
import {
  useEventOutcomeChanceChanges,
  useEventOutcomeChances,
  useMarketQuotes,
  useMarketYesPrices,
  useUpdateEventOutcomeChanceChanges,
  useUpdateEventOutcomeChances,
  useUpdateMarketQuotes,
  useUpdateMarketYesPrices,
} from '@/app/[locale]/(platform)/event/[slug]/_components/EventOutcomeChanceProvider'
import { useEventMarketQuotes } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventMidPrices'
import {
  buildMarketTargets,
  TIME_RANGES,
  useEventPriceHistory,
} from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventPriceHistory'
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
} from '@/app/[locale]/(platform)/event/[slug]/_utils/EventChartUtils'
import SiteLogoIcon from '@/components/SiteLogoIcon'
import { useSiteIdentity } from '@/hooks/useSiteIdentity'
import { useWindowSize } from '@/hooks/useWindowSize'
import { OUTCOME_INDEX } from '@/lib/constants'
import { formatSharePriceLabel } from '@/lib/formatters'
import { resolveDisplayPrice } from '@/lib/market-chance'
import { cn } from '@/lib/utils'
import { useIsSingleMarket } from '@/stores/useOrder'
import { loadStoredChartSettings, storeChartSettings } from '../_utils/chartSettingsStorage'
import EventChartControls, { defaultChartSettings } from './EventChartControls'
import EventChartEmbedDialog from './EventChartEmbedDialog'
import EventChartExportDialog from './EventChartExportDialog'
import EventChartHeader from './EventChartHeader'
import EventChartLayout from './EventChartLayout'
import EventMetaInformation from './EventMetaInformation'

interface TradeFlowLabelItem {
  id: string
  label: string
  outcome: 'yes' | 'no'
  createdAt: number
}

const tradeFlowMaxItems = 6
const tradeFlowTtlMs = 8000
const tradeFlowCleanupIntervalMs = 500
const tradeFlowTextStrokeStyle = {
  textShadow: `
    1px 0 0 var(--background),
    -1px 0 0 var(--background),
    0 1px 0 var(--background),
    0 -1px 0 var(--background),
    1px 1px 0 var(--background),
    -1px -1px 0 var(--background),
    1px -1px 0 var(--background),
    -1px 1px 0 var(--background)
  `,
} as const

const PredictionChart = dynamic<PredictionChartProps>(
  () => import('@/components/PredictionChart'),
  { ssr: false, loading: () => <div className="h-83 w-full" /> },
)

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

function buildCombinedOutcomeHistory(
  yesHistory: DataPoint[],
  noHistory: DataPoint[],
  conditionId: string,
  yesKey: string,
  noKey: string,
) {
  if (!conditionId) {
    return { points: [], latestSnapshot: {} as Record<string, number> }
  }

  const yesByTimestamp = new Map<number, number>()
  const noByTimestamp = new Map<number, number>()

  yesHistory.forEach((point) => {
    const value = point[conditionId]
    if (typeof value === 'number' && Number.isFinite(value)) {
      yesByTimestamp.set(point.date.getTime(), value)
    }
  })

  noHistory.forEach((point) => {
    const value = point[conditionId]
    if (typeof value === 'number' && Number.isFinite(value)) {
      noByTimestamp.set(point.date.getTime(), value)
    }
  })

  const timestamps = Array.from(new Set([
    ...yesByTimestamp.keys(),
    ...noByTimestamp.keys(),
  ])).sort((a, b) => a - b)

  let lastYes: number | null = null
  let lastNo: number | null = null
  const points: DataPoint[] = []

  timestamps.forEach((timestamp) => {
    const yesValue = yesByTimestamp.get(timestamp)
    const noValue = noByTimestamp.get(timestamp)
    if (typeof yesValue === 'number') {
      lastYes = yesValue
    }
    if (typeof noValue === 'number') {
      lastNo = noValue
    }
    if (lastYes === null && lastNo === null) {
      return
    }
    const point: DataPoint = { date: new Date(timestamp) }
    if (lastYes !== null) {
      point[yesKey] = lastYes
    }
    if (lastNo !== null) {
      point[noKey] = lastNo
    }
    points.push(point)
  })

  const latestSnapshot: Record<string, number> = {}
  const latestPoint = points[points.length - 1]
  if (latestPoint) {
    const yesValue = latestPoint[yesKey]
    const noValue = latestPoint[noKey]
    if (typeof yesValue === 'number' && Number.isFinite(yesValue)) {
      latestSnapshot[yesKey] = yesValue
    }
    if (typeof noValue === 'number' && Number.isFinite(noValue)) {
      latestSnapshot[noKey] = noValue
    }
  }

  return { points, latestSnapshot }
}

function EventChartComponent({
  event,
  isMobile,
  seriesEvents = [],
  showControls = true,
  showSeriesNavigation = true,
}: EventChartProps) {
  const site = useSiteIdentity()
  const isSingleMarket = useIsSingleMarket()
  const isNegRiskEnabled = Boolean(event.enable_neg_risk || event.neg_risk)
  const shouldHideChart = !isSingleMarket && !isNegRiskEnabled
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
  const [chartSettings, setChartSettings] = useState(() => ({ ...defaultChartSettings }))
  const [hasLoadedSettings, setHasLoadedSettings] = useState(false)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [embedDialogOpen, setEmbedDialogOpen] = useState(false)
  const tradeFlowIdRef = useRef(0)
  const lastEventIdRef = useRef(event.id)

  useEffect(() => {
    setCursorSnapshot(null)
  }, [activeTimeRange, event.slug, activeOutcomeIndex, chartSettings.bothOutcomes])

  useEffect(() => {
    setChartSettings(loadStoredChartSettings())
    setHasLoadedSettings(true)
  }, [])

  useEffect(() => {
    if (!hasLoadedSettings) {
      return
    }
    storeChartSettings(chartSettings)
  }, [chartSettings, hasLoadedSettings])

  const showBothOutcomes = isSingleMarket && chartSettings.bothOutcomes

  const yesMarketTargets = useMemo(
    () => buildMarketTargets(event.markets, OUTCOME_INDEX.YES),
    [event.markets],
  )
  const noMarketTargets = useMemo(
    () => (shouldHideChart || !isSingleMarket ? [] : buildMarketTargets(event.markets, OUTCOME_INDEX.NO)),
    [event.markets, isSingleMarket, shouldHideChart],
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
        midpoint: quote?.mid ?? null,
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
  const marketSnapshot = showBothOutcomes ? yesPriceHistory.latestSnapshot : chartHistory.latestSnapshot

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

  const maxSeriesCount = getMaxSeriesCount()
  const allMarketIds = useMemo(
    () => event.markets
      .map(market => market.condition_id)
      .filter((conditionId): conditionId is string => Boolean(conditionId)),
    [event.markets],
  )
  const topMarketIds = useMemo(
    () => getTopMarketIds(marketSnapshot, maxSeriesCount),
    [marketSnapshot, maxSeriesCount],
  )
  const fallbackMarketIds = useMemo(
    () => allMarketIds.slice(0, maxSeriesCount),
    [allMarketIds, maxSeriesCount],
  )
  const defaultMarketIds = useMemo(
    () => (topMarketIds.length > 0 ? topMarketIds : fallbackMarketIds),
    [topMarketIds, fallbackMarketIds],
  )
  const [selectedMarketIds, setSelectedMarketIds] = useState<string[]>(() => defaultMarketIds)
  const [hasCustomSelection, setHasCustomSelection] = useState(false)

  useEffect(() => {
    if (lastEventIdRef.current === event.id) {
      return
    }

    lastEventIdRef.current = event.id
    setHasCustomSelection(false)
    if (!isSingleMarket) {
      setSelectedMarketIds(defaultMarketIds)
    }
  }, [defaultMarketIds, event.id, isSingleMarket])

  useEffect(() => {
    if (isSingleMarket || hasCustomSelection) {
      return
    }
    setSelectedMarketIds(defaultMarketIds)
  }, [defaultMarketIds, hasCustomSelection, isSingleMarket])

  useEffect(() => {
    if (isSingleMarket) {
      return
    }
    setSelectedMarketIds((prev) => {
      const filtered = prev.filter(id => allMarketIds.includes(id))
      if (filtered.length > 0) {
        return filtered
      }
      return defaultMarketIds
    })
  }, [allMarketIds, defaultMarketIds, isSingleMarket])

  const handleToggleMarket = useCallback((marketId: string) => {
    if (isSingleMarket) {
      return
    }

    setHasCustomSelection(true)
    setSelectedMarketIds((prev) => {
      const isSelected = prev.includes(marketId)
      if (isSelected) {
        const next = prev.filter(id => id !== marketId)
        return next.length > 0 ? next : prev
      }
      if (prev.length >= maxSeriesCount) {
        return prev
      }
      const nextSet = new Set(prev)
      nextSet.add(marketId)
      return allMarketIds.filter(id => nextSet.has(id)).slice(0, maxSeriesCount)
    })
  }, [allMarketIds, isSingleMarket, maxSeriesCount])

  const chartSeries = useMemo(
    () => buildChartSeries(event, topMarketIds),
    [event, topMarketIds],
  )
  const fallbackChartSeries = useMemo(
    () => buildChartSeries(event, fallbackMarketIds),
    [event, fallbackMarketIds],
  )
  const allSeries = useMemo(
    () => buildChartSeries(event, allMarketIds),
    [event, allMarketIds],
  )
  const selectedSeries = useMemo(
    () => buildChartSeries(event, selectedMarketIds),
    [event, selectedMarketIds],
  )
  const selectedColors = useMemo(
    () => Object.fromEntries(selectedSeries.map(series => [series.key, series.color])),
    [selectedSeries],
  )
  const marketOptions = useMemo(
    () => allSeries.map(series => ({
      ...series,
      color: selectedColors[series.key] ?? '#374151',
    })),
    [allSeries, selectedColors],
  )

  const baseSeries = useMemo(() => {
    if (!isSingleMarket) {
      if (selectedSeries.length > 0) {
        return selectedSeries
      }
      return chartSeries.length > 0 ? chartSeries : fallbackChartSeries
    }
    return chartSeries.length > 0 ? chartSeries : fallbackChartSeries
  }, [chartSeries, fallbackChartSeries, isSingleMarket, selectedSeries])

  const primaryMarket = useMemo(
    () => {
      if (isSingleMarket) {
        return event.markets[0]
      }
      const primaryId = baseSeries[0]?.key
      return (primaryId
        ? event.markets.find(market => market.condition_id === primaryId)
        : null) ?? event.markets[0]
    },
    [event.markets, baseSeries, isSingleMarket],
  )

  const primaryConditionId = primaryMarket?.condition_id ?? ''
  const yesSeriesKey = showBothOutcomes && primaryConditionId
    ? `${primaryConditionId}-yes`
    : primaryConditionId
  const noSeriesKey = showBothOutcomes && primaryConditionId
    ? `${primaryConditionId}-no`
    : primaryConditionId
  const yesOutcomeLabel = getOutcomeLabelForMarket(primaryMarket, OUTCOME_INDEX.YES)
  const noOutcomeLabel = getOutcomeLabelForMarket(primaryMarket, OUTCOME_INDEX.NO)
  const bothOutcomeSeries = useMemo(
    () => {
      if (!showBothOutcomes || !primaryConditionId) {
        return []
      }
      return [
        { key: yesSeriesKey, name: yesOutcomeLabel, color: 'var(--primary)' },
        { key: noSeriesKey, name: noOutcomeLabel, color: '#FF6600' },
      ]
    },
    [showBothOutcomes, primaryConditionId, yesSeriesKey, noSeriesKey, yesOutcomeLabel, noOutcomeLabel],
  )

  const effectiveSeries = useMemo(() => {
    if (showBothOutcomes) {
      return bothOutcomeSeries
    }
    if (!isSingleMarket || baseSeries.length === 0) {
      return baseSeries
    }
    const primaryColor = activeOutcomeIndex === OUTCOME_INDEX.NO ? '#FF6600' : 'var(--primary)'
    return baseSeries.map((seriesItem, index) => (index === 0
      ? { ...seriesItem, color: primaryColor }
      : seriesItem))
  }, [activeOutcomeIndex, baseSeries, isSingleMarket, showBothOutcomes, bothOutcomeSeries])

  const watermark = useMemo(
    () => ({
      iconSvg: site.logoSvg,
      iconImageUrl: site.logoImageUrl,
      label: site.name,
    }),
    [site.logoImageUrl, site.logoSvg, site.name],
  )
  const chartLogo = (watermark.iconSvg || watermark.label)
    ? (
        <div className="flex items-center gap-1 text-xl text-muted-foreground opacity-50 select-none">
          {watermark.iconSvg
            ? (
                <SiteLogoIcon
                  logoSvg={watermark.iconSvg}
                  logoImageUrl={watermark.iconImageUrl}
                  alt={`${watermark.label} logo`}
                  className="size-[1em] **:fill-current **:stroke-current"
                  imageClassName="size-[1em] object-contain"
                  size={20}
                />
              )
            : null}
          {watermark.label
            ? (
                <span className="font-semibold">
                  {watermark.label}
                </span>
              )
            : null}
        </div>
      )
    : null

  const legendSeries = effectiveSeries
  const hasLegendSeries = legendSeries.length > 0
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

  const bothOutcomeHistory = useMemo(() => {
    if (!showBothOutcomes || !primaryConditionId) {
      return { points: [] as DataPoint[], latestSnapshot: {} as Record<string, number> }
    }
    return buildCombinedOutcomeHistory(
      yesPriceHistory.normalizedHistory,
      noPriceHistory.normalizedHistory,
      primaryConditionId,
      yesSeriesKey,
      noSeriesKey,
    )
  }, [
    showBothOutcomes,
    primaryConditionId,
    yesSeriesKey,
    noSeriesKey,
    yesPriceHistory.normalizedHistory,
    noPriceHistory.normalizedHistory,
  ])

  const normalizedHistory = showBothOutcomes
    ? bothOutcomeHistory.points
    : chartHistory.normalizedHistory
  const latestSnapshot = showBothOutcomes
    ? bothOutcomeHistory.latestSnapshot
    : chartHistory.latestSnapshot

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
      const snapshotValue = showBothOutcomes
        ? latestSnapshot[seriesItem.key]
        : (currentOutcomeChances[seriesItem.key] ?? latestSnapshot[seriesItem.key])
      const value = typeof hoveredValue === 'number' && Number.isFinite(hoveredValue)
        ? hoveredValue
        : (Number.isFinite(snapshotValue)
            ? snapshotValue
            : null)
      return { ...seriesItem, value }
    }),
    [legendSeries, cursorSnapshot, currentOutcomeChances, latestSnapshot, showBothOutcomes],
  )

  const activeSeriesKey = showBothOutcomes
    ? (activeOutcomeIndex === OUTCOME_INDEX.NO ? noSeriesKey : yesSeriesKey)
    : legendSeries[0]?.key
  const primarySeriesColor = showBothOutcomes
    ? (activeOutcomeIndex === OUTCOME_INDEX.NO ? '#FF6600' : 'var(--primary)')
    : (legendSeries[0]?.color ?? 'currentColor')
  const hoveredActiveChance = activeSeriesKey
    ? cursorSnapshot?.values?.[activeSeriesKey]
    : null
  const primaryMarketKey = primaryConditionId || legendSeries[0]?.key
  const storedYesChance = primaryMarketKey
    ? currentOutcomeChances[primaryMarketKey]
    : null
  const latestYesChance = primaryMarketKey
    ? yesPriceHistory.latestSnapshot[primaryMarketKey]
    : null
  const baseYesChance = typeof storedYesChance === 'number' && Number.isFinite(storedYesChance)
    ? storedYesChance
    : (typeof latestYesChance === 'number' && Number.isFinite(latestYesChance)
        ? latestYesChance
        : null)
  const derivedActiveChance = typeof baseYesChance === 'number'
    ? (activeOutcomeIndex === OUTCOME_INDEX.NO
        ? Math.max(0, Math.min(100, 100 - baseYesChance))
        : baseYesChance)
    : null
  const snapshotActiveChance = showBothOutcomes && activeSeriesKey
    ? (typeof latestSnapshot[activeSeriesKey] === 'number' ? latestSnapshot[activeSeriesKey] : null)
    : null
  const baseActiveChance = snapshotActiveChance ?? derivedActiveChance
  const resolvedActiveChance = typeof hoveredActiveChance === 'number' && Number.isFinite(hoveredActiveChance)
    ? hoveredActiveChance
    : (typeof baseActiveChance === 'number' && Number.isFinite(baseActiveChance)
        ? baseActiveChance
        : null)
  const yesChanceValue = typeof resolvedActiveChance === 'number' ? resolvedActiveChance : null
  const legendEntriesWithValues = useMemo(
    () => legendEntries.filter(entry => typeof entry.value === 'number' && Number.isFinite(entry.value)),
    [legendEntries],
  )
  const shouldRenderLegendEntries = chartSeries.length > 0 && legendEntriesWithValues.length > 0
  const cursorActiveChance = typeof hoveredActiveChance === 'number' && Number.isFinite(hoveredActiveChance)
    ? hoveredActiveChance
    : null
  const defaultBaselineYesChance = useMemo(() => {
    if (!activeSeriesKey) {
      return null
    }
    for (const point of chartData) {
      const value = point[activeSeriesKey]
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value
      }
    }
    return null
  }, [chartData, activeSeriesKey])
  const defaultCurrentYesChance = useMemo(() => {
    if (!activeSeriesKey) {
      return null
    }
    for (let index = chartData.length - 1; index >= 0; index -= 1) {
      const value = chartData[index]?.[activeSeriesKey]
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value
      }
    }
    return null
  }, [chartData, activeSeriesKey])
  const isHovering = cursorSnapshot !== null
    && cursorActiveChance !== null
    && Number.isFinite(cursorActiveChance)
  const effectiveBaselineYesChance = defaultBaselineYesChance
  const effectiveCurrentYesChance = isHovering
    ? cursorActiveChance
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
                <span className="inline-flex w-fit items-center gap-2 text-xs font-medium text-muted-foreground">
                  <span>{entry.name}</span>
                  <span className={`
                    inline-flex min-w-8 shrink-0 items-baseline justify-end text-sm font-semibold text-foreground
                    tabular-nums
                  `}
                  >
                    {resolvedValue.toFixed(0)}
                    <span className="ml-0.5 text-sm text-foreground">%</span>
                  </span>
                </span>
              </div>
            )
          })}
        </div>
      )
    : null

  if (shouldHideChart) {
    return (
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <EventMetaInformation event={event} />
        {chartLogo}
      </div>
    )
  }

  if (!hasLegendSeries) {
    return null
  }
  return (
    <>
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
            currentEventSlug={event.slug}
            seriesEvents={seriesEvents}
            showSeriesNavigation={showSeriesNavigation}
          />
        )}
        chart={(
          <div className="relative">
            <PredictionChart
              data={chartData}
              series={legendSeries}
              width={chartWidth}
              height={332}
              margin={{ top: 30, right: 40, bottom: 52, left: 0 }}
              dataSignature={chartSignature}
              onCursorDataChange={setCursorSnapshot}
              xAxisTickCount={isMobile ? 2 : 4}
              autoscale={chartSettings.autoscale}
              showXAxis={chartSettings.xAxis}
              showYAxis={chartSettings.yAxis}
              showHorizontalGrid={chartSettings.horizontalGrid}
              showVerticalGrid={chartSettings.verticalGrid}
              showAnnotations={chartSettings.annotations}
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
                        className={cn(`${item.outcome === 'yes' ? 'text-yes' : 'text-no'} animate-trade-flow-rise`)}
                        style={tradeFlowTextStrokeStyle}
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
        controls={showControls
          ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <EventMetaInformation event={event} />
                {hasChartData
                  ? (
                      <EventChartControls
                        timeRanges={TIME_RANGES}
                        activeTimeRange={activeTimeRange}
                        onTimeRangeChange={setActiveTimeRange}
                        showOutcomeSwitch={isSingleMarket}
                        oppositeOutcomeLabel={oppositeOutcomeLabel}
                        onShuffle={() => {
                          setActiveOutcomeIndex(oppositeOutcomeIndex)
                          setCursorSnapshot(null)
                        }}
                        showMarketSelector={!isSingleMarket}
                        marketOptions={marketOptions}
                        selectedMarketIds={selectedMarketIds}
                        maxSeriesCount={maxSeriesCount}
                        onToggleMarket={handleToggleMarket}
                        settings={chartSettings}
                        onSettingsChange={setChartSettings}
                        onExportData={() => setExportDialogOpen(true)}
                        onEmbed={() => setEmbedDialogOpen(true)}
                      />
                    )
                  : null}
              </div>
            )
          : undefined}
      />
      <EventChartExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        eventCreatedAt={event.created_at}
        markets={event.markets}
        isMultiMarket={event.total_markets_count > 1}
      />
      <EventChartEmbedDialog
        open={embedDialogOpen}
        onOpenChange={setEmbedDialogOpen}
        markets={event.markets}
        initialMarketId={primaryMarket?.condition_id ?? null}
      />
    </>
  )
}

function areChartPropsEqual(prev: EventChartProps, next: EventChartProps) {
  if (prev.isMobile !== next.isMobile) {
    return false
  }
  if ((prev.showControls ?? true) !== (next.showControls ?? true)) {
    return false
  }
  if ((prev.showSeriesNavigation ?? true) !== (next.showSeriesNavigation ?? true)) {
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
