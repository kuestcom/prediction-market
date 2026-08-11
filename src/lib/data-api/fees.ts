import { buildDataApiUrl, normalizeDataApiAddress } from '@/lib/data-api/client'

export interface FeeReceiverTotal {
  exchange: string
  receiver: string
  tokenId: string
  feeType?: FeeHistoryType
  totalAmount: string
  totalVolume: string
  updatedAt: number
}

export type FeeHistoryType = 'BUILDER' | 'AFFILIATE'

export interface FeeHistoryTotal {
  address: string
  feeType: FeeHistoryType
  interval: 'all'
  totalAmount: string
  eventCount: number
}

export interface FeeHistoryTimeSeries {
  address: string
  feeType: FeeHistoryType
  interval: '1m'
  bucket: 'day'
  items: Array<{ timestamp: number; amount: string; eventCount: number }>
}

interface FeeReceiverTotalsParams {
  endpoint: 'referrers'
  address: string
  feeType?: FeeHistoryType
  exchange?: string
  tokenId?: string
  limit?: number
  offset?: number
}

export async function fetchFeeReceiverTotals({
  endpoint,
  address,
  feeType,
  exchange,
  tokenId,
  limit = 100,
  offset = 0,
}: FeeReceiverTotalsParams): Promise<FeeReceiverTotal[]> {
  const params = new URLSearchParams()
  params.set('address', normalizeDataApiAddress(address))
  if (feeType) {
    params.set('feeType', feeType)
  }
  if (exchange) {
    params.set('exchange', normalizeDataApiAddress(exchange))
  }
  if (tokenId) {
    params.set('tokenId', tokenId)
  }
  params.set('limit', Math.min(Math.max(limit, 1), 500).toString())
  params.set('offset', Math.max(offset, 0).toString())

  const response = await fetch(buildDataApiUrl(`/${endpoint}`, params), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Data API request failed: ${endpoint} (${response.status})`)
  }

  return response.json() as Promise<FeeReceiverTotal[]>
}

export async function fetchFeeHistoryTotal(address: string, feeType: FeeHistoryType): Promise<FeeHistoryTotal> {
  const params = new URLSearchParams({
    address: normalizeDataApiAddress(address),
    feeType,
    interval: 'all',
  })
  const response = await fetch(buildDataApiUrl('/fees/total', params), {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!response.ok) {
    throw new Error(`Data API fee total request failed (${response.status})`)
  }
  return response.json() as Promise<FeeHistoryTotal>
}

export async function fetchFeeHistoryTimeSeries(
  address: string,
  feeType: FeeHistoryType,
): Promise<FeeHistoryTimeSeries> {
  const params = new URLSearchParams({
    address: normalizeDataApiAddress(address),
    feeType,
    interval: '1m',
  })
  const response = await fetch(buildDataApiUrl('/fees/timeseries', params), {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!response.ok) {
    throw new Error(`Data API fee time-series request failed (${response.status})`)
  }
  return response.json() as Promise<FeeHistoryTimeSeries>
}

export function combineDailyFeeSeries(series: FeeHistoryTimeSeries[], now = new Date()) {
  const byDate = new Map<string, bigint>()
  for (const result of series) {
    for (const item of result.items) {
      const date = new Date(item.timestamp * 1000).toISOString().slice(0, 10)
      try {
        byDate.set(date, (byDate.get(date) ?? 0n) + BigInt(item.amount))
      } catch (error) {
        console.warn('Ignoring malformed Data API fee history amount.', {
          amount: item.amount,
          error,
          feeType: result.feeType,
          timestamp: item.timestamp,
        })
      }
    }
  }

  const currentDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Array.from({ length: 30 }, (_, index) => {
    const timestamp = currentDay - (29 - index) * 86_400_000
    const date = new Date(timestamp).toISOString().slice(0, 10)
    return { date, value: baseUnitsToNumber(byDate.get(date) ?? 0n, 6) }
  })
}

export function combineAvailableDailyFeeSeries(
  results: Array<PromiseSettledResult<FeeHistoryTimeSeries>>,
  now = new Date(),
) {
  const availableSeries = results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []))
  if (availableSeries.length === 0) {
    return []
  }
  return combineDailyFeeSeries(availableSeries, now)
}

function parseDecimalFeeValue(value: string): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function sumFeeTotals(totals: FeeReceiverTotal[]): number {
  return totals.reduce((acc, total) => {
    return acc + parseDecimalFeeValue(total.totalAmount)
  }, 0)
}

export function sumFeeVolumes(totals: FeeReceiverTotal[]): number {
  return totals.reduce((acc, total) => {
    return acc + parseDecimalFeeValue(total.totalVolume)
  }, 0)
}

export function baseUnitsToNumber(amount: bigint, decimals = 6): number {
  if (decimals <= 0) {
    return Number(amount)
  }
  return Number(amount) / 10 ** decimals
}
