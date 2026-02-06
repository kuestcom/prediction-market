'use client'

import type { Event } from '@/types'
import type { DataPoint, SeriesConfig } from '@/types/PredictionChartTypes'
import { BitcoinIcon, ChartLineIcon, ChevronDownIcon, TriangleIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import PredictionChart from '@/components/PredictionChart'
import { useWindowSize } from '@/hooks/useWindowSize'
import { formatCurrency } from '@/lib/formatters'
import EventChart from './EventChart'

const WS_URL = 'wss://ws-live-data.kuest.com'
const SERIES_KEY = 'btc'
const WINDOW_MS = 70 * 1000
const CHART_HEIGHT = 332
const CHART_MARGIN = { top: 30, right: 40, bottom: 52, left: 0 }
const SUBSCRIBE_PAYLOAD = {
  action: 'subscribe',
  subscriptions: [
    { topic: 'activity', type: 'orders_matched', filters: '{"event_slug":"btc-updown-15m-1770396300"}' },
    { topic: 'comments', type: '*', filters: '{"parentEntityID":10192,"parentEntityType":"Series"}' },
    { topic: 'crypto_prices_chainlink', type: 'update', filters: '{"symbol":"btc/usd"}' },
  ],
} as const

function normalizeTimestamp(value: unknown) {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) {
    return Date.now()
  }
  return numeric < 1e12 ? numeric * 1000 : numeric
}

function normalizeSymbol(value: unknown) {
  if (typeof value !== 'string') {
    return ''
  }
  return value.toLowerCase().replace(/\s/g, '').replace('_', '/').replace('-', '/')
}

function symbolLooksLikeBtc(symbol: string) {
  if (!symbol) {
    return false
  }
  return symbol.includes('btc') && (symbol.includes('usd') || symbol.includes('usdt'))
}

function extractPointFromArray(entries: any[]) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return null
  }

  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const point = entries[index]
    if (!point || typeof point !== 'object') {
      continue
    }
    const price = Number(point.value ?? point.price ?? point.p)
    if (!Number.isFinite(price) || price <= 0) {
      continue
    }
    const timestamp = normalizeTimestamp(point.timestamp ?? point.ts ?? point.t)
    return { price, timestamp }
  }

  return null
}

type ExtractResult = { price: number, timestamp: number, symbol: string } | null | false

function isPriceTopic(value: unknown) {
  return value === 'crypto_prices_chainlink' || value === 'crypto_prices'
}

function extractBtcUpdate(payload: any): ExtractResult {
  if (!payload || typeof payload !== 'object') {
    return false
  }

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

  let sawPriceTopic = false
  let sawBtcSymbol = false

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') {
      continue
    }

    const topic = candidate.topic ?? candidate?.data?.topic ?? candidate?.stream
    if (isPriceTopic(topic)) {
      sawPriceTopic = true
    }

    if (Array.isArray(candidate?.data)) {
      const extracted = extractPointFromArray(candidate.data)
      if (extracted) {
        return { ...extracted, symbol: 'btc/usd' }
      }
    }

    if (Array.isArray(candidate?.payload?.data)) {
      const extracted = extractPointFromArray(candidate.payload.data)
      if (extracted) {
        return { ...extracted, symbol: 'btc/usd' }
      }
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
    const symbol = normalizeSymbol(rawSymbol)
    if (symbolLooksLikeBtc(symbol)) {
      sawBtcSymbol = true
    }

    if (topic && !isPriceTopic(topic) && !symbolLooksLikeBtc(symbol)) {
      continue
    }

    const rawPrice = candidate?.data?.price
      ?? candidate?.price
      ?? candidate?.data?.value
      ?? candidate?.data?.p
      ?? candidate?.p
      ?? candidate?.payload?.value
    const price = Number(rawPrice)
    if (!Number.isFinite(price) || price <= 0) {
      continue
    }

    const rawTimestamp = candidate?.data?.timestamp
      ?? candidate?.timestamp
      ?? candidate?.data?.ts
      ?? candidate?.ts
      ?? candidate?.data?.t
      ?? candidate?.t
      ?? candidate?.payload?.timestamp

    return {
      price,
      timestamp: normalizeTimestamp(rawTimestamp),
      symbol: symbol || 'btc/usd',
    }
  }

  if (!sawPriceTopic && !sawBtcSymbol) {
    return false
  }

  return null
}

