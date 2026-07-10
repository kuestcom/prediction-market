import type { Event } from '@/types'
import type { DataPoint } from '@/types/PredictionChartTypes'
import { formatCurrency } from '@/lib/formatters'
import {
  resolveLiveSeriesTopicPriceDigits,
} from './liveSeriesPricePrecision'

export const SERIES_KEY = 'live_price'
export const LIVE_WINDOW_MS = 40 * 1000
const LIVE_HISTORY_BUFFER_MS = 8 * 1000
export const LIVE_DATA_RETENTION_MS = LIVE_WINDOW_MS + LIVE_HISTORY_BUFFER_MS
export const LIVE_CLOCK_FRAME_MS = 1000 / 30
export const LIVE_X_AXIS_STEP_MS = 10 * 1000
export const LIVE_X_AXIS_LEFT_LABEL_GUARD_MS = 3600
const LIVE_MAX_Y_AXIS_TICKS = 6
export const MAX_POINTS = 4000
export const LIVE_PRICE_TRANSITION_MS = 650
const LIVE_PRICE_TRANSITION_MIN_MS = 120
const LIVE_PRICE_TRANSITION_CADENCE_RATIO = 0.8
export const LIVE_CHART_HEIGHT = 332
export const LIVE_CHART_MARGIN_TOP = 22
export const LIVE_CHART_MARGIN_BOTTOM = 52
export const LIVE_CHART_MARGIN_RIGHT = 40
export const LIVE_CHART_MARGIN_LEFT = 0
export const LIVE_CURSOR_GUIDE_TOP = 10
export const LIVE_TARGET_MAX_BOTTOM_OFFSET = 10
export const LIVE_CURRENT_MARKER_OFFSET_X = 0
export const LIVE_PLOT_CLIP_RIGHT_PADDING = 22
const LIVE_PRICE_STORAGE_PREFIX = 'kuest-live-last-price'

export interface PersistedLivePrice {
  price: number
  timestamp: number
}

export interface LiveSeriesPriceSnapshot {
  series_slug: string
  instrument: string
  interval: '5m' | '15m' | '1h' | '4h' | '1d'
  source: 'chainlink' | 'massive'
  interval_ms: number
  event_window_start_ms: number
  event_window_end_ms: number
  opening_price: number | null
  closing_price: number | null
  latest_price: number | null
  latest_window_end_ms: number | null
  latest_source_timestamp_ms: number | null
  is_event_closed: boolean
}

function normalizeTimestamp(value: unknown, fallbackTimestamp = 0) {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) {
    return fallbackTimestamp
  }
  return numeric < 1e12 ? numeric * 1000 : numeric
}

function buildLivePriceStorageKey(topic: string, symbol: string) {
  return `${LIVE_PRICE_STORAGE_PREFIX}:${topic.trim().toLowerCase()}:${symbol.trim().toUpperCase()}`
}

export function readPersistedLivePrice(topic: string, symbol: string): PersistedLivePrice | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const key = buildLivePriceStorageKey(topic, symbol)
    const raw = window.localStorage.getItem(key)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as Partial<PersistedLivePrice>
    const price = Number(parsed.price)
    const timestamp = normalizeTimestamp(parsed.timestamp)

    if (!Number.isFinite(price) || price <= 0) {
      return null
    }

    return {
      price,
      timestamp,
    }
  }
  catch {
    return null
  }
}

export function writePersistedLivePrice(topic: string, symbol: string, price: number, timestamp: number) {
  if (typeof window === 'undefined' || !Number.isFinite(price) || price <= 0) {
    return
  }

  try {
    const key = buildLivePriceStorageKey(topic, symbol)
    const payload: PersistedLivePrice = {
      price,
      timestamp: normalizeTimestamp(timestamp),
    }
    window.localStorage.setItem(key, JSON.stringify(payload))
  }
  catch {
  }
}

