'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { Event, EventLiveChartConfig, EventSeriesEntry } from '@/types'
import type { DataPoint, PredictionChartProps, SeriesConfig } from '@/types/PredictionChartTypes'

import { useSiteIdentity } from '@/hooks/useSiteIdentity'
import { useWindowSize } from '@/hooks/useWindowSize'
import { resolveEventPagePath } from '@/lib/events-routing'

import { useLiveSeriesClock } from '../_hooks/useLiveSeriesClock'
import { useLiveSeriesPriceSnapshot } from '../_hooks/useLiveSeriesPriceSnapshot'
import { useLiveSeriesWebSocket } from '../_hooks/useLiveSeriesWebSocket'
import {
  classifyLiveSeriesReference,
  findLiveSeriesEvent,
  formatDateAtTimezone,
  formatTimeAtTimezone,
  formatUsd,
  getVisibleCountdownUnits,
  hexToRgba,
  inferIntervalMsFromSeriesSlug,
  isCanonicalBinanceDailySnapshot,
  isShortLiveSeriesCadence,
  isUsEquityMarketOpen,
  LIVE_CHART_HEIGHT,
  LIVE_CHART_MARGIN_BOTTOM,
  LIVE_CHART_MARGIN_LEFT,
  LIVE_CHART_MARGIN_RIGHT,
  LIVE_CHART_MARGIN_TOP,
  LIVE_CURRENT_MARKER_OFFSET_X,
  LIVE_CURSOR_GUIDE_TOP,
  LIVE_PLOT_CLIP_RIGHT_PADDING,
  LIVE_TARGET_MAX_BOTTOM_OFFSET,
  LIVE_WINDOW_MS,
  LIVE_X_AXIS_LEFT_LABEL_GUARD_MS,
  LIVE_X_AXIS_STEP_MS,
  MAX_POINTS,
  normalizeLiveChartPrice,
  normalizeSubscriptionSymbol,
  parseUtcDate,
  requiresCanonicalBinanceDailyClose,
  resolveDisplayedLiveSeriesBaselinePrice,
  resolveEventEndTimestamp,
  resolveLiveSeriesCountdown,
  resolveLiveSeriesDisplayPrice,
  resolveLiveSeriesRealtimeTopic,
  SERIES_KEY,
  toCountdownLeftLabel,
} from '../_utils/eventLiveSeriesChartUtils'
import {
  resolveLiveSeriesAxisPriceDigits,
  resolveLiveSeriesDeltaDisplayDigits,
  resolveLiveSeriesPriceDisplayDigits,
} from '../_utils/liveSeriesPricePrecision'
import EventChart from './EventChart'
import EventLiveSeriesChartHeader from './EventLiveSeriesChartHeader'
import EventLiveSeriesChartOverlay from './EventLiveSeriesChartOverlay'
import EventLiveSeriesViewSwitch from './EventLiveSeriesViewSwitch'
import EventSeriesPills from './EventSeriesPills'

interface LiveChartAxis {
  min: number
  max: number
  ticks: number[]
  step: number
}

const LIVE_AXIS_RESPONSE_MS = 1_250
const LIVE_AXIS_EXTRA_PADDING_RATIO = 0.16
const LIVE_AXIS_PRICE_FOLLOW_RATIO = 0.18
const LIVE_AXIS_SETTLE_RATIO = 0.000_05
const LIVE_AXIS_TARGET_TICK_INTERVALS = 3
const LIVE_AXIS_MIN_TICK_INTERVALS = 1.6
const LIVE_AXIS_MAX_TICK_INTERVALS = 5.5

function resolveNiceLiveAxisStep(rawStep: number, minimumStep: number) {
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(rawStep, minimumStep)))
  const normalized = rawStep / magnitude
  const multiplier = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10
  return Math.max(minimumStep, multiplier * magnitude)
}

function buildLiveAxisTicks(min: number, max: number, step: number, fractionDigits: number) {
  const firstTick = Math.ceil(min / step) * step
  const ticks: number[] = []

  for (let value = firstTick; value <= max + step * 1e-6; value += step) {
    ticks.push(Number(value.toFixed(Math.max(0, fractionDigits))))
  }

  return ticks
}

