import type { Market } from '@/types'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { OUTCOME_INDEX } from '@/lib/constants'

export type TimeRange = '1H' | '6H' | '1D' | '1W' | '1M' | 'ALL'

interface PriceHistoryPoint {
  t: number
  p: number
}

interface PriceHistoryResponse {
  history?: PriceHistoryPoint[]
}

export interface MarketTokenTarget {
  conditionId: string
  tokenId: string
}

interface RangeFilters {
  fidelity: string
  interval?: string
  startTs?: string
  endTs?: string
}

type PriceHistoryByMarket = Record<string, PriceHistoryPoint[]>

interface NormalizedHistoryResult {
  points: Array<Record<string, number | Date> & { date: Date }>
  latestSnapshot: Record<string, number>
  latestRawPrices: Record<string, number>
}

const RANGE_CONFIG: Record<Exclude<TimeRange, 'ALL'>, { interval: string, fidelity: number }> = {
  '1H': { interval: '1h', fidelity: 1 },
  '6H': { interval: '6h', fidelity: 1 },
  '1D': { interval: '1d', fidelity: 5 },
  '1W': { interval: '1w', fidelity: 30 },
  '1M': { interval: '1m', fidelity: 180 },
}
const ALL_FIDELITY = 720
const RANGE_WINDOW_SECONDS: Record<Exclude<TimeRange, 'ALL'>, number> = {
  '1H': 60 * 60,
  '6H': 6 * 60 * 60,
  '1D': 24 * 60 * 60,
  '1W': 7 * 24 * 60 * 60,
  '1M': 30 * 24 * 60 * 60,
}

export const TIME_RANGES: TimeRange[] = ['1H', '6H', '1D', '1W', '1M', 'ALL']
export const MINUTE_MS = 60 * 1000
export const HOUR_MS = 60 * MINUTE_MS
export const CURSOR_STEP_MS: Record<TimeRange, number> = {
  'ALL': 12 * HOUR_MS,
  '1M': 3 * HOUR_MS,
  '1W': 30 * MINUTE_MS,
  '1D': 5 * MINUTE_MS,
  '6H': MINUTE_MS,
  '1H': MINUTE_MS,
}
const PRICE_REFRESH_INTERVAL_MS = 60_000

function resolveCreatedRange(createdAt: string) {
  const created = new Date(createdAt)
  const createdSeconds = Number.isFinite(created.getTime())
    ? Math.floor(created.getTime() / 1000)
    : Math.floor(Date.now() / 1000) - (60 * 60 * 24 * 30)
  const nowSeconds = Math.max(createdSeconds + 60, Math.floor(Date.now() / 1000))
  const ageSeconds = Math.max(0, nowSeconds - createdSeconds)
  return { createdSeconds, nowSeconds, ageSeconds }
}

function resolveFidelityForSpan(spanSeconds: number) {
  if (spanSeconds <= 2 * 24 * 60 * 60) {
    return 5
  }
  if (spanSeconds <= 7 * 24 * 60 * 60) {
    return 30
  }
  if (spanSeconds <= 30 * 24 * 60 * 60) {
    return 180
  }
  return ALL_FIDELITY
}

function buildTimeRangeFilters(range: TimeRange, createdAt: string): RangeFilters {
  if (range === 'ALL') {
    const { createdSeconds, nowSeconds, ageSeconds } = resolveCreatedRange(createdAt)

    return {
      fidelity: resolveFidelityForSpan(ageSeconds).toString(),
      startTs: createdSeconds.toString(),
      endTs: nowSeconds.toString(),
    }
  }

  const config = RANGE_CONFIG[range]
  if (range === '1D' || range === '1W' || range === '1M') {
    const { createdSeconds, nowSeconds, ageSeconds } = resolveCreatedRange(createdAt)
    const windowSeconds = RANGE_WINDOW_SECONDS[range]

    if (ageSeconds < windowSeconds) {
      return {
        fidelity: resolveFidelityForSpan(ageSeconds).toString(),
        startTs: createdSeconds.toString(),
        endTs: nowSeconds.toString(),
      }
    }
  }

  return {
    fidelity: config.fidelity.toString(),
    interval: config.interval,
  }
}

async function fetchTokenPriceHistory(tokenId: string, filters: RangeFilters): Promise<PriceHistoryPoint[]> {
  const url = new URL(`${process.env.CLOB_URL!}/prices-history`)
  url.searchParams.set('market', tokenId)

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.set(key, value)
    }
  })

  const response = await fetch(url.toString(), { cache: 'no-store' })
  if (!response.ok) {
    throw new Error('Failed to fetch price history')
  }

  const payload = await response.json() as PriceHistoryResponse
  return (payload.history ?? [])
    .map(point => ({
      t: Number(point.t),
      p: Number(point.p),
    }))
    .filter(point => Number.isFinite(point.t) && Number.isFinite(point.p))
}