function matchesSymbol(symbol: string | null, targetSymbol: string) {
  if (!targetSymbol) {
    return true
  }
  if (!symbol) {
    return false
  }
  return symbolsAreEquivalent(symbol, targetSymbol)
}

function extractPointsFromArray(
  entries: any[],
  fallbackSymbol: string | null = null,
  fallbackTimestamp = 0,
) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return []
  }

  const points: Array<{ price: number, timestamp: number, symbol: string | null }> = []

  for (const point of entries) {
    if (!point || typeof point !== 'object') {
      continue
    }

    const price = Number(point.value ?? point.price ?? point.p)
    if (!Number.isFinite(price) || price <= 0) {
      continue
    }

    const rawSymbol = point.symbol ?? point.pair ?? point.asset ?? point.base ?? fallbackSymbol
    const symbol = typeof rawSymbol === 'string' ? rawSymbol : null
    const timestamp = normalizeTimestamp(point.timestamp ?? point.ts ?? point.t, fallbackTimestamp)

    points.push({ price, timestamp, symbol })
  }

  return points
}

export function extractLivePriceUpdates(payload: any, topic: string, symbol: string, fallbackTimestamp = 0) {
  if (!payload || typeof payload !== 'object') {
    return []
  }

  const updates: Array<{ price: number, timestamp: number, symbol: string | null }> = []
  const candidates: any[] = []
  if (Array.isArray(payload)) {
    candidates.push(...payload)
  }
  else {
    candidates.push(payload)
  }

  if (payload?.payload && typeof payload.payload === 'object') {
    candidates.push(payload.payload)
  }

  if (Array.isArray(payload?.data)) {
    candidates.push(...payload.data)
  }
  else if (payload?.data && typeof payload.data === 'object') {
    candidates.push(payload.data)
  }

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') {
      continue
    }

    const candidateTopic = candidate.topic ?? candidate?.data?.topic ?? candidate?.payload?.topic ?? candidate?.stream
    if (typeof candidateTopic === 'string' && candidateTopic !== topic) {
      continue
    }

    const rawSymbol = candidate?.data?.symbol
      ?? candidate?.symbol
      ?? candidate?.data?.pair
      ?? candidate?.pair
      ?? candidate?.data?.asset
      ?? candidate?.asset
      ?? candidate?.data?.base
      ?? candidate?.base
      ?? candidate?.payload?.symbol

    const candidateSymbol = typeof rawSymbol === 'string' ? rawSymbol : null

    if (Array.isArray(candidate?.data)) {
      updates.push(...extractPointsFromArray(candidate.data, candidateSymbol, fallbackTimestamp))
    }

    if (Array.isArray(candidate?.payload?.data)) {
      updates.push(...extractPointsFromArray(candidate.payload.data, candidateSymbol, fallbackTimestamp))
    }

    const rawPrice = candidate?.data?.price
      ?? candidate?.price
      ?? candidate?.data?.value
      ?? candidate?.value
      ?? candidate?.data?.p
      ?? candidate?.p
      ?? candidate?.payload?.value
      ?? candidate?.payload?.price

    const price = Number(rawPrice)
    if (!Number.isFinite(price) || price <= 0) {
      continue
    }

    const timestamp = normalizeTimestamp(
      candidate?.data?.timestamp
      ?? candidate?.timestamp
      ?? candidate?.data?.ts
      ?? candidate?.ts
      ?? candidate?.data?.t
      ?? candidate?.t
      ?? candidate?.payload?.timestamp,
      fallbackTimestamp,
    )

    updates.push({
      price,
      timestamp,
      symbol: candidateSymbol,
    })
  }

  const filtered = updates.filter(update => !update.symbol || matchesSymbol(update.symbol, symbol))
  if (!filtered.length) {
    return []
  }

  const sorted = filtered.sort((a, b) => a.timestamp - b.timestamp)
  const deduped: Array<{ price: number, timestamp: number, symbol: string | null }> = []

  for (const update of sorted) {
    const last = deduped.at(-1)
    if (last && last.timestamp === update.timestamp) {
      deduped[deduped.length - 1] = update
      continue
    }
    deduped.push(update)
  }

  return deduped
}