function buildContinuousLiveAxis(values: number[], currentPrice: number | null, fractionDigits: number): LiveChartAxis {
  const minimumStep = 1 / 10 ** Math.max(0, Math.min(6, Math.floor(fractionDigits)))
  const finiteValues = values.filter((value) => Number.isFinite(value))
  if (!finiteValues.length) {
    return { min: 0, max: 1, ticks: [0, 1], step: 1 }
  }

  const visibleMin = Math.min(...finiteValues)
  const visibleMax = Math.max(...finiteValues)
  const visibleMidpoint = (visibleMin + visibleMax) / 2
  const minimumSpan = Math.max(Math.abs(visibleMidpoint) * 0.000_02, minimumStep * 2)
  const visibleSpan = Math.max(minimumSpan, visibleMax - visibleMin)
  const resolvedCurrentPrice = currentPrice != null && Number.isFinite(currentPrice) ? currentPrice : visibleMidpoint
  const followedCenter = visibleMidpoint + (resolvedCurrentPrice - visibleMidpoint) * LIVE_AXIS_PRICE_FOLLOW_RATIO
  const minimumHalfSpan = visibleSpan * (0.5 + LIVE_AXIS_EXTRA_PADDING_RATIO)
  const halfSpan = Math.max(
    minimumHalfSpan,
    Math.abs(visibleMin - followedCenter) * 1.12,
    Math.abs(visibleMax - followedCenter) * 1.12,
  )
  const min = followedCenter - halfSpan
  const max = followedCenter + halfSpan
  const tickStep = resolveNiceLiveAxisStep((max - min) / LIVE_AXIS_TARGET_TICK_INTERVALS, minimumStep)

  return {
    min,
    max,
    ticks: buildLiveAxisTicks(min, max, tickStep, fractionDigits),
    step: tickStep,
  }
}

