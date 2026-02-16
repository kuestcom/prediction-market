import { NextResponse } from 'next/server'

type Interval = '5m' | '15m' | '1h' | '4h' | '1d'
type Source = 'chainlink' | 'massive'

interface SeriesMapItem {
  series_slug: string
  instrument: string
  interval: Interval
  source: Source
  display_name: string
  display_symbol: string
}

interface PriceReferenceSeriesMapResponse {
  series?: SeriesMapItem[]
}

interface PriceReferenceLastFinal {
  window_start_ms: number
  window_end_ms: number
  price: number
  source: Source
  source_timestamp_ms: number
  source_ref: string | null
  status: string
}

interface PriceReferenceNextWindow {
  window_start_ms: number
  window_end_ms: number
  opening_reference_price: number
}

interface PriceReferenceLatestMarket {
  instrument: string
  interval: Interval
  source: Source
  display_name: string
  display_symbol: string
  last_final: PriceReferenceLastFinal | null
  next_window: PriceReferenceNextWindow | null
}

interface PriceReferenceLatestResponse {
  markets?: PriceReferenceLatestMarket[]
}

interface PriceReferenceHistoryRow {
  instrument: string
  interval: Interval
  window_start_ms: number
  window_end_ms: number
  settlement_price: number
  source: Source
  source_timestamp_ms: number
  source_ref: string | null
  status: string
}

interface PriceReferenceHistoryResponse {
  rows?: PriceReferenceHistoryRow[]
}

const PRICE_REFERENCE_BASE_URL = 'https://price-reference.kuest.com'
const SERIES_MAP_TTL_MS = 5 * 60 * 1000

let seriesMapBySlugCache = new Map<string, SeriesMapItem>()
let seriesMapCachedAtMs = 0

function intervalToMs(interval: Interval) {
  switch (interval) {
    case '5m':
      return 5 * 60 * 1000
    case '15m':
      return 15 * 60 * 1000
    case '1h':
      return 60 * 60 * 1000
    case '4h':
      return 4 * 60 * 60 * 1000
    case '1d':
      return 24 * 60 * 60 * 1000
  }
}

function alignWindowEnd(timestampMs: number, intervalMs: number) {
  return Math.floor(timestampMs / intervalMs) * intervalMs
}

function toFiniteNumber(value: unknown) {
  const numeric = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: {
      accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`price-reference request failed: ${response.status} ${url}`)
  }

  return response.json() as Promise<T>
}

async function getSeriesMapBySlug() {
  const nowMs = Date.now()
  if (nowMs - seriesMapCachedAtMs < SERIES_MAP_TTL_MS && seriesMapBySlugCache.size > 0) {
    return seriesMapBySlugCache
  }

  const payload = await fetchJson<PriceReferenceSeriesMapResponse>(`${PRICE_REFERENCE_BASE_URL}/series-map`)
  const nextCache = new Map<string, SeriesMapItem>()

  for (const item of payload.series ?? []) {
    const slug = item.series_slug?.trim().toLowerCase()
    if (!slug) {
      continue
    }
    nextCache.set(slug, item)
  }

  seriesMapBySlugCache = nextCache
  seriesMapCachedAtMs = nowMs

  return seriesMapBySlugCache
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const seriesSlugParam = searchParams.get('seriesSlug')?.trim() ?? ''
  const eventEndMsParam = searchParams.get('eventEndMs')?.trim() ?? ''

  if (!seriesSlugParam) {
    return NextResponse.json({ error: 'seriesSlug is required' }, { status: 400 })
  }

  const eventEndMs = Number.parseInt(eventEndMsParam, 10)
  if (!Number.isFinite(eventEndMs) || eventEndMs <= 0) {
    return NextResponse.json({ error: 'eventEndMs is required and must be a positive unix millisecond timestamp' }, { status: 400 })
  }

  try {
    const normalizedSeriesSlug = seriesSlugParam.toLowerCase()
    const seriesMapBySlug = await getSeriesMapBySlug()
    const seriesEntry = seriesMapBySlug.get(normalizedSeriesSlug)

    if (!seriesEntry) {
      return NextResponse.json({ error: `series_slug not configured in price-reference: ${normalizedSeriesSlug}` }, { status: 404 })
    }

    const intervalMs = intervalToMs(seriesEntry.interval)
    const eventWindowEndMs = alignWindowEnd(eventEndMs, intervalMs)
    const eventWindowStartMs = eventWindowEndMs - intervalMs

    const historyParams = new URLSearchParams({
      instrument: seriesEntry.instrument,
      interval: seriesEntry.interval,
      from: String(Math.max(0, eventWindowEndMs - intervalMs * 3)),
      to: String(eventWindowEndMs),
      limit: '8',
    })

    const [latestPayload, historyPayload] = await Promise.all([
      fetchJson<PriceReferenceLatestResponse>(`${PRICE_REFERENCE_BASE_URL}/marks/latest`),
      fetchJson<PriceReferenceHistoryResponse>(`${PRICE_REFERENCE_BASE_URL}/marks/history?${historyParams.toString()}`),
    ])

    const latestMarket = (latestPayload.markets ?? []).find(market =>
      market.instrument === seriesEntry.instrument
      && market.interval === seriesEntry.interval
      && market.source === seriesEntry.source,
    )

    const historyRows = (historyPayload.rows ?? [])
      .filter(row =>
        row.instrument === seriesEntry.instrument
        && row.interval === seriesEntry.interval
        && row.source === seriesEntry.source,
      )
      .slice()
      .sort((a, b) => b.window_end_ms - a.window_end_ms)

    const windowRow = historyRows.find(row => row.window_end_ms === eventWindowEndMs)
    const openingWindowEndMs = eventWindowStartMs
    const openingRow = historyRows.find(row => row.window_end_ms === openingWindowEndMs)
      ?? historyRows.find(row => row.window_end_ms < eventWindowEndMs)

    const openingFromHistory = toFiniteNumber(openingRow?.settlement_price)
    const openingFromLatest = latestMarket?.next_window?.window_end_ms === eventWindowEndMs
      ? toFiniteNumber(latestMarket.next_window.opening_reference_price)
      : null

    const openingPrice = openingFromHistory ?? openingFromLatest
    const closingPrice = toFiniteNumber(windowRow?.settlement_price)
    const latestPrice = toFiniteNumber(latestMarket?.last_final?.price)
    const latestWindowEndMs = toFiniteNumber(latestMarket?.last_final?.window_end_ms)
    const latestSourceTimestampMs = toFiniteNumber(latestMarket?.last_final?.source_timestamp_ms)

    return NextResponse.json({
      series_slug: seriesEntry.series_slug,
      instrument: seriesEntry.instrument,
      interval: seriesEntry.interval,
      source: seriesEntry.source,
      interval_ms: intervalMs,
      event_window_start_ms: eventWindowStartMs,
      event_window_end_ms: eventWindowEndMs,
      opening_price: openingPrice,
      closing_price: closingPrice,
      latest_price: latestPrice,
      latest_window_end_ms: latestWindowEndMs,
      latest_source_timestamp_ms: latestSourceTimestampMs,
      is_event_closed: Date.now() >= eventWindowEndMs,
    })
  }
  catch (error) {
    console.error('Failed to build live-series price snapshot', error)
    return NextResponse.json({ error: 'Failed to load price reference snapshot' }, { status: 500 })
  }
}