export function isSnapshotMessage(payload: any) {
  if (!payload || typeof payload !== 'object') {
    return false
  }

  const messageType = String(payload?.type ?? '').trim().toLowerCase()
  if (messageType !== 'subscribe') {
    return false
  }

  return Array.isArray(payload?.payload?.data) || Array.isArray(payload?.data)
}

export function buildAxis(values: number[], fractionDigits = 2) {
  const resolvedFractionDigits = Math.max(0, Math.min(6, Math.floor(fractionDigits)))
  const visibleStep = 1 / 10 ** resolvedFractionDigits
  function roundAxisValue(value: number) {
    return Number(value.toFixed(resolvedFractionDigits))
  }

  if (!values.length) {
    return { min: 0, max: 1, ticks: [0, 1] }
  }

  const minValue = Math.min(...values)
  const maxValue = Math.max(...values)
  const midpoint = (minValue + maxValue) / 2

  if (maxValue - minValue < visibleStep / 2 && Math.abs(midpoint) >= 50) {
    const center = roundAxisValue(midpoint)
    const axisMin = roundAxisValue(center - visibleStep)
    const axisMax = roundAxisValue(center + visibleStep)
    return { min: axisMin, max: axisMax, ticks: [axisMin, center, axisMax] }
  }

  const minSpan = Math.max(Math.abs(midpoint) * 0.00002, Math.abs(midpoint) >= 1 ? 0.002 : 0.0002)
  const span = Math.max(minSpan, maxValue - minValue)
  const padding = Math.max(span * 0.08, minSpan * 0.08)
  const rawMin = minValue - padding
  const rawMax = maxValue + padding

  const targetTicks = 4
  const rawStep = (rawMax - rawMin) / Math.max(1, targetTicks - 1)
  const magnitude = 10 ** Math.floor(Math.log10(rawStep))
  const stepRatio = rawStep / magnitude
  const stepMultiplier = stepRatio >= 5 ? 5 : stepRatio >= 2 ? 2 : 1
  const initialStep = Math.max(stepMultiplier * magnitude, visibleStep)

  function nextNiceStep(currentStep: number) {
    const currentMagnitude = 10 ** Math.floor(Math.log10(currentStep))
    const normalized = currentStep / currentMagnitude

    if (normalized < 2) {
      return 2 * currentMagnitude
    }

    if (normalized < 5) {
      return 5 * currentMagnitude
    }

    return 10 * currentMagnitude
  }

  function buildTicksForStep(step: number) {
    const axisMin = Math.floor(rawMin / step) * step
    const axisMax = Math.ceil(rawMax / step) * step
    const ticks: number[] = []

    for (let value = axisMin; value <= axisMax + step * 1e-6; value += step) {
      ticks.push(value)
    }

    return { axisMin, axisMax, ticks }
  }

  let step = initialStep
  let axis = buildTicksForStep(step)
  let attempts = 0

  while (axis.ticks.length > LIVE_MAX_Y_AXIS_TICKS && attempts < 8) {
    step = nextNiceStep(step)
    axis = buildTicksForStep(step)
    attempts += 1
  }

  const ticks: number[] = []
  const seenTicks = new Set<number>()

  for (const value of axis.ticks) {
    const roundedValue = roundAxisValue(value)
    if (seenTicks.has(roundedValue)) {
      continue
    }

    seenTicks.add(roundedValue)
    ticks.push(roundedValue)
  }

  return {
    min: roundAxisValue(axis.axisMin),
    max: roundAxisValue(axis.axisMax),
    ticks,
  }
}

