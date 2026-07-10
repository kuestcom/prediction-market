'use client'

import type { Event, EventLiveChartConfig, EventSeriesEntry } from '@/types'
import type { DataPoint, PredictionChartProps, SeriesConfig } from '@/types/PredictionChartTypes'
import dynamic from 'next/dynamic'
import { useMemo, useState } from 'react'
import { useSiteIdentity } from '@/hooks/useSiteIdentity'
import { useWindowSize } from '@/hooks/useWindowSize'
import { cn } from '@/lib/utils'
import { useLiveSeriesClock } from '../_hooks/useLiveSeriesClock'
import { useLiveSeriesPriceSnapshot } from '../_hooks/useLiveSeriesPriceSnapshot'
import { useLiveSeriesWebSocket } from '../_hooks/useLiveSeriesWebSocket'
import {
  buildAxis,
  formatDateAtTimezone,
  formatTimeAtTimezone,
  formatUsd,
  getVisibleCountdownUnits,
  hexToRgba,
  inferIntervalMsFromSeriesSlug,
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
  readPersistedLivePrice,
  resolveEventEndTimestamp,
  resolveLiveSeriesDisplayPrice,
  SERIES_KEY,
  toCountdownLeftLabel,
} from '../_utils/eventLiveSeriesChartUtils'
import {
  resolveLiveSeriesDeltaDisplayDigits,
  resolveLiveSeriesPriceDisplayDigits,
} from '../_utils/liveSeriesPricePrecision'
import EventChart from './EventChart'
import EventLiveSeriesChartHeader from './EventLiveSeriesChartHeader'
import EventLiveSeriesChartOverlay from './EventLiveSeriesChartOverlay'
import EventLiveSeriesViewSwitch from './EventLiveSeriesViewSwitch'
import EventSeriesPills from './EventSeriesPills'