async function fetchEventPriceHistory(
  targets: MarketTokenTarget[],
  range: TimeRange,
  eventCreatedAt: string,
): Promise<PriceHistoryByMarket> {
  if (!targets.length) {
    return {}
  }

  const filters = buildTimeRangeFilters(range, eventCreatedAt)
  const entries = await Promise.all(
    targets.map(async (target) => {
      try {
        const history = await fetchTokenPriceHistory(target.tokenId, filters)
        return [target.conditionId, history] as const
      }
      catch {
        return [target.conditionId, []] as const
      }
    }),
  )

  return Object.fromEntries(entries)
}

function clampPrice(value: number) {
  if (!Number.isFinite(value)) {
    return 0
  }
  if (value < 0) {
    return 0
  }
  if (value > 1) {
    return 1
  }
  return value
}

export function buildNormalizedHistory(historyByMarket: PriceHistoryByMarket): NormalizedHistoryResult {
  const timeline = new Map<number, Map<string, number>>()
  Object.entries(historyByMarket).forEach(([conditionId, history]) => {
    history.forEach((point) => {
      const timestampMs = Math.floor(point.t) * 1000
      if (!timeline.has(timestampMs)) {
        timeline.set(timestampMs, new Map())
      }
      timeline.get(timestampMs)!.set(conditionId, clampPrice(point.p))
    })
  })

  const sortedTimestamps = Array.from(timeline.keys()).sort((a, b) => a - b)
  const lastKnownPrice = new Map<string, number>()
  const points: NormalizedHistoryResult['points'] = []
  const latestRawPrices: Record<string, number> = {}

  sortedTimestamps.forEach((timestamp) => {
    const updates = timeline.get(timestamp)
    updates?.forEach((price, marketKey) => {
      lastKnownPrice.set(marketKey, price)
    })

    if (!lastKnownPrice.size) {
      return
    }

    const point: Record<string, number | Date> & { date: Date } = { date: new Date(timestamp) }

    lastKnownPrice.forEach((price, marketKey) => {
      latestRawPrices[marketKey] = price
      point[marketKey] = price * 100
    })
    points.push(point)
  })

  const latestSnapshot: Record<string, number> = {}
  const latestPoint = points[points.length - 1]
  if (latestPoint) {
    Object.entries(latestPoint).forEach(([key, value]) => {
      if (key !== 'date' && typeof value === 'number' && Number.isFinite(value)) {
        latestSnapshot[key] = value
      }
    })
  }

  return { points, latestSnapshot, latestRawPrices }
}

interface UseEventPriceHistoryParams {
  eventId: string
  range: TimeRange
  targets: MarketTokenTarget[]
  eventCreatedAt: string
}

export function useEventPriceHistory({
  eventId,
  range,
  targets,
  eventCreatedAt,
}: UseEventPriceHistoryParams) {
  const tokenSignature = useMemo(
    () => targets.map(target => `${target.conditionId}:${target.tokenId}`).sort().join(','),
    [targets],
  )

  const { data: priceHistoryByMarket } = useQuery({
    queryKey: ['event-price-history', eventId, range, tokenSignature],
    queryFn: () => fetchEventPriceHistory(targets, range, eventCreatedAt),
    enabled: targets.length > 0,
    staleTime: PRICE_REFRESH_INTERVAL_MS,
    gcTime: PRICE_REFRESH_INTERVAL_MS,
    refetchInterval: PRICE_REFRESH_INTERVAL_MS,
    refetchIntervalInBackground: true,
    placeholderData: keepPreviousData,
  })

  const normalizedHistory = useMemo(
    () => buildNormalizedHistory(priceHistoryByMarket ?? {}),
    [priceHistoryByMarket],
  )

  return {
    normalizedHistory: normalizedHistory.points,
    latestSnapshot: normalizedHistory.latestSnapshot,
    latestRawPrices: normalizedHistory.latestRawPrices,
  }
}

export function buildMarketTargets(
  markets: Market[],
  outcomeIndex: typeof OUTCOME_INDEX.YES | typeof OUTCOME_INDEX.NO = OUTCOME_INDEX.YES,
): MarketTokenTarget[] {
  return markets
    .map((market) => {
      const matchingOutcome = market.outcomes.find(outcome => outcome.outcome_index === outcomeIndex)
        ?? market.outcomes[0]
      if (!matchingOutcome?.token_id) {
        return null
      }
      return {
        conditionId: market.condition_id,
        tokenId: matchingOutcome.token_id,
      }
    })
    .filter((target): target is MarketTokenTarget => target !== null)
}
