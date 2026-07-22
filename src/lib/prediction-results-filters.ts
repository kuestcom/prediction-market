import type { EventListSortBy } from '@/lib/event-list-filters'

const PREDICTION_RESULTS_SORT_PARAM = '_sort'
const PREDICTION_RESULTS_STATUS_PARAM = '_status'

export type PredictionResultsSortOption = 'trending' | 'volume' | 'newest' | 'ending-soon'
export type PredictionResultsStatusOption = 'active' | 'resolved' | 'all'

export const DEFAULT_PREDICTION_RESULTS_SORT: PredictionResultsSortOption = 'trending'
export const DEFAULT_PREDICTION_RESULTS_STATUS: PredictionResultsStatusOption = 'active'

type PredictionResultsSearchParamsRecord = Record<string, string | string[] | undefined>

function normalizeRouteFilterValue(value: string | null | undefined) {
  return value
    ?.trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    ?? ''
}

export function parsePredictionResultsSort(value: string | null | undefined): PredictionResultsSortOption {
  const normalized = normalizeRouteFilterValue(value)

  if (normalized === 'volume' || normalized === 'total-volume') {
    return 'volume'
  }

  if (normalized === 'newest' || normalized === 'new') {
    return 'newest'
  }

  if (normalized === 'ending-soon' || normalized === 'endingsoon') {
    return 'ending-soon'
  }

  return DEFAULT_PREDICTION_RESULTS_SORT
}

export function parsePredictionResultsStatus(value: string | null | undefined): PredictionResultsStatusOption {
  const normalized = normalizeRouteFilterValue(value)

  if (normalized === 'resolved') {
    return 'resolved'
  }

  if (normalized === 'all') {
    return 'all'
  }

  return DEFAULT_PREDICTION_RESULTS_STATUS
}

export function resolvePredictionResultsApiSort(sort: PredictionResultsSortOption): EventListSortBy {
  switch (sort) {
    case 'volume':
      return 'volume'
    case 'newest':
      return 'created_at'
    case 'ending-soon':
      return 'end_date'
    case 'trending':
    default:
      return 'trending'
  }
}

export function resolvePredictionResultsRequestedApiSort({
  query,
  sort,
}: {
  query: string
  sort: PredictionResultsSortOption
}): EventListSortBy | undefined {
  if (query.trim() && sort === DEFAULT_PREDICTION_RESULTS_SORT) {
    return undefined
  }

  return resolvePredictionResultsApiSort(sort)
}

function resolveSearchParamValue(value: string | string[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function hasSearchParamsMethods(
  searchParams: PredictionResultsSearchParamsRecord | Pick<URLSearchParams, 'get'>,
): searchParams is Pick<URLSearchParams, 'get'> {
  return typeof searchParams.get === 'function'
}

export function resolvePredictionResultsFiltersFromSearchParams(
  searchParams:
    | PredictionResultsSearchParamsRecord
    | Pick<URLSearchParams, 'get'>
    | null
    | undefined,
) {
  if (!searchParams) {
    return {
      sort: DEFAULT_PREDICTION_RESULTS_SORT,
      status: DEFAULT_PREDICTION_RESULTS_STATUS,
    }
  }

  if (hasSearchParamsMethods(searchParams)) {
    return {
      sort: parsePredictionResultsSort(searchParams.get(PREDICTION_RESULTS_SORT_PARAM)),
      status: parsePredictionResultsStatus(searchParams.get(PREDICTION_RESULTS_STATUS_PARAM)),
    }
  }

  return {
    sort: parsePredictionResultsSort(resolveSearchParamValue(searchParams[PREDICTION_RESULTS_SORT_PARAM])),
    status: parsePredictionResultsStatus(resolveSearchParamValue(searchParams[PREDICTION_RESULTS_STATUS_PARAM])),
  }
}

export function buildPredictionResultsUrlSearchParams(
  source: URLSearchParams | { toString: () => string } | string,
  filters: {
    sort: PredictionResultsSortOption
    status: PredictionResultsStatusOption
  },
) {
  const params = new URLSearchParams(typeof source === 'string' ? source : source.toString())

  if (filters.sort === DEFAULT_PREDICTION_RESULTS_SORT) {
    params.delete(PREDICTION_RESULTS_SORT_PARAM)
  }
  else {
    params.set(PREDICTION_RESULTS_SORT_PARAM, filters.sort)
  }

  if (filters.status === DEFAULT_PREDICTION_RESULTS_STATUS) {
    params.delete(PREDICTION_RESULTS_STATUS_PARAM)
  }
  else {
    params.set(PREDICTION_RESULTS_STATUS_PARAM, filters.status)
  }

  return params
}
