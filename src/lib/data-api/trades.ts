import type { DataApiActivity } from '@/lib/data-api/user'
import type { ActivityOrder } from '@/types'

import { filterActivitiesByMinAmount } from '@/lib/activity/filter'
import { IS_BROWSER } from '@/lib/constants'
import { buildDataApiUrl } from '@/lib/data-api/client'
import { mapDataApiActivityToActivityOrder } from '@/lib/data-api/user'
import { toMicro } from '@/lib/formatters'

interface FetchEventTradesParams {
  marketIds: string[]
  pageParam: number
  pageSize?: number
  cursorTimestamp?: number
  cursorId?: string
  cursorUser?: string
  minAmountFilter?: string
  start?: number
  signal?: AbortSignal
}

export const EVENT_ACTIVITY_PAGE_SIZE = 10
export const EVENT_ACTIVITY_REFRESH_SIZE = 50
const EVENT_ACTIVITY_MARKETS_PER_REQUEST = 50
const EVENT_ACTIVITY_BATCH_CONCURRENCY = 4

export async function fetchEventTrades({
  marketIds,
  pageParam,
  pageSize = EVENT_ACTIVITY_PAGE_SIZE,
  cursorTimestamp,
  cursorId,
  cursorUser,
  minAmountFilter,
  start,
  signal,
}: FetchEventTradesParams): Promise<ActivityOrder[]> {
  const markets = Array.from(new Set(marketIds.filter(Boolean)))
  if (markets.length === 0) {
    throw new Error('At least one market id is required to load event activity.')
  }

  const parsedFilterAmount = Number(minAmountFilter)
  const hasFilterAmount = Number.isFinite(parsedFilterAmount) && parsedFilterAmount > 0
  const minAmountMicro = hasFilterAmount ? Number(toMicro(parsedFilterAmount)) : undefined
  const requestedPageSize = Number.isFinite(pageSize) ? Math.trunc(pageSize) : EVENT_ACTIVITY_PAGE_SIZE
  const normalizedPageSize = Math.min(Math.max(requestedPageSize, 1), EVENT_ACTIVITY_REFRESH_SIZE)
  const normalizedCursorTimestamp =
    Number.isFinite(cursorTimestamp) && Number(cursorTimestamp) > 0 ? Math.trunc(Number(cursorTimestamp)) : undefined
  const normalizedCursorId = cursorId?.trim()
  const normalizedCursorUser = cursorUser?.trim().toLowerCase()
  const hasCursorInput = cursorTimestamp !== undefined || Boolean(cursorId) || Boolean(cursorUser)
  const hasCursor =
    normalizedCursorTimestamp !== undefined && Boolean(normalizedCursorId) && Boolean(normalizedCursorUser)
  if (hasCursorInput && !hasCursor) {
    throw new Error('cursorTimestamp, cursorId, and cursorUser must be provided together.')
  }

  const marketBatches = Array.from(
    { length: Math.ceil(markets.length / EVENT_ACTIVITY_MARKETS_PER_REQUEST) },
    (_, index) =>
      markets.slice(index * EVENT_ACTIVITY_MARKETS_PER_REQUEST, (index + 1) * EVENT_ACTIVITY_MARKETS_PER_REQUEST),
  )
  const pages = await mapWithConcurrency(marketBatches, EVENT_ACTIVITY_BATCH_CONCURRENCY, (batch) =>
    fetchEventTradesBatch({
      markets: batch,
      pageParam,
      normalizedPageSize,
      normalizedCursorTimestamp,
      normalizedCursorId,
      normalizedCursorUser,
      hasFilterAmount,
      parsedFilterAmount,
      start,
      signal,
    }),
  )
  const deduped = new Map<string, ActivityOrder>()
  for (const activity of pages.flat()) {
    if (!deduped.has(activity.id)) {
      deduped.set(activity.id, activity)
    }
  }
  const merged = [...deduped.values()].sort((a, b) => {
    const timestamp = new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    if (timestamp !== 0) {
      return timestamp
    }
    const eventId = compareRawDescending(String(a.event_id || a.id), String(b.event_id || b.id))
    if (eventId !== 0) {
      return eventId
    }
    return compareRawDescending(
      String(a.user.address || a.user.id).toLowerCase(),
      String(b.user.address || b.user.id).toLowerCase(),
    )
  })
  return filterActivitiesByMinAmount(merged.slice(0, normalizedPageSize), minAmountMicro)
}

