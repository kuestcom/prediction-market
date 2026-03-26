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
  minAmountFilter?: string
  signal?: AbortSignal
}

export const EVENT_ACTIVITY_PAGE_SIZE = 10

export async function fetchEventTrades({
  marketIds,
  pageParam,
  minAmountFilter,
  signal,
}: FetchEventTradesParams): Promise<ActivityOrder[]> {
  const markets = Array.from(new Set(marketIds.filter(Boolean)))
  if (markets.length === 0) {
    throw new Error('At least one market id is required to load event activity.')
  }

  const parsedFilterAmount = Number(minAmountFilter)
  const hasFilterAmount = Number.isFinite(parsedFilterAmount) && parsedFilterAmount > 0
  const minAmountMicro = hasFilterAmount ? Number(toMicro(parsedFilterAmount)) : undefined

  if (IS_BROWSER) {
    const params = new URLSearchParams({
      limit: EVENT_ACTIVITY_PAGE_SIZE.toString(),
      offset: pageParam.toString(),
      market: markets.join(','),
      takerOnly: 'false',
    })

    if (hasFilterAmount) {
      params.set('filterAmount', parsedFilterAmount.toString())
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

    return filterActivitiesByMinAmount(result as ActivityOrder[], minAmountMicro)
  }

  const params = new URLSearchParams({
    limit: EVENT_ACTIVITY_PAGE_SIZE.toString(),
    offset: pageParam.toString(),
    market: markets.join(','),
    takerOnly: 'false',
  })

  if (hasFilterAmount) {
    params.set('filterType', 'CASH')
    params.set('filterAmount', parsedFilterAmount.toString())
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
  return filterActivitiesByMinAmount(activities, minAmountMicro)
}