function buildAxis(values: number[]) {
  if (!values.length) {
    return { min: 0, max: 1, ticks: [0, 1] }
  }

  const minValue = Math.min(...values)
  const maxValue = Math.max(...values)
  const span = Math.max(1, maxValue - minValue)
  const padding = Math.max(5, span * 0.12)
  const rawMin = minValue - padding
  const rawMax = maxValue + padding

  const targetTicks = 5
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

export function shouldUseLiveBtcChart(event: Event) {
  const has15mTag = (event.tags ?? []).some(tag =>
    (tag.name ?? tag.slug ?? '').toLowerCase() === '15m',
  )
  return has15mTag
}

interface EventLiveBtcChartProps {
  event: Event
  isMobile: boolean
}

export default function EventLiveBtcChart({ event, isMobile }: EventLiveBtcChartProps) {
  const { width: windowWidth } = useWindowSize()
  const [data, setData] = useState<DataPoint[]>([])
  const [baselinePrice, setBaselinePrice] = useState<number | null>(null)
  const [activeView, setActiveView] = useState<'live' | 'market'>('live')
  const isLiveView = activeView === 'live'

  useEffect(() => {
    if (!isLiveView) {
      return
    }
    let ws: WebSocket | null = null
    let pingInterval: number | null = null
    let reconnectTimeout: number | null = null
    let isActive = true

    function clearTimers() {
      if (pingInterval) {
        window.clearInterval(pingInterval)
        pingInterval = null
      }
      if (reconnectTimeout) {
        window.clearTimeout(reconnectTimeout)
        reconnectTimeout = null
      }
    }

    function scheduleReconnect() {
      if (!isActive) {
        return
      }
      reconnectTimeout = window.setTimeout(connect, 1500)
    }

    function handleOpen() {
      if (!ws) {
        return
      }
      ws.send(JSON.stringify(SUBSCRIBE_PAYLOAD))
      pingInterval = window.setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ action: 'ping' }))
        }
      }, 5000)
    }

    function handleMessage(event: MessageEvent<string>) {
      if (!isActive) {
        return
      }

      let payload: any
      try {
        payload = JSON.parse(event.data)
      }
      catch {
        return
      }

      const update = extractBtcUpdate(payload)
      if (update === false || !update) {
        return
      }

      setData((prev) => {
        const nextPoint: DataPoint = {
          date: new Date(update.timestamp),
          [SERIES_KEY]: update.price,
        }

        const cutoff = update.timestamp - WINDOW_MS
        const trimmed = prev.filter(point => point.date.getTime() >= cutoff)

        if (!trimmed.length) {
          return [nextPoint]
        }

        const lastPoint = trimmed[trimmed.length - 1]
        const lastTimestamp = lastPoint.date.getTime()

        if (update.timestamp === lastTimestamp) {
          return [...trimmed.slice(0, -1), nextPoint]
        }

        if (update.timestamp < lastTimestamp) {
          return trimmed
        }

        return [...trimmed, nextPoint]
      })

      setBaselinePrice(current => current ?? update.price)
    }

    function handleClose() {
      clearTimers()
      scheduleReconnect()
    }

    function handleError() {
      if (ws) {
        ws.close()
      }
    }

    function attachListeners(socket: WebSocket) {
      socket.addEventListener('open', handleOpen)
      socket.addEventListener('message', handleMessage)
      socket.addEventListener('close', handleClose)
      socket.addEventListener('error', handleError)
    }

    function detachListeners(socket: WebSocket) {
      socket.removeEventListener('open', handleOpen)
      socket.removeEventListener('message', handleMessage)
      socket.removeEventListener('close', handleClose)
      socket.removeEventListener('error', handleError)
    }

    function connect() {
      if (!isActive) {
        return
      }
      ws = new WebSocket(WS_URL)
      attachListeners(ws)
    }

    connect()

    return () => {
      isActive = false
      clearTimers()
      if (ws) {
        detachListeners(ws)
        ws.close()
      }
    }
  }, [isLiveView])

  const series = useMemo<SeriesConfig[]>(
    () => ([{ key: SERIES_KEY, name: 'BTC', color: '#FF9900' }]),
    [],
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

  const lastPoint = data[data.length - 1]
  const currentPrice = typeof lastPoint?.[SERIES_KEY] === 'number' ? lastPoint[SERIES_KEY] as number : null
  const priceToBeat = baselinePrice
  const delta = currentPrice != null && priceToBeat != null
    ? currentPrice - priceToBeat
    : null
  const axisValues = useMemo(() => {
    const values = data
      .map(point => point[SERIES_KEY])
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    return buildAxis(values)
  }, [data])

  const currentLineTop = useMemo(() => {
    if (currentPrice == null) {
      return null
    }
    const innerHeight = CHART_HEIGHT - CHART_MARGIN.top - CHART_MARGIN.bottom
    const ratio = (currentPrice - axisValues.min) / Math.max(1e-6, axisValues.max - axisValues.min)
    const clamped = Math.max(0, Math.min(1, ratio))
    return CHART_MARGIN.top + innerHeight - innerHeight * clamped
  }, [axisValues.max, axisValues.min, currentPrice])

  function formatUsd(value: number, digits = 2) {
    return formatCurrency(value, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })
  }

  const viewSwitch = (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-background/60 p-1">
      <button
        type="button"
        onClick={() => setActiveView('market')}
        className={`
          flex size-8 items-center justify-center rounded-lg transition-colors
          ${activeView === 'market'
      ? 'bg-primary/15 text-primary'
      : 'text-muted-foreground hover:text-foreground'}
        `}
      >
        <ChartLineIcon className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => setActiveView('live')}
        className={`
          flex size-8 items-center justify-center rounded-lg transition-colors
          ${activeView === 'live'
      ? 'bg-[#FF9900]/15 text-[#FF9900]'
      : 'text-muted-foreground hover:text-foreground'}
        `}
      >
        <BitcoinIcon className="size-4" />
      </button>
    </div>
  )

  return (
    <div className="grid gap-4">
      {isLiveView
        ? (
            <>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex flex-wrap items-end gap-5">
                  <div>
                    <div className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                      Price To Beat
                    </div>
                    <div className="mt-1 text-2xl leading-none font-semibold text-muted-foreground tabular-nums">
                      {priceToBeat != null ? formatUsd(priceToBeat, 2) : '--'}
                    </div>
                  </div>
                  <div className="hidden h-10 w-px bg-border sm:block" />
                  <div>
                    <div className={`
                      flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] text-foreground uppercase
                    `}
                    >
                      <span>Current Price</span>
                      {delta != null && (
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold ${delta >= 0
                          ? `text-emerald-500`
                          : `text-red-500`}`}
                        >
                          <TriangleIcon
                            className={`size-3 ${delta >= 0 ? '' : 'rotate-180'}`}
                            fill="currentColor"
                            stroke="none"
                          />
                          {formatUsd(Math.abs(delta), 0)}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-3xl leading-none font-semibold text-foreground tabular-nums">
                      {currentPrice != null ? formatUsd(currentPrice, 2) : '--'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative px-4 sm:px-6">
                {currentLineTop != null && (
                  <div
                    className={`
                      pointer-events-none absolute right-4 left-4 border-t border-dashed border-[#FF9900]/50
                      sm:right-6 sm:left-6
                    `}
                    style={{ top: `${currentLineTop}px` }}
                  />
                )}

                <PredictionChart
                  data={data}
                  series={series}
                  width={chartWidth}
                  height={CHART_HEIGHT}
                  margin={CHART_MARGIN}
                  dataSignature="btc-live-15m"
                  cursorStepMs={1000}
                  tooltipDatePlacement="inside"
                  tooltipHeader={{
                    iconSrc: '/images/deposit/crypto/btc.svg',
                    iconAlt: 'BTC',
                    color: '#FF9900',
                    valueFormatter: value => formatUsd(value, 2),
                  }}
                  xAxisTickFormatter={date => date.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                  showVerticalGrid={false}
                  showHorizontalGrid
                  showLegend={false}
                  yAxis={{
                    min: axisValues.min,
                    max: axisValues.max,
                    ticks: axisValues.ticks,
                    tickFormat: value => formatUsd(value, 0),
                  }}
                  tooltipValueFormatter={value => formatUsd(value, 2)}
                />
              </div>
            </>
          )
        : (
            <EventChart event={event} isMobile={isMobile} showControls={false} />
          )}

      <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className={`
            flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-foreground
          `}
          >
            <span>Past</span>
            <ChevronDownIcon className="size-3.5 text-muted-foreground" />
            <span className="mx-1 h-4 w-px bg-border" />
            <div className="flex items-center gap-1">
              <span className="inline-flex size-5 items-center justify-center rounded-full bg-red-500 text-white">
                <TriangleIcon className="size-3 rotate-180" fill="currentColor" stroke="none" />
              </span>
              <span className="inline-flex size-5 items-center justify-center rounded-full bg-emerald-500/50 text-white">
                <TriangleIcon className="size-3" fill="currentColor" stroke="none" />
              </span>
              <span className="inline-flex size-5 items-center justify-center rounded-full bg-red-500/50 text-white">
                <TriangleIcon className="size-3 rotate-180" fill="currentColor" stroke="none" />
              </span>
              <span className="inline-flex size-5 items-center justify-center rounded-full bg-emerald-500/50 text-white">
                <TriangleIcon className="size-3" fill="currentColor" stroke="none" />
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className={`
              flex items-center gap-2 rounded-full bg-foreground px-3 py-1.5 text-xs font-semibold text-background
            `}
            >
              <span className="relative inline-flex size-2.5 items-center justify-center">
                <span className="absolute inline-flex size-2.5 rounded-full bg-red-500 opacity-40" />
                <span className="inline-flex size-1.5 rounded-full bg-red-500" />
              </span>
              <span>2:30</span>
              <span className="text-[10px]">PM</span>
            </div>
            <div className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">2:45 PM</div>
            <div className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">3:00 PM</div>
            <div className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">3:15 PM</div>
            <div className={`
              inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-xs font-semibold
              text-muted-foreground
            `}
            >
              <span>More</span>
              <ChevronDownIcon className="size-3.5" />
            </div>
          </div>
        </div>

        {viewSwitch}
      </div>
    </div>
  )
}