export function keepWithinLiveWindow(points: DataPoint[], cutoffMs: number) {
  if (!points.length) {
    return points
  }

  const trimmed = points.filter(point => point.date.getTime() >= cutoffMs)
  if (trimmed.length > 0) {
    return trimmed
  }

  const lastPoint = points.at(-1)
  const lastPrice = lastPoint?.[SERIES_KEY]
  if (typeof lastPrice !== 'number' || !Number.isFinite(lastPrice)) {
    return []
  }

  return [{
    date: new Date(cutoffMs + 1),
    [SERIES_KEY]: lastPrice,
  }]
}

function readLiveSeriesPoint(point: DataPoint) {
  const timestamp = point.date.getTime()
  const price = point[SERIES_KEY]

  if (
    !Number.isFinite(timestamp)
    || typeof price !== 'number'
    || !Number.isFinite(price)
  ) {
    return null
  }

  return { timestamp, price }
}

function resolveLiveSeriesPriceAt(points: DataPoint[], timestamp: number) {
  let previousPoint: { timestamp: number, price: number } | null = null

  for (const point of points) {
    const currentPoint = readLiveSeriesPoint(point)
    if (!currentPoint) {
      continue
    }

    if (currentPoint.timestamp === timestamp) {
      return currentPoint.price
    }

    if (currentPoint.timestamp > timestamp) {
      if (!previousPoint) {
        return null
      }

      const span = currentPoint.timestamp - previousPoint.timestamp
      if (span <= 0) {
        return previousPoint.price
      }

      const progress = (timestamp - previousPoint.timestamp) / span
      return previousPoint.price + (currentPoint.price - previousPoint.price) * progress
    }

    previousPoint = currentPoint
  }

  return previousPoint?.price ?? null
}

function smoothStep(progress: number) {
  const clamped = Math.max(0, Math.min(1, progress))
  return clamped * clamped * (3 - 2 * clamped)
}

export function resolveLivePriceTransitionDuration(
  previousMessageTimestamp: number | null,
  currentMessageTimestamp: number,
) {
  if (
    previousMessageTimestamp == null
    || !Number.isFinite(previousMessageTimestamp)
    || !Number.isFinite(currentMessageTimestamp)
  ) {
    return LIVE_PRICE_TRANSITION_MS
  }

  const messageIntervalMs = Math.max(0, currentMessageTimestamp - previousMessageTimestamp)
  return Math.min(
    LIVE_PRICE_TRANSITION_MS,
    Math.max(
      LIVE_PRICE_TRANSITION_MIN_MS,
      Math.round(messageIntervalMs * LIVE_PRICE_TRANSITION_CADENCE_RATIO),
    ),
  )
}

export function appendLivePriceTransition(
  points: DataPoint[],
  targetPrice: number,
  transitionStartMs: number,
  transitionDurationMs = LIVE_PRICE_TRANSITION_MS,
) {
  if (
    !Number.isFinite(targetPrice)
    || targetPrice <= 0
    || !Number.isFinite(transitionStartMs)
  ) {
    return points
  }

  const startTimestamp = Math.round(transitionStartMs)
  const latestScheduledPoint = [...points]
    .reverse()
    .map(readLiveSeriesPoint)
    .find(point => point !== null)

  // Repeated WS values should keep an in-flight trajectory instead of restarting it.
  if (latestScheduledPoint?.price === targetPrice) {
    return points.slice(-MAX_POINTS)
  }

  const startPrice = resolveLiveSeriesPriceAt(points, startTimestamp)
  const retainedPoints = points.filter((point) => {
    const timestamp = point.date.getTime()
    return Number.isFinite(timestamp) && timestamp < startTimestamp
  })

  if (startPrice == null || startPrice === targetPrice) {
    return [
      ...retainedPoints,
      {
        date: new Date(startTimestamp),
        [SERIES_KEY]: targetPrice,
      },
    ].slice(-MAX_POINTS)
  }

  const durationMs = Number.isFinite(transitionDurationMs)
    ? Math.max(0, Math.round(transitionDurationMs))
    : LIVE_PRICE_TRANSITION_MS
  if (durationMs === 0) {
    return [
      ...retainedPoints,
      {
        date: new Date(startTimestamp),
        [SERIES_KEY]: targetPrice,
      },
    ].slice(-MAX_POINTS)
  }

  const frameCount = Math.max(1, Math.ceil(durationMs / LIVE_CLOCK_FRAME_MS))
  const transitionPoints: DataPoint[] = [{
    date: new Date(startTimestamp),
    [SERIES_KEY]: startPrice,
  }]
  let lastTimestamp = startTimestamp

  for (let frame = 1; frame <= frameCount; frame += 1) {
    const progress = frame / frameCount
    const pointTimestamp = frame === frameCount
      ? startTimestamp + durationMs
      : Math.round(startTimestamp + durationMs * progress)

    if (pointTimestamp <= lastTimestamp) {
      continue
    }

    transitionPoints.push({
      date: new Date(pointTimestamp),
      [SERIES_KEY]: frame === frameCount
        ? targetPrice
        : startPrice + (targetPrice - startPrice) * smoothStep(progress),
    })
    lastTimestamp = pointTimestamp
  }

  return [...retainedPoints, ...transitionPoints].slice(-MAX_POINTS)
}