const PredictionChart = dynamic<PredictionChartProps>(
  () => import('@/components/PredictionChart'),
  { ssr: false, loading: () => <div className="h-83 w-full" /> },
)

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
  const hasExplicitEndTimestamp = explicitEndTimestamp != null
  const resolvedMarketsCount = event.markets.filter(market => market.is_resolved || market.condition?.resolved).length
  const hasResolvedState = Boolean(
    event.resolved_at
    || event.status === 'resolved'
    || event.status === 'archived'
    || (
      resolvedMarketsCount > 0
      && (
        event.total_markets_count <= 1
        || resolvedMarketsCount === event.markets.length
      )
    ),
  )

  const nowMs = useLiveSeriesClock(isLiveView)
  const endTimestamp = explicitEndTimestamp ?? nowMs

  const {
    referenceSnapshot,
    baselinePrice,
    setBaselinePrice,
    persistedFallbackPrice: snapshotFallbackPrice,
  } = useLiveSeriesPriceSnapshot({
    config,
    subscriptionSymbol,
    explicitEndTimestamp,
    startTimestamp,
  })
  const isEventClosed = hasExplicitEndTimestamp
    && (
      hasResolvedState
      || Boolean(referenceSnapshot?.is_event_closed)
      || nowMs >= endTimestamp
    )
  const chartNowMs = isEventClosed ? endTimestamp : nowMs

  const [initialPersistedFallbackPrice] = useState(
    () => readPersistedLivePrice(config.topic, subscriptionSymbol),
  )
  const persistedFallbackPrice = snapshotFallbackPrice ?? initialPersistedFallbackPrice

  const { data, status } = useLiveSeriesWebSocket({
    topic: config.topic,
    eventType: config.event_type,
    eventEndTimestamp: explicitEndTimestamp,
    subscriptionSymbol,
    isLiveView: isLiveView && !isEventClosed,
    setBaselinePrice,
  })

  const isMarketClosed = useMemo(() => {
    if (config.topic.trim().toLowerCase() !== 'equity_prices') {
      return false
    }
    return !isUsEquityMarketOpen(nowMs)
  }, [config.topic, nowMs])

  const series = useMemo<SeriesConfig[]>(
    () => ([{
      key: SERIES_KEY,
      name: config.display_symbol || config.display_name,
      color: liveColor,
    }]),
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
  const chartWidth = typeof providedChartWidth === 'number' && Number.isFinite(providedChartWidth) && providedChartWidth > 0
    ? Math.max(1, Math.round(providedChartWidth))
    : fallbackChartWidth

  const referenceOpeningPrice = useMemo(
    () => normalizeReferencePrice(referenceSnapshot?.opening_price, config.topic),
    [config.topic, referenceSnapshot?.opening_price],
  )
  const referenceClosingPrice = useMemo(
    () => normalizeReferencePrice(referenceSnapshot?.closing_price, config.topic),
    [config.topic, referenceSnapshot?.closing_price],
  )
  const latestReferencePriceBeforeEnd = useMemo(
    () => resolveTimestampBoundedPrice({
      value: referenceSnapshot?.latest_price,
      topic: config.topic,
      timestamp: referenceSnapshot?.latest_source_timestamp_ms ?? referenceSnapshot?.latest_window_end_ms,
      endTimestamp,
    }),
    [
      config.topic,
      endTimestamp,
      referenceSnapshot?.latest_price,
      referenceSnapshot?.latest_source_timestamp_ms,
      referenceSnapshot?.latest_window_end_ms,
    ],
  )
  const persistedFallbackPriceBeforeEnd = useMemo(() => {
    if (
      !persistedFallbackPrice
      || !isFinitePositivePrice(persistedFallbackPrice.price)
      || !Number.isFinite(persistedFallbackPrice.timestamp)
      || persistedFallbackPrice.timestamp > endTimestamp
    ) {
      return null
    }

    return persistedFallbackPrice.price
  }, [endTimestamp, persistedFallbackPrice])
  const finalPrice = isEventClosed
    ? referenceClosingPrice ?? latestReferencePriceBeforeEnd ?? persistedFallbackPriceBeforeEnd
    : null

  const fallbackCurrentPrice = useMemo(() => {
    if (isEventClosed) {
      return finalPrice
    }

    if (referenceSnapshot) {
      const snapshotPrice = normalizeLiveChartPrice(
        referenceSnapshot.latest_price ?? referenceSnapshot.closing_price ?? Number.NaN,
        config.topic,
      )

      if (typeof snapshotPrice === 'number' && Number.isFinite(snapshotPrice) && snapshotPrice > 0) {
        return snapshotPrice
      }
    }

    if (persistedFallbackPrice && Number.isFinite(persistedFallbackPrice.price) && persistedFallbackPrice.price > 0) {
      return persistedFallbackPrice.price
    }

    return null
  }, [config.topic, finalPrice, isEventClosed, persistedFallbackPrice, referenceSnapshot])

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
      return preCloseData
    }

    return [
      ...preCloseData.filter(point => point.date.getTime() < endTimestamp),
      {
        date: new Date(endTimestamp),
        [SERIES_KEY]: finalPrice,
      },
    ].slice(-MAX_POINTS)
  }, [closedFallbackData, data, endTimestamp, finalPrice, isEventClosed])

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
      next = pointsWithinDomain.length > 0
        ? [lastPointBeforeDomainStart, ...pointsWithinDomain]
        : [lastPointBeforeDomainStart]
    }

    const lastPoint = next.at(-1)
    const lastPrice = lastPoint?.[SERIES_KEY]
    const lastTimestamp = lastPoint?.date?.getTime?.() ?? Number.NaN

    if (
      typeof lastPrice === 'number'
      && Number.isFinite(lastPrice)
      && Number.isFinite(lastTimestamp)
      && chartNowMs > lastTimestamp
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
  const renderedPrice = typeof rawRenderedPrice === 'number' && Number.isFinite(rawRenderedPrice)
    ? rawRenderedPrice
    : null
  const currentPrice = resolveLiveSeriesDisplayPrice({
    isEventClosed,
    finalPrice,
    renderedPrice,
    fallbackCurrentPrice,
  })
  const axisSourceData = renderData
  const resolvedBaselinePrice = isEventClosed
    ? referenceOpeningPrice
    : baselinePrice ?? referenceOpeningPrice
  const precisionReferencePrice = currentPrice
    ?? resolvedBaselinePrice
    ?? referenceSnapshot?.latest_price
    ?? referenceSnapshot?.closing_price
    ?? referenceSnapshot?.opening_price
    ?? persistedFallbackPrice?.price
    ?? null
  const priceDisplayDigits = resolveLiveSeriesPriceDisplayDigits(
    config.topic,
    config.show_price_decimals,
    precisionReferencePrice,
  )
  const headerPriceDisplayDigits = Math.max(2, priceDisplayDigits)
  const delta = currentPrice != null && resolvedBaselinePrice != null
    ? currentPrice - resolvedBaselinePrice
    : null
  const deltaDisplayDigits = resolveLiveSeriesDeltaDisplayDigits(priceDisplayDigits, delta)
  const axisValues = (() => {
    const values = axisSourceData
      .map(point => point[SERIES_KEY])
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))

    if (!values.length && typeof currentPrice === 'number' && Number.isFinite(currentPrice)) {
      values.push(currentPrice)
    }

    if (typeof resolvedBaselinePrice === 'number' && Number.isFinite(resolvedBaselinePrice)) {
      values.push(resolvedBaselinePrice)
    }

    return buildAxis(values, priceDisplayDigits)
  })()

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
      (!isTradingWindowActive && !isEventClosed)
      || resolvedBaselinePrice == null
      || !Number.isFinite(resolvedBaselinePrice)
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

  const targetLineGuideColor = hexToRgba('#94a3b8', 0.62)
  const targetBadgeColor = '#94a3b8'
  const currentPriceGuideColor = hexToRgba(liveColor, 0.62)

  const countdown = useMemo(() => {
    const totalSeconds = Math.max(0, Math.floor((endTimestamp - nowMs) / 1000))
    const showDays = totalSeconds > 24 * 60 * 60
    const days = showDays ? Math.floor(totalSeconds / (24 * 60 * 60)) : 0
    const hours = showDays
      ? Math.floor((totalSeconds % (24 * 60 * 60)) / 3600)
      : Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    return {
      totalSeconds,
      showDays,
      days,
      hours,
      minutes,
      seconds,
    }
  }, [endTimestamp, nowMs])

  const shouldShowCountdown = hasExplicitEndTimestamp && !isEventClosed && countdown.totalSeconds > 0

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

    return [
      new Date(visibleStartMs),
      new Date(chartNowMs),
    ]
  }, [chartNowMs])

  const liveXAxisDomain = useMemo(
    () => ({
      start: new Date(chartNowMs - LIVE_WINDOW_MS),
      end: new Date(chartNowMs),
    }),
    [chartNowMs],
  )

  const visibleCountdownUnits = useMemo(
    () => getVisibleCountdownUnits(
      countdown.showDays,
      countdown.days,
      countdown.hours,
      countdown.minutes,
      countdown.seconds,
    ),
    [countdown.showDays, countdown.days, countdown.hours, countdown.minutes, countdown.seconds],
  )

  const countdownLeftLabel = useMemo(
    () => toCountdownLeftLabel(
      countdown.showDays,
      countdown.days,
      countdown.hours,
      countdown.minutes,
      countdown.seconds,
    ),
    [countdown.showDays, countdown.days, countdown.hours, countdown.minutes, countdown.seconds],
  )

  const etDateLabel = useMemo(
    () => formatDateAtTimezone(endTimestamp, 'America/New_York'),
    [endTimestamp],
  )
  const etTimeLabel = useMemo(
    () => formatTimeAtTimezone(endTimestamp, 'America/New_York'),
    [endTimestamp],
  )
  const utcDateLabel = useMemo(
    () => formatDateAtTimezone(endTimestamp, 'UTC'),
    [endTimestamp],
  )
  const utcTimeLabel = useMemo(
    () => formatTimeAtTimezone(endTimestamp, 'UTC'),
    [endTimestamp],
  )

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
      {isLiveView
        ? (
            <div className="grid gap-1">
              <EventLiveSeriesChartHeader
                resolvedBaselinePrice={resolvedBaselinePrice}
                headerPriceDisplayDigits={headerPriceDisplayDigits}
                currentPrice={currentPrice}
                delta={delta}
                deltaDisplayDigits={deltaDisplayDigits}
                liveColor={liveColor}
                shouldShowCountdown={shouldShowCountdown}
                isEventClosed={isEventClosed}
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

              <div className={cn('relative z-0 pr-4 pl-0 sm:pr-6 sm:pl-0')}>
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
                  dataSignature={`${event.id}:${config.topic}:${subscriptionSymbol}`}
                  xAxisTickCount={isMobile ? 2 : 4}
                  xDomain={liveXAxisDomain}
                  xAxisTickValues={xAxisTickValues}
                  xAxisTickFormatter={date => date.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false,
                  })}
                  showVerticalGrid={false}
                  showHorizontalGrid
                  gridLineStyle="solid"
                  gridLineOpacity={0.42}
                  showLegend={false}
                  xAxisTickFontSize={13}
                  yAxisTickFontSize={12}
                  showXAxisTopRule
                  cursorGuideTop={LIVE_CURSOR_GUIDE_TOP}
                  disableCursorSplit
                  disableResetAnimation
                  markerOuterRadius={10}
                  markerInnerRadius={4.2}
                  markerPulseStyle="ring"
                  markerOffsetX={LIVE_CURRENT_MARKER_OFFSET_X}
                  lineEndOffsetX={LIVE_CURRENT_MARKER_OFFSET_X}
                  lineStrokeWidth={2.15}
                  plotClipPadding={{
                    right: LIVE_PLOT_CLIP_RIGHT_PADDING,
                  }}
                  showAreaFill
                  areaFillTopOpacity={0.08}
                  areaFillBottomOpacity={0}
                  yAxis={{
                    min: axisValues.min,
                    max: axisValues.max,
                    ticks: axisValues.ticks,
                    tickFormat: value => formatUsd(value, priceDisplayDigits),
                  }}
                  tooltipValueFormatter={value => formatUsd(value, priceDisplayDigits)}
                  tooltipDateFormatter={date => date.toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    second: '2-digit',
                  }) + (isMarketClosed ? ' (market closed)' : '')}
                  showTooltipSeriesLabels={false}
                  tooltipHeader={{
                    iconPath: config.icon_path,
                    color: liveColor,
                  }}
                  lineCurve="catmullRom"
                />
              </div>
            </div>
          )
        : (
            <EventChart
              event={event}
              isMobile={isMobile}
              seriesEvents={seriesEvents}
              chartWidth={providedChartWidth}
              showControls={false}
              showSeriesNavigation={false}
            />
          )}

      {showSeriesControls && (
        <EventSeriesPills
          currentEventSlug={event.slug}
          seriesEvents={seriesEvents}
          variant="live"
          rightSlot={(
            <EventLiveSeriesViewSwitch
              activeView={activeView}
              setActiveView={setActiveView}
              liveColor={liveColor}
              config={config}
            />
          )}
        />
      )}
    </div>
  )
}
