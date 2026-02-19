'use client'

import type { Event, EventLiveChartConfig, EventSeriesEntry } from '@/types'
import type { DataPoint, PredictionChartProps, SeriesConfig } from '@/types/PredictionChartTypes'
import { ChartLineIcon, ChevronsDownIcon, ChevronsUpIcon, TriangleIcon } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useWindowSize } from '@/hooks/useWindowSize'
import { formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import EventChart from './EventChart'
import EventSeriesPills from './EventSeriesPills'

const PredictionChart = dynamic<PredictionChartProps>(
  () => import('@/components/PredictionChart'),
  { ssr: false, loading: () => <div className="h-83 w-full" /> },
)

const SERIES_KEY = 'live_price'
const LIVE_WINDOW_MS = 40 * 1000
const LIVE_CLOCK_FRAME_MS = 1000 / 30
const LIVE_X_AXIS_STEP_MS = 10 * 1000
const MAX_POINTS = 4000
const LIVE_WS_USE_ONLY_LAST_UPDATE_PER_MESSAGE = true
const LIVE_CHART_HEIGHT = 332
const LIVE_CHART_MARGIN_TOP = 12
const LIVE_CHART_MARGIN_BOTTOM = 52
const LIVE_CHART_MARGIN_RIGHT = 40
const LIVE_CHART_MARGIN_LEFT = 0
const LIVE_CURSOR_GUIDE_TOP = 10
const LIVE_PRICE_STORAGE_PREFIX = 'kuest-live-last-price'

interface PersistedLivePrice {
  price: number
  timestamp: number
}

interface LiveSeriesPriceSnapshot {
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

function normalizeTimestamp(value: unknown) {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) {
    return Date.now()
  }
  return numeric < 1e12 ? numeric * 1000 : numeric
}

function buildLivePriceStorageKey(topic: string, symbol: string) {
  return `${LIVE_PRICE_STORAGE_PREFIX}:${topic.trim().toLowerCase()}:${symbol.trim().toUpperCase()}`
}

function readPersistedLivePrice(topic: string, symbol: string): PersistedLivePrice | null {
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

function writePersistedLivePrice(topic: string, symbol: string, price: number, timestamp: number) {
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

function extractPointsFromArray(entries: any[], fallbackSymbol: string | null = null) {
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
    const timestamp = normalizeTimestamp(point.timestamp ?? point.ts ?? point.t)

    points.push({ price, timestamp, symbol })
  }

  return points
}

function extractLivePriceUpdates(payload: any, topic: string, symbol: string) {
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
      updates.push(...extractPointsFromArray(candidate.data, candidateSymbol))
    }

    if (Array.isArray(candidate?.payload?.data)) {
      updates.push(...extractPointsFromArray(candidate.payload.data, candidateSymbol))
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

  return filtered.sort((a, b) => a.timestamp - b.timestamp)
}

function buildAxis(values: number[]) {
  if (!values.length) {
    return { min: 0, max: 1, ticks: [0, 1] }
  }

  const minValue = Math.min(...values)
  const maxValue = Math.max(...values)
  const midpoint = (minValue + maxValue) / 2

  if (maxValue - minValue < 0.005 && Math.abs(midpoint) >= 50) {
    const center = Number(midpoint.toFixed(2))
    const axisMin = Number((center - 0.01).toFixed(2))
    const axisMax = Number((center + 0.01).toFixed(2))
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
  const step = stepMultiplier * magnitude
  const axisMin = Math.floor(rawMin / step) * step
  const axisMax = Math.ceil(rawMax / step) * step

  const ticks: number[] = []
  for (let value = axisMin; value <= axisMax + 1e-6; value += step) {
    ticks.push(Number(value.toFixed(2)))
  }

  return { min: axisMin, max: axisMax, ticks }
}

function keepWithinLiveWindow(points: DataPoint[], cutoffMs: number) {
  if (!points.length) {
    return points
  }

  const trimmed = points.filter(point => point.date.getTime() >= cutoffMs)
  if (trimmed.length > 0) {
    return trimmed
  }

  const lastPoint = points[points.length - 1]
  const lastPrice = lastPoint?.[SERIES_KEY]
  if (typeof lastPrice !== 'number' || !Number.isFinite(lastPrice)) {
    return []
  }

  return [{
    date: new Date(cutoffMs + 1),
    [SERIES_KEY]: lastPrice,
  }]
}

function formatUsd(value: number, digits = 2) {
  return formatCurrency(value, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

function normalizeLiveChartPrice(price: number, topic: string) {
  if (!Number.isFinite(price) || price <= 0) {
    return null
  }

  const normalizedTopic = topic.trim().toLowerCase()
  const digits = normalizedTopic === 'equity_prices' ? 2 : 4
  const factor = 10 ** digits
  return Math.round(price * factor) / factor
}

function normalizeSubscriptionSymbol(topic: string, symbol: string) {
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

function hexToRgba(color: string, alpha: number) {
  const hex = color.trim().replace(/^#/, '')
  if (!/^[0-9a-f]{6}$/i.test(hex)) {
    return `rgba(0, 0, 0, ${alpha})`
  }
  const r = Number.parseInt(hex.slice(0, 2), 16)
  const g = Number.parseInt(hex.slice(2, 4), 16)
  const b = Number.parseInt(hex.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function parseUtcDate(value: string | null | undefined) {
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

function resolveEventEndTimestamp(event: Event) {
  const eventEnd = parseUtcDate(event.end_date)
  const marketEnd = parseUtcDate(event.markets[0]?.end_time)

  if (eventEnd && marketEnd) {
    // Prefer the latest known event cutoff when both are present.
    return Math.max(eventEnd, marketEnd)
  }

  return eventEnd ?? marketEnd ?? Date.now()
}

function inferIntervalMsFromSeriesSlug(seriesSlug: string | null | undefined) {
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

type CountdownUnit = 'day' | 'hr' | 'min' | 'sec'

function countdownLabel(unit: CountdownUnit, value: number) {
  if (unit === 'day') {
    return value === 1 ? 'DAY' : 'DAYS'
  }

  const singular = unit.toUpperCase()
  const plural = `${singular}S`
  return value === 1 ? singular : plural
}

function toCountdownLeftLabel(showDays: boolean, days: number, hours: number, minutes: number, seconds: number) {
  if (showDays) {
    return `${days} ${days === 1 ? 'Day' : 'Days'} ${hours} ${hours === 1 ? 'Hr' : 'Hrs'} ${minutes} ${minutes === 1 ? 'Min' : 'Mins'}`
  }

  return `${hours} ${hours === 1 ? 'Hr' : 'Hrs'} ${minutes} ${minutes === 1 ? 'Min' : 'Mins'} ${seconds} ${seconds === 1 ? 'Sec' : 'Secs'}`
}

function getVisibleCountdownUnits(showDays: boolean, days: number, hours: number, minutes: number, seconds: number) {
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

function formatDateAtTimezone(timestamp: number, timeZone: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone,
  }).format(new Date(timestamp))
}

function formatTimeAtTimezone(timestamp: number, timeZone: string) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone,
  }).format(new Date(timestamp))
}

function isUsEquityMarketOpen(timestamp: number) {
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

function RollingCountdownDigit({ digit }: { digit: number }) {
  const [currentDigit, setCurrentDigit] = useState(() => Math.max(0, Math.min(9, digit)))
  const [previousDigit, setPreviousDigit] = useState<number | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    const nextDigit = Math.max(0, Math.min(9, digit))
    if (nextDigit === currentDigit) {
      return
    }

    setPreviousDigit(currentDigit)
    setCurrentDigit(nextDigit)
    setIsAnimating(true)

    const timeout = window.setTimeout(() => {
      setIsAnimating(false)
      setPreviousDigit(null)
    }, 240)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [currentDigit, digit])

  return (
    <span className="relative inline-flex h-[1em] w-[0.72em] overflow-hidden">
      {previousDigit !== null && (
        <span
          className={cn(
            'absolute inset-0 flex items-center justify-center transition-all duration-200 ease-out',
            isAnimating ? '-translate-y-full opacity-0' : 'translate-y-0 opacity-100',
          )}
        >
          {previousDigit}
        </span>
      )}
      <span
        className={cn(
          'absolute inset-0 flex items-center justify-center transition-all duration-200 ease-out',
          previousDigit === null
            ? 'translate-y-0 opacity-100'
            : isAnimating
              ? 'translate-y-0 opacity-100'
              : 'translate-y-full opacity-0',
        )}
      >
        {currentDigit}
      </span>
    </span>
  )
}

function AnimatedCountdownValue({ value }: { value: number }) {
  const safeValue = Math.max(0, Math.floor(value))
  const digits = safeValue.toString().padStart(2, '0').split('')

  return (
    <span className="inline-flex items-center leading-none tabular-nums">
      {digits.map((digit, index) => (
        <RollingCountdownDigit
          key={index}
          digit={Number(digit)}
        />
      ))}
    </span>
  )
}

export function shouldUseLiveSeriesChart(event: Event, config: EventLiveChartConfig | null | undefined) {
  if (!config?.enabled) {
    return false
  }

  if (event.total_markets_count !== 1) {
    return false
  }

  const seriesSlug = event.series_slug?.trim()
  return Boolean(seriesSlug && seriesSlug === config.series_slug)
}

interface EventLiveSeriesChartProps {
  event: Event
  isMobile: boolean
  seriesEvents?: EventSeriesEntry[]
  config: EventLiveChartConfig
}

export default function EventLiveSeriesChart({
  event,
  isMobile,
  seriesEvents = [],
  config: inputConfig,
}: EventLiveSeriesChartProps) {
  const wsUrl = process.env.WS_LIVE_DATA_URL
  const config = inputConfig
  const { width: windowWidth } = useWindowSize()
  const liveColor = config.line_color || '#F59E0B'
  const priceDisplayDigits = config.show_price_decimals ? 2 : 0
  const subscriptionSymbol = useMemo(
    () => normalizeSubscriptionSymbol(config.topic, config.symbol),
    [config.symbol, config.topic],
  )
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [data, setData] = useState<DataPoint[]>([])
  const [baselinePrice, setBaselinePrice] = useState<number | null>(null)
  const [referenceSnapshot, setReferenceSnapshot] = useState<LiveSeriesPriceSnapshot | null>(null)
  const [status, setStatus] = useState<'connecting' | 'live' | 'offline'>('connecting')
  const [activeView, setActiveView] = useState<'live' | 'market'>('live')
  const isLiveView = activeView === 'live'
  const endTimestamp = useMemo(() => resolveEventEndTimestamp(event), [event])
  const isEventClosed = nowMs >= endTimestamp
  const isMarketClosed = useMemo(() => {
    if (config.topic.trim().toLowerCase() !== 'equity_prices') {
      return false
    }
    return !isUsEquityMarketOpen(nowMs)
  }, [config.topic, nowMs])

  useEffect(() => {
    const persistedPrice = readPersistedLivePrice(config.topic, subscriptionSymbol)
    if (persistedPrice) {
      setData([{
        date: new Date(persistedPrice.timestamp),
        [SERIES_KEY]: persistedPrice.price,
      }])
    }
    else {
      setData([])
    }
    setBaselinePrice(null)
    setReferenceSnapshot(null)
    setStatus('connecting')
    setActiveView('live')
  }, [event.id, config.topic, config.event_type, subscriptionSymbol])

  useEffect(() => {
    if (!isLiveView) {
      return
    }

    let frameId: number | null = null
    let lastFrameTimestamp = 0

    function animate(frameTimestamp: number) {
      if (!document.hidden && frameTimestamp - lastFrameTimestamp >= LIVE_CLOCK_FRAME_MS) {
        lastFrameTimestamp = frameTimestamp
        setNowMs(Date.now())
      }
      frameId = window.requestAnimationFrame(animate)
    }

    frameId = window.requestAnimationFrame(animate)

    function handleVisibilityChange() {
      if (!document.hidden) {
        setNowMs(Date.now())
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      if (frameId != null) {
        window.cancelAnimationFrame(frameId)
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isLiveView])

  useEffect(() => {
    const seriesSlug = config.series_slug?.trim()
    if (!seriesSlug || !Number.isFinite(endTimestamp)) {
      return
    }

    const controller = new AbortController()
    let isCancelled = false

    async function loadPriceSnapshot() {
      try {
        const query = new URLSearchParams({
          seriesSlug,
          eventEndMs: String(endTimestamp),
        })

        const response = await fetch(`/api/price-reference/live-series?${query.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
        })

        if (!response.ok) {
          return
        }

        const payload = await response.json() as LiveSeriesPriceSnapshot
        if (isCancelled) {
          return
        }

        setReferenceSnapshot(payload)

        if (typeof payload.opening_price === 'number' && Number.isFinite(payload.opening_price) && payload.opening_price > 0) {
          setBaselinePrice(payload.opening_price)
        }

        const fallbackPrice = normalizeLiveChartPrice(
          payload.latest_price ?? payload.closing_price ?? Number.NaN,
          config.topic,
        )

        if (typeof fallbackPrice === 'number') {
          const rawFallbackTimestamp = payload.latest_source_timestamp_ms ?? payload.event_window_end_ms ?? Date.now()
          const minTimestamp = Date.now() - LIVE_WINDOW_MS + 1000
          const fallbackTimestamp = Math.max(rawFallbackTimestamp, minTimestamp)
          writePersistedLivePrice(config.topic, subscriptionSymbol, fallbackPrice, fallbackTimestamp)
          setData((previous) => {
            const lastTimestamp = previous[previous.length - 1]?.date?.getTime?.() ?? Number.NaN
            if (
              previous.length > 0
              && Number.isFinite(lastTimestamp)
              && lastTimestamp >= fallbackTimestamp
            ) {
              return previous
            }

            return [{
              date: new Date(fallbackTimestamp),
              [SERIES_KEY]: fallbackPrice,
            }]
          })
        }
      }
      catch {
      }
    }

    loadPriceSnapshot()

    return () => {
      isCancelled = true
      controller.abort()
    }
  }, [config.series_slug, config.topic, endTimestamp, subscriptionSymbol])

  useEffect(() => {
    if (!isLiveView) {
      return
    }

    if (!wsUrl) {
      setStatus('offline')
      return
    }
    // Intentionally keep WS active regardless of event close to preserve always-live behavior.
    const resolvedWsUrl = wsUrl

    let isActive = true
    let ws: WebSocket | null = null
    let reconnectTimeout: number | null = null

    function buildSubscriptionPayload(action: 'subscribe' | 'unsubscribe') {
      const filters = JSON.stringify({
        symbol: subscriptionSymbol,
      })

      return JSON.stringify({
        action,
        subscriptions: [
          {
            topic: config.topic,
            type: config.event_type,
            filters,
          },
        ],
      })
    }

    function clearReconnect() {
      if (reconnectTimeout != null) {
        window.clearTimeout(reconnectTimeout)
        reconnectTimeout = null
      }
    }

    function scheduleReconnect() {
      clearReconnect()
      reconnectTimeout = window.setTimeout(() => {
        if (!isActive) {
          return
        }
        if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
          ws = null
          connect()
        }
      }, 1500)
    }

    function handleOpen() {
      if (!ws) {
        return
      }
      setStatus('connecting')
      ws.send(buildSubscriptionPayload('subscribe'))
    }

    function handleMessage(eventMessage: MessageEvent<string>) {
      if (!isActive) {
        return
      }

      let payload: any
      try {
        payload = JSON.parse(eventMessage.data)
      }
      catch {
        return
      }

      const updates = extractLivePriceUpdates(payload, config.topic, subscriptionSymbol)
      const normalizedUpdates = updates
        .map((update) => {
          const normalizedPrice = normalizeLiveChartPrice(update.price, config.topic)
          if (normalizedPrice == null) {
            return null
          }

          return {
            ...update,
            price: normalizedPrice,
          }
        })
        .filter((update): update is { price: number, timestamp: number, symbol: string | null } => update !== null)

      const wsUpdatesForRender = LIVE_WS_USE_ONLY_LAST_UPDATE_PER_MESSAGE
        ? normalizedUpdates.slice(-1)
        : normalizedUpdates

      if (!wsUpdatesForRender.length) {
        return
      }

      setStatus('live')
      const latest = wsUpdatesForRender[wsUpdatesForRender.length - 1]
      if (latest) {
        writePersistedLivePrice(config.topic, subscriptionSymbol, latest.price, latest.timestamp)
      }

      setData((prev) => {
        const arrivalTimestamp = Date.now()
        const cutoff = arrivalTimestamp - LIVE_WINDOW_MS
        let next = keepWithinLiveWindow(prev, cutoff)
        let lastTimestamp = next.length ? next[next.length - 1].date.getTime() : null

        for (const update of wsUpdatesForRender) {
          // Anchor incoming points to arrival time to avoid delayed-source timestamp jumps.
          let pointTimestamp = Math.max(update.timestamp, arrivalTimestamp)

          if (lastTimestamp !== null && pointTimestamp <= lastTimestamp) {
            pointTimestamp = lastTimestamp + 1
          }
          const nextPoint: DataPoint = {
            date: new Date(pointTimestamp),
            [SERIES_KEY]: update.price,
          }

          next = [...next, nextPoint].slice(-MAX_POINTS)
          lastTimestamp = pointTimestamp
        }

        return next
      })

      setBaselinePrice(current => current ?? wsUpdatesForRender[0]?.price ?? null)
    }

    function handleError() {
      if (isActive) {
        setStatus('offline')
      }
    }

    function handleClose() {
      if (!isActive) {
        return
      }
      setStatus('offline')
      scheduleReconnect()
    }

    function connect() {
      if (!isActive || ws || document.hidden) {
        return
      }
      setStatus('connecting')
      ws = new WebSocket(resolvedWsUrl)
      ws.addEventListener('open', handleOpen)
      ws.addEventListener('message', handleMessage)
      ws.addEventListener('error', handleError)
      ws.addEventListener('close', handleClose)
    }

    function handleVisibilityChange() {
      if (!document.hidden) {
        if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
          ws = null
          connect()
        }
      }
    }

    connect()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      isActive = false
      setStatus('offline')
      clearReconnect()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (ws) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(buildSubscriptionPayload('unsubscribe'))
        }
        ws.removeEventListener('open', handleOpen)
        ws.removeEventListener('message', handleMessage)
        ws.removeEventListener('error', handleError)
        ws.removeEventListener('close', handleClose)
        ws.close()
      }
    }
  }, [config.event_type, config.topic, isLiveView, wsUrl, subscriptionSymbol])

  const series = useMemo<SeriesConfig[]>(
    () => ([{
      key: SERIES_KEY,
      name: config.display_symbol || config.display_name,
      color: liveColor,
    }]),
    [config.display_name, config.display_symbol, liveColor],
  )

  const chartWidth = useMemo(() => {
    if (!windowWidth) {
      return 900
    }
    if (isMobile) {
      return Math.max(320, windowWidth * 0.84)
    }
    return Math.min(windowWidth * 0.55, 900)
  }, [isMobile, windowWidth])

  const fallbackCurrentPrice = useMemo(() => {
    if (!referenceSnapshot) {
      return null
    }

    return normalizeLiveChartPrice(
      referenceSnapshot.latest_price ?? referenceSnapshot.closing_price ?? Number.NaN,
      config.topic,
    )
  }, [referenceSnapshot, config.topic])

  useEffect(() => {
    if (data.length > 0) {
      return
    }

    if (typeof fallbackCurrentPrice !== 'number' || !Number.isFinite(fallbackCurrentPrice) || fallbackCurrentPrice <= 0) {
      return
    }

    const fallbackTimestamp = Math.max(
      referenceSnapshot?.latest_source_timestamp_ms ?? nowMs,
      nowMs - LIVE_WINDOW_MS + 1000,
    )

    setData([{
      date: new Date(fallbackTimestamp),
      [SERIES_KEY]: fallbackCurrentPrice,
    }])
  }, [data.length, fallbackCurrentPrice, nowMs, referenceSnapshot?.latest_source_timestamp_ms])

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
  const tradingWindowStartMs = endTimestamp - tradingWindowMs
  const isTradingWindowActive = !isEventClosed && nowMs >= tradingWindowStartMs

  const renderData = useMemo(() => {
    if (!data.length) {
      return data
    }

    const cutoff = nowMs - LIVE_WINDOW_MS
    let next = keepWithinLiveWindow(data, cutoff)
    const lastPoint = next[next.length - 1]
    const lastPrice = lastPoint?.[SERIES_KEY]
    const lastTimestamp = lastPoint?.date?.getTime?.() ?? Number.NaN

    if (
      typeof lastPrice === 'number'
      && Number.isFinite(lastPrice)
      && Number.isFinite(lastTimestamp)
      && nowMs > lastTimestamp
    ) {
      next = [
        ...next,
        {
          date: new Date(nowMs),
          [SERIES_KEY]: lastPrice,
        },
      ].slice(-MAX_POINTS)
    }

    return next
  }, [data, nowMs])

  const lastPoint = renderData[renderData.length - 1]
  const currentPrice = typeof lastPoint?.[SERIES_KEY] === 'number'
    ? lastPoint[SERIES_KEY] as number
    : fallbackCurrentPrice
  const axisSourceData = data.length > 0 ? data : renderData
  const resolvedBaselinePrice = baselinePrice ?? referenceSnapshot?.opening_price ?? null
  const delta = currentPrice != null && resolvedBaselinePrice != null
    ? currentPrice - resolvedBaselinePrice
    : null
  const rawAxisValues = useMemo(() => {
    const values = axisSourceData
      .map(point => point[SERIES_KEY])
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))

    if (!values.length && typeof currentPrice === 'number' && Number.isFinite(currentPrice)) {
      values.push(currentPrice)
    }

    return buildAxis(values)
  }, [axisSourceData, currentPrice])
  const axisValues = rawAxisValues
  const currentLineTop = useMemo(() => {
    if (currentPrice == null) {
      return null
    }
    const chartHeight = LIVE_CHART_HEIGHT
    const marginTop = LIVE_CHART_MARGIN_TOP
    const marginBottom = LIVE_CHART_MARGIN_BOTTOM
    const innerHeight = chartHeight - marginTop - marginBottom
    const ratio = (currentPrice - axisValues.min) / Math.max(1e-6, axisValues.max - axisValues.min)
    const clamped = Math.max(0, Math.min(1, ratio))
    return marginTop + innerHeight - innerHeight * clamped
  }, [axisValues.max, axisValues.min, currentPrice])
  const targetLine = useMemo(() => {
    if (!isTradingWindowActive || resolvedBaselinePrice == null || !Number.isFinite(resolvedBaselinePrice)) {
      return null
    }

    const chartHeight = LIVE_CHART_HEIGHT
    const marginTop = LIVE_CHART_MARGIN_TOP
    const marginBottom = LIVE_CHART_MARGIN_BOTTOM
    const innerHeight = chartHeight - marginTop - marginBottom
    const ratio = (resolvedBaselinePrice - axisValues.min) / Math.max(1e-6, axisValues.max - axisValues.min)
    const clamped = Math.max(0, Math.min(1, ratio))

    return {
      top: marginTop + innerHeight - innerHeight * clamped,
      isAbove: ratio > 1,
      isBelow: ratio < 0,
    }
  }, [axisValues.max, axisValues.min, isTradingWindowActive, resolvedBaselinePrice])
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
  const shouldShowCountdown = !isEventClosed && countdown.totalSeconds > 0
  const xAxisTickValues = useMemo(() => {
    const startMs = nowMs - LIVE_WINDOW_MS
    const firstTickMs = Math.ceil(startMs / LIVE_X_AXIS_STEP_MS) * LIVE_X_AXIS_STEP_MS
    const ticks: Date[] = []

    for (let tickMs = firstTickMs; tickMs <= nowMs; tickMs += LIVE_X_AXIS_STEP_MS) {
      ticks.push(new Date(tickMs))
    }

    if (ticks.length >= 2) {
      return ticks
    }

    return [
      new Date(startMs),
      new Date(nowMs),
    ]
  }, [nowMs])
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
  const isMarketView = activeView === 'market'
  const isLiveChartView = activeView === 'live'
  const liveSwitchIconStyle = isLiveChartView
    ? {
        color: liveColor,
      }
    : undefined
  const switchThumbStyle = isLiveChartView
    ? {
        transform: 'translateX(2.25rem)',
        backgroundColor: hexToRgba(liveColor, 0.2),
      }
    : {
        transform: 'translateX(0)',
      }

  const viewSwitch = (
    <div className="relative z-0 flex items-center rounded-xl border border-border bg-background/70 p-1">
      <span
        className={cn(
          'pointer-events-none absolute top-1 left-1 z-0 size-9 rounded-lg transition-all duration-300 ease-out',
          !isLiveChartView && 'bg-primary/30',
        )}
        style={switchThumbStyle}
      />
      <button
        type="button"
        onClick={() => setActiveView('market')}
        className={cn(
          'relative z-1 flex size-9 items-center justify-center rounded-lg transition-colors',
          isMarketView
            ? 'text-primary'
            : 'bg-transparent text-muted-foreground hover:bg-muted',
        )}
        aria-label="Show market chart"
      >
        <ChartLineIcon className="size-5" />
      </button>
      <button
        type="button"
        onClick={() => setActiveView('live')}
        className={cn(
          'relative z-1 flex size-9 items-center justify-center rounded-lg transition-colors',
          !isLiveChartView && 'bg-transparent text-muted-foreground hover:bg-muted',
        )}
        style={liveSwitchIconStyle}
        aria-label="Show live chart"
      >
        {config.icon_path
          ? (
              <span
                className="block size-5 bg-current"
                aria-hidden
                style={{
                  WebkitMaskImage: `url(${config.icon_path})`,
                  maskImage: `url(${config.icon_path})`,
                  WebkitMaskPosition: 'center',
                  maskPosition: 'center',
                  WebkitMaskRepeat: 'no-repeat',
                  maskRepeat: 'no-repeat',
                  WebkitMaskSize: 'contain',
                  maskSize: 'contain',
                }}
              />
            )
          : <span className="size-2.5 rounded-full bg-current" />}
      </button>
    </div>
  )

  return (
    <div className="grid gap-4">
      {isLiveView
        ? (
            <div className="grid gap-1">
              <div className="flex flex-wrap items-end gap-4 pr-4 pl-0 sm:pr-6 sm:pl-0">
                <div className="flex flex-wrap items-end gap-5">
                  <div>
                    <div className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                      Price To Beat
                    </div>
                    <div className="mt-1 text-2xl leading-none font-semibold text-muted-foreground tabular-nums">
                      {resolvedBaselinePrice != null ? formatUsd(resolvedBaselinePrice, priceDisplayDigits) : '--'}
                    </div>
                  </div>
                  <div className="hidden h-10 w-px bg-border sm:block" />
                  <div>
                    <div
                      className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] uppercase"
                      style={{ color: liveColor }}
                    >
                      <span>Current Price</span>
                      {delta != null && (
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold ${delta >= 0
                          ? 'text-yes'
                          : 'text-no'}`}
                        >
                          <TriangleIcon
                            className={`size-3 ${delta >= 0 ? '' : 'rotate-180'}`}
                            fill="currentColor"
                            stroke="none"
                          />
                          {formatUsd(Math.abs(delta), priceDisplayDigits)}
                        </span>
                      )}
                    </div>
                    <div
                      className="mt-1 text-2xl leading-none font-semibold tabular-nums"
                      style={{ color: liveColor }}
                    >
                      {currentPrice != null ? formatUsd(currentPrice, priceDisplayDigits) : '--'}
                    </div>
                  </div>
                </div>
                {shouldShowCountdown && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="mr-[-4px] ml-auto grid justify-items-end gap-1 text-left sm:mr-[-6px]"
                      >
                        <div className="flex items-end gap-3">
                          {visibleCountdownUnits.map(({ unit, value }) => (
                            <div key={unit} className="min-w-11 text-right">
                              <div
                                className={cn(
                                  'text-2xl leading-none font-semibold tabular-nums',
                                  isTradingWindowActive ? 'text-red-500' : 'text-muted-foreground',
                                )}
                              >
                                <AnimatedCountdownValue value={value} />
                              </div>
                              <div
                                className="
                                  mt-1 text-2xs font-semibold tracking-[0.08em] text-muted-foreground uppercase
                                "
                              >
                                {countdownLabel(unit, value)}
                              </div>
                            </div>
                          ))}
                        </div>
                        <span className="sr-only">{status}</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent align="end" className="w-72 rounded-xl p-3 text-left">
                      <div className="grid gap-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="inline-flex items-center gap-2 text-red-500">
                            <span className="relative inline-flex size-2.5 items-center justify-center">
                              <span
                                className="
                                  absolute inset-0 m-auto inline-flex size-2.5 animate-ping rounded-full bg-red-500/45
                                "
                              />
                              <span
                                className="relative inline-flex size-2 rounded-full bg-red-500"
                              />
                            </span>
                            <span className="text-xs font-semibold tracking-[0.08em] uppercase">Live</span>
                          </div>
                          <div className="text-sm">
                            <span className="font-semibold text-foreground">{countdownLeftLabel}</span>
                            <span className="ml-1 text-muted-foreground">left</span>
                          </div>
                        </div>

                        <div className="text-xs text-muted-foreground">Resolution time</div>

                        <div className="grid gap-2 text-sm text-foreground">
                          <div className="flex items-center gap-2">
                            <span
                              className="
                                inline-flex h-6 min-w-9 items-center justify-center rounded-md bg-muted px-2 text-xs
                                font-semibold
                              "
                            >
                              ET
                            </span>
                            <span className="tabular-nums">{etDateLabel}</span>
                            <span className="ml-auto tabular-nums">{etTimeLabel}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className="
                                inline-flex h-6 min-w-9 items-center justify-center rounded-md bg-muted px-2 text-xs
                                font-semibold
                              "
                            >
                              UTC
                            </span>
                            <span className="tabular-nums">{utcDateLabel}</span>
                            <span className="ml-auto tabular-nums">{utcTimeLabel}</span>
                          </div>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>

              <div className="relative z-0 pr-4 pl-0 sm:pr-6 sm:pl-0">
                {targetLine && (
                  <div
                    className="pointer-events-none absolute right-4 left-0 z-1 sm:right-6"
                    style={{ top: `${targetLine.top}px` }}
                  >
                    <div
                      className="h-px w-full"
                      style={{
                        backgroundImage: `repeating-linear-gradient(
                          to right,
                          ${hexToRgba('#94a3b8', 0.9)} 0px,
                          ${hexToRgba('#94a3b8', 0.9)} 12px,
                          transparent 12px,
                          transparent 22px
                        )`,
                      }}
                    />
                    <span
                      className={`
                        absolute top-1/2 right-0 inline-flex -translate-y-1/2 items-center gap-1 rounded-r-sm bg-muted
                        px-1.5 py-0.5 pl-2 text-2xs font-semibold tracking-[0.08em] text-muted-foreground uppercase
                        [clip-path:polygon(8px_0,100%_0,100%_100%,8px_100%,0_50%)]
                      `}
                    >
                      <span>Target</span>
                      {targetLine.isAbove && <ChevronsUpIcon className="size-2.5 animate-pulse" />}
                      {targetLine.isBelow && <ChevronsDownIcon className="size-2.5 animate-pulse" />}
                    </span>
                  </div>
                )}
                {currentLineTop != null && (
                  <div
                    className="pointer-events-none absolute right-4 left-0 z-2 h-px sm:right-6"
                    style={{
                      top: `${currentLineTop}px`,
                      backgroundImage: `repeating-linear-gradient(
                        to right,
                        ${hexToRgba(liveColor, 0.88)} 0px,
                        ${hexToRgba(liveColor, 0.88)} 12px,
                        transparent 12px,
                        transparent 22px
                      )`,
                    }}
                  />
                )}
                <PredictionChart
                  data={renderData}
                  series={series}
                  width={chartWidth}
                  height={LIVE_CHART_HEIGHT}
                  margin={{
                    top: LIVE_CHART_MARGIN_TOP,
                    right: LIVE_CHART_MARGIN_RIGHT,
                    bottom: LIVE_CHART_MARGIN_BOTTOM,
                    left: LIVE_CHART_MARGIN_LEFT,
                  }}
                  dataSignature={`${event.id}:${config.topic}:${subscriptionSymbol}`}
                  xAxisTickCount={isMobile ? 2 : 4}
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
                  showLegend={false}
                  xAxisTickFontSize={13}
                  yAxisTickFontSize={13}
                  showXAxisTopRule
                  cursorGuideTop={LIVE_CURSOR_GUIDE_TOP}
                  disableCursorSplit
                  disableResetAnimation
                  markerOuterRadius={10}
                  markerInnerRadius={4.2}
                  lineStrokeWidth={2.15}
                  showAreaFill
                  areaFillTopOpacity={0.12}
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
                  lineCurve="basis"
                />
              </div>
            </div>
          )
        : (
            <EventChart
              event={event}
              isMobile={isMobile}
              seriesEvents={seriesEvents}
              showControls={false}
              showSeriesNavigation={false}
            />
          )}

      <EventSeriesPills
        currentEventSlug={event.slug}
        seriesEvents={seriesEvents}
        variant="live"
        rightSlot={viewSwitch}
      />
    </div>
  )
}