function compareRawDescending(left: string, right: string): number {
  if (left === right) {
    return 0
  }
  return left > right ? -1 : 1
}

async function mapWithConcurrency<Input, Output>(
  items: Input[],
  concurrency: number,
  mapper: (item: Input) => Promise<Output>,
): Promise<Output[]> {
  const results = Array.from({ length: items.length }) as Output[]
  let nextIndex = 0
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await mapper(items[index])
    }
  })
  await Promise.all(workers)
  return results
}

async function fetchEventTradesBatch({
  markets,
  pageParam,
  normalizedPageSize,
  normalizedCursorTimestamp,
  normalizedCursorId,
  normalizedCursorUser,
  hasFilterAmount,
  parsedFilterAmount,
  start,
  signal,
}: {
  markets: string[]
  pageParam: number
  normalizedPageSize: number
  normalizedCursorTimestamp?: number
  normalizedCursorId?: string
  normalizedCursorUser?: string
  hasFilterAmount: boolean
  parsedFilterAmount: number
  start?: number
  signal?: AbortSignal
}): Promise<ActivityOrder[]> {
  if (IS_BROWSER) {
    const params = new URLSearchParams({
      limit: normalizedPageSize.toString(),
      offset: pageParam.toString(),
      market: markets.join(','),
      takerOnly: 'false',
    })

    if (hasFilterAmount) {
      params.set('filterAmount', parsedFilterAmount.toString())
    }
    if (Number.isFinite(start) && Number(start) > 0) {
      params.set('start', Math.trunc(Number(start)).toString())
    }
    if (normalizedCursorTimestamp !== undefined && normalizedCursorId && normalizedCursorUser) {
      params.set('cursorTimestamp', normalizedCursorTimestamp.toString())
      params.set('cursorId', normalizedCursorId)
      params.set('cursorUser', normalizedCursorUser)
    }

    const response = await fetch(`/api/event-activity?${params.toString()}`, { signal })

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null)
      const errorMessage = errorBody?.error || 'Failed to load event activity.'
      throw new Error(errorMessage)
    }

    const result = await response.json()
    if (!Array.isArray(result)) {
      throw new TypeError('Unexpected response from event activity API.')
    }

    return result as ActivityOrder[]
  }

  const params = new URLSearchParams({
    limit: normalizedPageSize.toString(),
    offset: pageParam.toString(),
    market: markets.join(','),
    takerOnly: 'false',
  })

  if (hasFilterAmount) {
    params.set('filterType', 'CASH')
    params.set('filterAmount', parsedFilterAmount.toString())
  }
  if (Number.isFinite(start) && Number(start) > 0) {
    params.set('start', Math.trunc(Number(start)).toString())
  }
  if (normalizedCursorTimestamp !== undefined && normalizedCursorId && normalizedCursorUser) {
    params.set('cursorTimestamp', normalizedCursorTimestamp.toString())
    params.set('cursorId', normalizedCursorId)
    params.set('cursorUser', normalizedCursorUser)
  }

  const response = await fetch(buildDataApiUrl('/trades', params), { signal })

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null)
    const errorMessage = errorBody?.error || 'Failed to load event activity.'
    throw new Error(errorMessage)
  }

  const result = await response.json()
  if (!Array.isArray(result)) {
    throw new TypeError('Unexpected response from data service.')
  }

  const activities = (result as DataApiActivity[]).map(mapDataApiActivityToActivityOrder)
  return activities
}