export function resolveLiveSeriesDisplayPrice({
  isEventClosed,
  finalPrice,
  renderedPrice,
  fallbackCurrentPrice,
}: {
  isEventClosed: boolean
  finalPrice: number | null
  renderedPrice: number | null
  fallbackCurrentPrice: number | null
}) {
  if (isEventClosed) {
    return finalPrice ?? renderedPrice
  }

  return renderedPrice ?? fallbackCurrentPrice
}

export function formatUsd(value: number, digits = 2) {
  return formatCurrency(value, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function normalizeLiveChartPrice(price: number, topic: string) {
  if (!Number.isFinite(price) || price <= 0) {
    return null
  }

  const digits = resolveLiveSeriesTopicPriceDigits(topic)
  const factor = 10 ** digits
  return Math.round(price * factor) / factor
}

export function normalizeSubscriptionSymbol(topic: string, symbol: string) {
  const trimmed = symbol.trim()
  if (!trimmed) {
    return trimmed
  }

  if (topic.trim().toLowerCase() === 'equity_prices') {
    return trimmed.split(/[/-]/)[0]?.trim().toUpperCase() || trimmed.toUpperCase()
  }

  return trimmed.toLowerCase()
}

function normalizeComparableSymbol(symbol: string) {
  return symbol.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function symbolsAreEquivalent(symbol: string, target: string) {
  const normalizedSymbol = normalizeComparableSymbol(symbol)
  const normalizedTarget = normalizeComparableSymbol(target)
  if (!normalizedSymbol || !normalizedTarget) {
    return false
  }

  if (normalizedSymbol === normalizedTarget) {
    return true
  }

  const symbolNoQuote = normalizedSymbol.replace(/(usd|usdt)$/i, '')
  const targetNoQuote = normalizedTarget.replace(/(usd|usdt)$/i, '')
  return symbolNoQuote === targetNoQuote
}

export function hexToRgba(color: string, alpha: number) {
  const hex = color.trim().replace(/^#/, '')
  if (!/^[0-9a-f]{6}$/i.test(hex)) {
    return `rgba(0, 0, 0, ${alpha})`
  }
  const r = Number.parseInt(hex.slice(0, 2), 16)
  const g = Number.parseInt(hex.slice(2, 4), 16)
  const b = Number.parseInt(hex.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function parseUtcDate(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(trimmed)
    ? `${trimmed.replace(' ', 'T')}Z`
    : trimmed
  const timestamp = Date.parse(normalized)
  if (!Number.isFinite(timestamp)) {
    return null
  }

  return timestamp
}

export function resolveEventEndTimestamp(event: Event) {
  const eventResolved = parseUtcDate(event.resolved_at)
  if (eventResolved != null) {
    return eventResolved
  }

  const resolvedMarkets = event.markets.filter(market => market.is_resolved || market.condition?.resolved)
  const canUseResolvedMarketTimestamp = event.status === 'resolved'
    || event.status === 'archived'
    || event.total_markets_count <= 1
    || resolvedMarkets.length === event.markets.length
  const resolvedConditionTimestamps = canUseResolvedMarketTimestamp
    ? resolvedMarkets
        .map(market => parseUtcDate(market.condition?.resolved_at))
        .filter((timestamp): timestamp is number => timestamp != null)
    : []

  if (resolvedConditionTimestamps.length > 0) {
    return Math.max(...resolvedConditionTimestamps)
  }

  const eventEnd = parseUtcDate(event.end_date)
  const marketEnd = parseUtcDate(event.markets[0]?.end_time)

  if (eventEnd != null && marketEnd != null) {
    return Math.max(eventEnd, marketEnd)
  }

  if (eventEnd != null) {
    return eventEnd
  }

  if (marketEnd != null) {
    return marketEnd
  }

  return null
}

export function inferIntervalMsFromSeriesSlug(seriesSlug: string | null | undefined) {
  const normalized = seriesSlug?.trim().toLowerCase() ?? ''
  if (!normalized) {
    return 24 * 60 * 60 * 1000
  }

  if (normalized.includes('5m')) {
    return 5 * 60 * 1000
  }

  if (normalized.includes('15m')) {
    return 15 * 60 * 1000
  }

  if (normalized.includes('hourly') || normalized.includes('1h')) {
    return 60 * 60 * 1000
  }

  if (normalized.includes('4h')) {
    return 4 * 60 * 60 * 1000
  }

  return 24 * 60 * 60 * 1000
}

export type CountdownUnit = 'day' | 'hr' | 'min' | 'sec'

export function countdownLabel(unit: CountdownUnit, value: number) {
  if (unit === 'day') {
    return value === 1 ? 'DAY' : 'DAYS'
  }

  const singular = unit.toUpperCase()
  const plural = `${singular}S`
  return value === 1 ? singular : plural
}

export function toCountdownLeftLabel(showDays: boolean, days: number, hours: number, minutes: number, seconds: number) {
  if (showDays) {
    return `${days} ${days === 1 ? 'Day' : 'Days'} ${hours} ${hours === 1 ? 'Hr' : 'Hrs'} ${minutes} ${minutes === 1 ? 'Min' : 'Mins'}`
  }

  return `${hours} ${hours === 1 ? 'Hr' : 'Hrs'} ${minutes} ${minutes === 1 ? 'Min' : 'Mins'} ${seconds} ${seconds === 1 ? 'Sec' : 'Secs'}`
}

export function getVisibleCountdownUnits(showDays: boolean, days: number, hours: number, minutes: number, seconds: number) {
  if (showDays) {
    return [
      { unit: 'day' as const, value: days },
      { unit: 'hr' as const, value: hours },
      { unit: 'min' as const, value: minutes },
    ]
  }

  return [
    { unit: 'hr' as const, value: hours },
    { unit: 'min' as const, value: minutes },
    { unit: 'sec' as const, value: seconds },
  ]
}

export function formatDateAtTimezone(timestamp: number, timeZone: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone,
  }).format(new Date(timestamp))
}

export function formatTimeAtTimezone(timestamp: number, timeZone: string) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone,
  }).format(new Date(timestamp))
}

export function isUsEquityMarketOpen(timestamp: number) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(timestamp))

  const weekday = parts.find(part => part.type === 'weekday')?.value ?? ''
  const hourValue = Number(parts.find(part => part.type === 'hour')?.value ?? '0')
  const minuteValue = Number(parts.find(part => part.type === 'minute')?.value ?? '0')
  const minutesOfDay = hourValue * 60 + minuteValue

  if (weekday === 'Sat' || weekday === 'Sun') {
    return false
  }

  return minutesOfDay >= 9 * 60 + 30 && minutesOfDay < 16 * 60
}

export function clampCountdownDigit(value: number) {
  return Math.max(0, Math.min(9, value))
}