function useStableLiveChartAxis(candidate: LiveChartAxis, scopeKey: string, fractionDigits: number) {
  const [state, setState] = useState<{ scopeKey: string; axis: LiveChartAxis }>(() => ({
    scopeKey,
    axis: candidate,
  }))
  const currentRef = useRef({ scopeKey, axis: candidate })
  const targetRef = useRef({ scopeKey, axis: candidate })
  const animationFrameRef = useRef<number | null>(null)
  const lastFrameTimestampRef = useRef<number | null>(null)
  const displayedAxis = state.scopeKey === scopeKey ? state.axis : candidate
  const candidateKey = `${candidate.min}:${candidate.max}:${candidate.step}`

  const startAxisAnimation = useCallback(
    function startAxisAnimation() {
      if (animationFrameRef.current != null) {
        return
      }

      function animate(timestamp: number) {
        const current = currentRef.current.axis
        const target = targetRef.current.axis
        const previousTimestamp = lastFrameTimestampRef.current ?? timestamp
        const elapsedMs = Math.min(64, Math.max(0, timestamp - previousTimestamp))
        lastFrameTimestampRef.current = timestamp
        const progress = 1 - Math.exp(-elapsedMs / LIVE_AXIS_RESPONSE_MS)
        const nextAxis = {
          min: current.min + (target.min - current.min) * progress,
          max: current.max + (target.max - current.max) * progress,
          ticks: [] as number[],
          step: target.step,
        }
        nextAxis.ticks = buildLiveAxisTicks(nextAxis.min, nextAxis.max, nextAxis.step, fractionDigits)
        const targetSpan = Math.max(Number.EPSILON, target.max - target.min)
        const remainingDistance = Math.max(Math.abs(nextAxis.min - target.min), Math.abs(nextAxis.max - target.max))

        if (remainingDistance <= targetSpan * LIVE_AXIS_SETTLE_RATIO) {
          currentRef.current = { scopeKey, axis: target }
          setState({ scopeKey, axis: target })
          animationFrameRef.current = null
          lastFrameTimestampRef.current = null
          return
        }

        currentRef.current = { scopeKey, axis: nextAxis }
        setState({ scopeKey, axis: nextAxis })
        animationFrameRef.current = requestAnimationFrame(animate)
      }

      animationFrameRef.current = requestAnimationFrame(animate)
    },
    [fractionDigits, scopeKey],
  )

  useEffect(() => {
    if (currentRef.current.scopeKey !== scopeKey) {
      currentRef.current = { scopeKey, axis: candidate }
      targetRef.current = { scopeKey, axis: candidate }
      const timer = setTimeout(() => setState({ scopeKey, axis: candidate }), 0)
      return () => clearTimeout(timer)
    }

    const previousStep = targetRef.current.axis.step
    const candidateSpan = Math.max(Number.EPSILON, candidate.max - candidate.min)
    const intervalsAtPreviousStep = candidateSpan / previousStep
    const step =
      intervalsAtPreviousStep < LIVE_AXIS_MIN_TICK_INTERVALS || intervalsAtPreviousStep > LIVE_AXIS_MAX_TICK_INTERVALS
        ? candidate.step
        : previousStep
    const stabilizedCandidate = {
      ...candidate,
      step,
      ticks: buildLiveAxisTicks(candidate.min, candidate.max, step, fractionDigits),
    }

    targetRef.current = { scopeKey, axis: stabilizedCandidate }
    // oxlint-disable-next-line react-you-might-not-need-an-effect/no-external-store-subscription -- Starts a local SVG-axis animation; it does not subscribe to an external store.
    startAxisAnimation()
    return undefined
  }, [candidate, candidateKey, fractionDigits, scopeKey, startAxisAnimation])

  useEffect(() => {
    return () => {
      if (animationFrameRef.current != null) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  return displayedAxis
}

const PredictionChart = dynamic<PredictionChartProps>(() => import('@/components/PredictionChart'), {
  ssr: false,
  loading: () => <div className="h-83 w-full" />,
})

function isFinitePositivePrice(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function normalizeReferencePrice(value: unknown, topic: string) {
  const numeric = typeof value === 'number' ? value : Number(value)
  return normalizeLiveChartPrice(numeric, topic)
}

function resolveTimestampBoundedPrice({
  value,
  topic,
  timestamp,
  endTimestamp,
}: {
  value: unknown
  topic: string
  timestamp: unknown
  endTimestamp: number
}) {
  const numericTimestamp = typeof timestamp === 'number' ? timestamp : Number(timestamp)
  if (!Number.isFinite(numericTimestamp) || numericTimestamp > endTimestamp) {
    return null
  }

  return normalizeReferencePrice(value, topic)
}

function buildClosedLiveSeriesData(endTimestamp: number, finalPrice: number | null) {
  if (!isFinitePositivePrice(finalPrice) || !Number.isFinite(endTimestamp)) {
    return []
  }

  return [
    {
      date: new Date(Math.max(0, endTimestamp - LIVE_WINDOW_MS)),
      [SERIES_KEY]: finalPrice,
    },
    {
      date: new Date(endTimestamp),
      [SERIES_KEY]: finalPrice,
    },
  ] satisfies DataPoint[]
}

interface EventLiveSeriesChartProps {
  event: Event
  isMobile: boolean
  seriesEvents?: EventSeriesEntry[]
  config: EventLiveChartConfig
  chartWidth?: number
  chartHeightOffset?: number
  showSeriesControls?: boolean
}

export default function EventLiveSeriesChart({
  event,
  isMobile,
  seriesEvents = [],
  config,
  chartWidth,
  chartHeightOffset = 0,
  showSeriesControls = true,
}: EventLiveSeriesChartProps) {
  const subscriptionSymbol = useMemo(
    () => normalizeSubscriptionSymbol(config.topic, config.symbol),
    [config.symbol, config.topic],
  )
  const resetKey = `${event.id}:${config.topic}:${config.event_type}:${subscriptionSymbol}`

  return (
    <EventLiveSeriesChartContent
      key={resetKey}
      event={event}
      isMobile={isMobile}
      seriesEvents={seriesEvents}
      config={config}
      subscriptionSymbol={subscriptionSymbol}
      chartWidth={chartWidth}
      chartHeightOffset={chartHeightOffset}
      showSeriesControls={showSeriesControls}
    />
  )
}

interface EventLiveSeriesChartContentProps {
  event: Event
  isMobile: boolean
  seriesEvents: EventSeriesEntry[]
  config: EventLiveChartConfig
  subscriptionSymbol: string
  chartWidth?: number
  chartHeightOffset: number
  showSeriesControls: boolean
}

function EventLiveSeriesChartContent({
  event,
  isMobile,
  seriesEvents,
  config,
  subscriptionSymbol,
  chartWidth: providedChartWidth,
  chartHeightOffset,
  showSeriesControls,
}: EventLiveSeriesChartContentProps) {
  const site = useSiteIdentity()
  const { width: windowWidth } = useWindowSize()
  const liveColor = config.line_color || '#F59E0B'
  const chartHeight = Math.max(260, LIVE_CHART_HEIGHT - Math.max(0, chartHeightOffset))
  const [activeView, setActiveView] = useState<'live' | 'market'>('live')
  const isLiveView = activeView === 'live'
  const startTimestamp = useMemo(() => parseUtcDate(event.start_date ?? null), [event.start_date])
  const explicitEndTimestamp = useMemo(() => resolveEventEndTimestamp(event), [event])
  const scheduledEndTimestamp = useMemo(() => {
    const timestamps = [
      parseUtcDate(event.end_date ?? null),
      ...event.markets.map((market) => parseUtcDate(market.end_time ?? null)),
    ].filter((timestamp): timestamp is number => timestamp != null)
    return timestamps.length > 0 ? Math.max(...timestamps) : explicitEndTimestamp
  }, [event.end_date, event.markets, explicitEndTimestamp])
  const realtimeTopic = useMemo(
    () =>
      resolveLiveSeriesRealtimeTopic({
        configuredTopic: config.topic,
        activeWindowMinutes: config.active_window_minutes,
        eventStartTimestamp: startTimestamp,
        eventEndTimestamp: scheduledEndTimestamp,
      }),
    [config.active_window_minutes, config.topic, scheduledEndTimestamp, startTimestamp],
  )
  const realtimeConfig = useMemo(
    () => (realtimeTopic === config.topic ? config : { ...config, topic: realtimeTopic }),
    [config, realtimeTopic],
  )
  const hasExplicitEndTimestamp = explicitEndTimestamp != null
  const resolvedMarketsCount = event.markets.filter((market) => market.is_resolved || market.condition?.resolved).length
  const hasResolvedState = Boolean(
    event.resolved_at ||
    event.status === 'resolved' ||
    event.status === 'archived' ||
    (resolvedMarketsCount > 0 && (event.total_markets_count <= 1 || resolvedMarketsCount === event.markets.length)),
  )

  const nowMs = useLiveSeriesClock(isLiveView)
  const endTimestamp = explicitEndTimestamp ?? nowMs

  const {
    referenceSnapshot,
    referenceSnapshotStatus,
    persistedFallbackPrice: snapshotFallbackPrice,
  } = useLiveSeriesPriceSnapshot({
    config: realtimeConfig,
    subscriptionSymbol,
    explicitEndTimestamp,
    startTimestamp,
  })
  const isEventClosed =
    hasExplicitEndTimestamp &&
    (hasResolvedState || Boolean(referenceSnapshot?.is_event_closed) || nowMs >= endTimestamp)
  const chartNowMs = isEventClosed ? endTimestamp : nowMs

  const persistedFallbackPrice = snapshotFallbackPrice
  const seriesReferenceClassification = useMemo(
    () =>
      classifyLiveSeriesReference({
        topic: realtimeTopic,
        activeWindowMinutes: config.active_window_minutes,
      }),
    [config.active_window_minutes, realtimeTopic],
  )

  const { data, status } = useLiveSeriesWebSocket({
    topic: realtimeTopic,
    eventType: config.event_type,
    eventEndTimestamp: explicitEndTimestamp,
    subscriptionSymbol,
    isLiveView: isLiveView && !isEventClosed,
  })

  const isMarketClosed = useMemo(() => {
    if (realtimeTopic.trim().toLowerCase() !== 'equity_prices') {
      return false
    }
    return !isUsEquityMarketOpen(nowMs)
  }, [nowMs, realtimeTopic])

  const series = useMemo<SeriesConfig[]>(
    () => [
      {
        key: SERIES_KEY,
        name: config.display_symbol || config.display_name,
        color: liveColor,
      },
    ],
    [config.display_name, config.display_symbol, liveColor],
  )

  const fallbackChartWidth = useMemo(() => {
    if (!windowWidth) {
      return 900
    }
    if (isMobile) {
      return Math.max(320, windowWidth * 0.84)
    }
    return Math.min(windowWidth * 0.55, 900)
  }, [isMobile, windowWidth])
  const chartWidth =
    typeof providedChartWidth === 'number' && Number.isFinite(providedChartWidth) && providedChartWidth > 0
      ? Math.max(1, Math.round(providedChartWidth))
      : fallbackChartWidth

  const referenceOpeningPrice = useMemo(
    () => normalizeReferencePrice(referenceSnapshot?.opening_price, realtimeTopic),
    [realtimeTopic, referenceSnapshot?.opening_price],
  )
  const referenceClosingPrice = useMemo(
    () => normalizeReferencePrice(referenceSnapshot?.closing_price, realtimeTopic),
    [realtimeTopic, referenceSnapshot?.closing_price],
  )
  const latestReferencePriceBeforeEnd = useMemo(
    () =>
      resolveTimestampBoundedPrice({
        value: referenceSnapshot?.latest_price,
        topic: realtimeTopic,
        timestamp: referenceSnapshot?.latest_source_timestamp_ms ?? referenceSnapshot?.latest_window_end_ms,
        endTimestamp,
      }),
    [
      realtimeTopic,
      endTimestamp,
      referenceSnapshot?.latest_price,
      referenceSnapshot?.latest_source_timestamp_ms,
      referenceSnapshot?.latest_window_end_ms,
    ],
  )
  const persistedFallbackPriceBeforeEnd = useMemo(() => {
    if (
      !persistedFallbackPrice ||
      !isFinitePositivePrice(persistedFallbackPrice.price) ||
      !Number.isFinite(persistedFallbackPrice.timestamp) ||
      persistedFallbackPrice.timestamp > endTimestamp
    ) {
      return null
    }

    return persistedFallbackPrice.price
  }, [endTimestamp, persistedFallbackPrice])
  const hasCanonicalBinanceDailySnapshot = isCanonicalBinanceDailySnapshot(referenceSnapshot)
  const requiresCanonicalBinanceClose = requiresCanonicalBinanceDailyClose({
    snapshot: referenceSnapshot,
    snapshotStatus: referenceSnapshotStatus,
    seriesClassification: seriesReferenceClassification,
  })
  const finalPrice = isEventClosed
    ? requiresCanonicalBinanceClose
      ? hasCanonicalBinanceDailySnapshot
        ? referenceClosingPrice
        : null
      : (referenceClosingPrice ?? latestReferencePriceBeforeEnd ?? persistedFallbackPriceBeforeEnd)
    : null

  const fallbackCurrentPrice = useMemo(() => {
    if (isEventClosed) {
      return finalPrice
    }

    if (referenceSnapshot) {
      const snapshotPrice = normalizeLiveChartPrice(
        referenceSnapshot.latest_price ?? referenceSnapshot.closing_price ?? Number.NaN,
        realtimeTopic,
      )

      if (typeof snapshotPrice === 'number' && Number.isFinite(snapshotPrice) && snapshotPrice > 0) {
        return snapshotPrice
      }
    }

    if (persistedFallbackPrice && Number.isFinite(persistedFallbackPrice.price) && persistedFallbackPrice.price > 0) {
      return persistedFallbackPrice.price
    }

    return null
  }, [finalPrice, isEventClosed, persistedFallbackPrice, realtimeTopic, referenceSnapshot])

  const tradingWindowMs = useMemo(() => {
    const configuredWindowMinutes = Number(config.active_window_minutes)
    if (Number.isFinite(configuredWindowMinutes) && configuredWindowMinutes > 0) {
      return configuredWindowMinutes * 60 * 1000
    }

    const fromSnapshot = Number(referenceSnapshot?.interval_ms)
    if (Number.isFinite(fromSnapshot) && fromSnapshot > 0) {
      return fromSnapshot
    }

    return inferIntervalMsFromSeriesSlug(config.series_slug)
  }, [config.active_window_minutes, config.series_slug, referenceSnapshot?.interval_ms])

  const tradingWindowStartMs = useMemo(() => {
    if (isShortLiveSeriesCadence(tradingWindowMs)) {
      return endTimestamp - tradingWindowMs
    }

    if (startTimestamp != null && startTimestamp > 0 && startTimestamp < endTimestamp) {
      return startTimestamp
    }

    const snapshotStart = Number(referenceSnapshot?.event_window_start_ms)
    if (Number.isFinite(snapshotStart) && snapshotStart > 0 && snapshotStart < endTimestamp) {
      return snapshotStart
    }

    return endTimestamp - tradingWindowMs
  }, [endTimestamp, referenceSnapshot?.event_window_start_ms, startTimestamp, tradingWindowMs])

  const isTradingWindowActive = !isEventClosed && nowMs >= tradingWindowStartMs
  const liveSeriesEvent = useMemo(
    () => findLiveSeriesEvent(seriesEvents, event.slug, nowMs, tradingWindowMs),
    [event.slug, nowMs, seriesEvents, tradingWindowMs],
  )
  const liveMarketHref = isEventClosed && liveSeriesEvent ? resolveEventPagePath(liveSeriesEvent) : null
  const closedFallbackData = useMemo(
    () => buildClosedLiveSeriesData(endTimestamp, finalPrice),
    [endTimestamp, finalPrice],
  )
  const dataSource = useMemo(() => {
    if (!isEventClosed) {
      return data
    }

    const preCloseData = data.filter((point) => {
      const timestamp = point.date.getTime()
      return Number.isFinite(timestamp) && timestamp <= endTimestamp
    })

    if (!preCloseData.length) {
      return closedFallbackData
    }

    if (!isFinitePositivePrice(finalPrice)) {
      return requiresCanonicalBinanceClose ? [] : preCloseData
    }

    return [
      ...preCloseData.filter((point) => point.date.getTime() < endTimestamp),
      {
        date: new Date(endTimestamp),
        [SERIES_KEY]: finalPrice,
      },
    ].slice(-MAX_POINTS)
  }, [closedFallbackData, data, endTimestamp, finalPrice, isEventClosed, requiresCanonicalBinanceClose])

  const renderData = useMemo(() => {
    if (!dataSource.length) {
      return dataSource
    }

    const domainStart = chartNowMs - LIVE_WINDOW_MS
    const domainEnd = chartNowMs
    let lastPointBeforeDomainStart: DataPoint | null = null
    const pointsWithinDomain: DataPoint[] = []

    for (const point of dataSource) {
      const timestamp = point.date.getTime()
      if (!Number.isFinite(timestamp)) {
        continue
      }

      if (timestamp < domainStart) {
        lastPointBeforeDomainStart = point
        continue
      }

      if (timestamp <= domainEnd) {
        pointsWithinDomain.push(point)
      }
    }

    let next = pointsWithinDomain
    if (lastPointBeforeDomainStart) {
      next =
        pointsWithinDomain.length > 0
          ? [lastPointBeforeDomainStart, ...pointsWithinDomain]
          : [lastPointBeforeDomainStart]
    } else if (pointsWithinDomain.length > 0) {
      const firstPoint = pointsWithinDomain[0]
      const firstPrice = firstPoint?.[SERIES_KEY]

      if (typeof firstPrice === 'number' && Number.isFinite(firstPrice)) {
        next = [
          {
            date: new Date(domainStart),
            [SERIES_KEY]: firstPrice,
          },
          ...pointsWithinDomain,
        ]
      }
    }

    const lastPoint = next.at(-1)
    const lastPrice = lastPoint?.[SERIES_KEY]
    const lastTimestamp = lastPoint?.date?.getTime?.() ?? Number.NaN

    if (
      typeof lastPrice === 'number' &&
      Number.isFinite(lastPrice) &&
      Number.isFinite(lastTimestamp) &&
      chartNowMs > lastTimestamp
    ) {
      next = [
        ...next,
        {
          date: new Date(chartNowMs),
          [SERIES_KEY]: lastPrice,
        },
      ].slice(-MAX_POINTS)
    }

    return next
  }, [chartNowMs, dataSource])

  const lastPoint = renderData.at(-1)
  const rawRenderedPrice = lastPoint?.[SERIES_KEY]
  const renderedPrice =
    typeof rawRenderedPrice === 'number' && Number.isFinite(rawRenderedPrice) ? rawRenderedPrice : null
  const currentPrice = resolveLiveSeriesDisplayPrice({
    isEventClosed,
    finalPrice,
    renderedPrice,
    fallbackCurrentPrice,
    requiresCanonicalClose: requiresCanonicalBinanceClose,
  })
  const resolvedBaselinePrice = referenceOpeningPrice
  const displayedBaselinePrice = resolveDisplayedLiveSeriesBaselinePrice({
    baselinePrice: resolvedBaselinePrice,
    isEventClosed,
    nowTimestamp: nowMs,
    tradingWindowStartTimestamp: tradingWindowStartMs,
    tradingWindowMs,
  })
  const precisionReferencePrice =
    currentPrice ??
    resolvedBaselinePrice ??
    referenceSnapshot?.latest_price ??
    referenceSnapshot?.closing_price ??
    referenceSnapshot?.opening_price ??
    persistedFallbackPrice?.price ??
    null
  const priceDisplayDigits = resolveLiveSeriesPriceDisplayDigits(
    realtimeTopic,
    config.show_price_decimals,
    precisionReferencePrice,
  )
  const axisPriceDisplayDigits = resolveLiveSeriesAxisPriceDigits(priceDisplayDigits, subscriptionSymbol)
  const headerPriceDisplayDigits = Math.max(2, priceDisplayDigits)
  const delta = currentPrice != null && displayedBaselinePrice != null ? currentPrice - displayedBaselinePrice : null
  const deltaDisplayDigits = resolveLiveSeriesDeltaDisplayDigits(priceDisplayDigits, delta)
  const axisFallbackPrice = renderData.length === 0 ? currentPrice : null
  const candidateAxisValues = useMemo(() => {
    const values = renderData
      .map((point) => point[SERIES_KEY])
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))

    if (!values.length && typeof axisFallbackPrice === 'number' && Number.isFinite(axisFallbackPrice)) {
      values.push(axisFallbackPrice)
    }

    return buildContinuousLiveAxis(values, currentPrice, axisPriceDisplayDigits)
  }, [axisFallbackPrice, axisPriceDisplayDigits, currentPrice, renderData])
  const axisInitializationPhase =
    dataSource.length > 1 ? 'history-ready' : dataSource.length === 1 ? 'first-point' : 'fallback'
  const axisValues = useStableLiveChartAxis(
    candidateAxisValues,
    `${event.id}:${realtimeTopic}:${subscriptionSymbol}:${axisInitializationPhase}`,
    axisPriceDisplayDigits,
  )

  const currentLineTop = (() => {
    if (currentPrice == null) {
      return null
    }
    const marginTop = LIVE_CHART_MARGIN_TOP
    const marginBottom = LIVE_CHART_MARGIN_BOTTOM
    const innerHeight = chartHeight - marginTop - marginBottom
    const ratio = (currentPrice - axisValues.min) / Math.max(1e-6, axisValues.max - axisValues.min)
    const clamped = Math.max(0, Math.min(1, ratio))
    return marginTop + innerHeight - innerHeight * clamped
  })()

  const targetLine = (() => {
    if (
      (!isTradingWindowActive && !isEventClosed) ||
      resolvedBaselinePrice == null ||
      !Number.isFinite(resolvedBaselinePrice)
    ) {
      return null
    }

    const marginTop = LIVE_CHART_MARGIN_TOP
    const marginBottom = LIVE_CHART_MARGIN_BOTTOM
    const innerHeight = chartHeight - marginTop - marginBottom
    const ratio = (resolvedBaselinePrice - axisValues.min) / Math.max(1e-6, axisValues.max - axisValues.min)
    const clamped = Math.max(0, Math.min(1, ratio))
    const lineTop = marginTop + innerHeight - innerHeight * clamped
    const maxTop = marginTop + innerHeight - LIVE_TARGET_MAX_BOTTOM_OFFSET

    return {
      badgeTop: Math.min(lineTop, maxTop),
      isAbove: ratio > 1,
      isBelow: ratio < 0,
    }
  })()

  const targetLineGuideColor = '#5D6878'
  const targetBadgeColor = '#5D6878'
  const currentPriceGuideColor = hexToRgba(liveColor, 0.62)

  const countdown = useMemo(() => resolveLiveSeriesCountdown(endTimestamp, nowMs), [endTimestamp, nowMs])

  const shouldShowCountdown = hasExplicitEndTimestamp && !isEventClosed && (nowMs <= 0 || countdown.totalSeconds > 0)

  const xAxisTickValues = useMemo(() => {
    const startMs = chartNowMs - LIVE_WINDOW_MS
    const visibleStartMs = startMs + LIVE_X_AXIS_LEFT_LABEL_GUARD_MS
    const firstTickMs = Math.ceil(startMs / LIVE_X_AXIS_STEP_MS) * LIVE_X_AXIS_STEP_MS
    const ticks: Date[] = []

    for (let tickMs = firstTickMs; tickMs <= chartNowMs; tickMs += LIVE_X_AXIS_STEP_MS) {
      if (tickMs >= visibleStartMs) {
        ticks.push(new Date(tickMs))
      }
    }

    if (ticks.length >= 2) {
      return ticks
    }

    return [new Date(visibleStartMs), new Date(chartNowMs)]
  }, [chartNowMs])

  const liveXAxisDomain = useMemo(
    () => ({
      start: new Date(chartNowMs - LIVE_WINDOW_MS),
      end: new Date(chartNowMs),
    }),
    [chartNowMs],
  )

  const visibleCountdownUnits = useMemo(
    () =>
      getVisibleCountdownUnits(
        countdown.showDays,
        countdown.days,
        countdown.hours,
        countdown.minutes,
        countdown.seconds,
      ),
    [countdown.showDays, countdown.days, countdown.hours, countdown.minutes, countdown.seconds],
  )

  const countdownLeftLabel = useMemo(
    () =>
      toCountdownLeftLabel(countdown.showDays, countdown.days, countdown.hours, countdown.minutes, countdown.seconds),
    [countdown.showDays, countdown.days, countdown.hours, countdown.minutes, countdown.seconds],
  )

  const etDateLabel = useMemo(() => formatDateAtTimezone(endTimestamp, 'America/New_York'), [endTimestamp])
  const etTimeLabel = useMemo(() => formatTimeAtTimezone(endTimestamp, 'America/New_York'), [endTimestamp])
  const utcDateLabel = useMemo(() => formatDateAtTimezone(endTimestamp, 'UTC'), [endTimestamp])
  const utcTimeLabel = useMemo(() => formatTimeAtTimezone(endTimestamp, 'UTC'), [endTimestamp])

  const watermark = useMemo(
    () => ({
      iconSvg: site.logoSvg,
      iconImageUrl: site.logoImageUrl,
      label: site.name,
    }),
    [site.logoImageUrl, site.logoSvg, site.name],
  )

  return (
    <div className="grid gap-4">
      <div className="min-h-96">
        {isLiveView ? (
          <div className="grid gap-1">
            <EventLiveSeriesChartHeader
              resolvedBaselinePrice={displayedBaselinePrice}
              headerPriceDisplayDigits={headerPriceDisplayDigits}
              currentPrice={currentPrice}
              delta={delta}
              deltaDisplayDigits={deltaDisplayDigits}
              liveColor={liveColor}
              shouldShowCountdown={shouldShowCountdown}
              isEventClosed={isEventClosed}
              liveMarketHref={liveMarketHref}
              isMobile={isMobile}
              isTradingWindowActive={isTradingWindowActive}
              visibleCountdownUnits={visibleCountdownUnits}
              countdownLeftLabel={countdownLeftLabel}
              etDateLabel={etDateLabel}
              etTimeLabel={etTimeLabel}
              utcDateLabel={utcDateLabel}
              utcTimeLabel={utcTimeLabel}
              status={status}
              watermark={watermark}
            />

            <div className="relative z-0">
              <EventLiveSeriesChartOverlay
                targetLine={targetLine}
                targetLineGuideColor={targetLineGuideColor}
                targetBadgeColor={targetBadgeColor}
                currentLineTop={currentLineTop}
                currentPriceGuideColor={currentPriceGuideColor}
              />
              <PredictionChart
                data={renderData}
                series={series}
                dataSyncMode="replace"
                width={chartWidth}
                height={chartHeight}
                margin={{
                  top: LIVE_CHART_MARGIN_TOP,
                  right: LIVE_CHART_MARGIN_RIGHT,
                  bottom: LIVE_CHART_MARGIN_BOTTOM,
                  left: LIVE_CHART_MARGIN_LEFT,
                }}
                dataSignature={`${event.id}:${realtimeTopic}:${subscriptionSymbol}`}
                xAxisTickCount={isMobile ? 2 : 4}
                xDomain={liveXAxisDomain}
                xAxisTickValues={xAxisTickValues}
                xAxisTickFormatter={(date) =>
                  date.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false,
                  })
                }
                showVerticalGrid={false}
                showHorizontalGrid
                gridLineStyle="solid"
                gridLineOpacity={0.42}
                showLegend={false}
                xAxisTickFontSize={11}
                yAxisTickFontSize={11}
                alignYAxisLabelsToChartEdge
                fadeYAxisEdges
                neutralAxisColors
                showXAxisTopRule
                showXAxisTopRuleFullWidth
                hideYAxisMinimumLabel
                cursorGuideTop={LIVE_CURSOR_GUIDE_TOP}
                cursorGuideColor="#5D6878"
                disableCursorSplit
                disableResetAnimation
                markerOuterRadius={10}
                markerInnerRadius={3.4}
                markerPulseStyle="ring"
                markerOffsetX={LIVE_CURRENT_MARKER_OFFSET_X}
                lineEndOffsetX={LIVE_CURRENT_MARKER_OFFSET_X}
                lineStrokeWidth={2.15}
                plotClipPadding={{
                  top: 0,
                  right: LIVE_PLOT_CLIP_RIGHT_PADDING,
                  bottom: 0,
                  left: 0,
                }}
                showAreaFill
                areaFillTopOpacity={0.045}
                areaFillBottomOpacity={0}
                areaFillBottomOffset={5}
                yAxis={{
                  min: axisValues.min,
                  max: axisValues.max,
                  ticks: axisValues.ticks,
                  tickFormat: (value) => formatUsd(value, axisPriceDisplayDigits),
                }}
                tooltipValueFormatter={(value) => formatUsd(value, priceDisplayDigits)}
                tooltipHeaderFontSize={11}
                tooltipDateFontSize={10}
                tooltipDateFormatter={(date) =>
                  date.toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    second: '2-digit',
                  }) + (isMarketClosed ? ' (market closed)' : '')
                }
                showTooltipSeriesLabels={false}
                tooltipHeader={{
                  iconPath: config.icon_path,
                  color: liveColor,
                }}
                lineCurve="catmullRom"
              />
            </div>
          </div>
        ) : (
          <EventChart
            event={event}
            isMobile={isMobile}
            seriesEvents={seriesEvents}
            chartWidth={providedChartWidth}
            showControls={false}
            showSeriesNavigation={false}
          />
        )}
      </div>

      {showSeriesControls && (
        <EventSeriesPills
          currentEventSlug={event.slug}
          isDailySeries={tradingWindowMs === 24 * 60 * 60 * 1000}
          tradingWindowMs={tradingWindowMs}
          seriesEvents={seriesEvents}
          variant="live"
          rightSlot={
            <EventLiveSeriesViewSwitch
              activeView={activeView}
              setActiveView={setActiveView}
              liveColor={liveColor}
              config={config}
            />
          }
        />
      )}
    </div>
  )
}
