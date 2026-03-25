import type { EventListSortBy } from '@/lib/event-list-filters'

export const PREDICTION_RESULTS_SORT_PARAM = '_sort'
export const PREDICTION_RESULTS_STATUS_PARAM = '_status'
export const PREDICTION_RESULTS_INTERNAL_ROUTE_SEGMENT = 'route-filters'

export const PREDICTION_RESULTS_SORT_OPTIONS = [
  'trending',
  'volume',
  'newest',
  'ending-soon',
  'competitive',
] as const

export const PREDICTION_RESULTS_STATUS_OPTIONS = [
  'active',
  'resolved',
  'all',
] as const

export type PredictionResultsSortOption = typeof PREDICTION_RESULTS_SORT_OPTIONS[number]
export type PredictionResultsStatusOption = typeof PREDICTION_RESULTS_STATUS_OPTIONS[number]

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

function trimTrailingSlash(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1)
  }

  return pathname
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

  if (normalized === 'competitive') {
    return 'competitive'
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
    case 'competitive':
    case 'trending':
    default:
      return 'trending'
  }
}

export function hasPredictionResultsFilterSearchParams(searchParams: Pick<URLSearchParams, 'has'>) {
  return searchParams.has(PREDICTION_RESULTS_SORT_PARAM) || searchParams.has(PREDICTION_RESULTS_STATUS_PARAM)
}

export function buildPredictionResultsInternalRoutePath(
  pathname: string,
  filters: {
    sort: PredictionResultsSortOption
    status: PredictionResultsStatusOption
  },
) {
  const normalizedPathname = trimTrailingSlash(pathname)

  return [
    normalizedPathname,
    PREDICTION_RESULTS_INTERNAL_ROUTE_SEGMENT,
    filters.status,
    filters.sort,
  ].join('/')
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

export function resolvePredictionResultsRequestedApiStatus({
  query,
  status,
}: {
  query: string
  status: PredictionResultsStatusOption
}): PredictionResultsStatusOption {
  if (!query.trim() && status === 'resolved') {
    return 'all'
  }

  return status
}

function resolveSearchParamValue(value: string | string[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function serializePredictionResultsSearchParams(searchParams: PredictionResultsSearchParamsRecord) {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        params.append(key, item)
      }
      continue
    }

    if (value !== undefined) {
      params.append(key, value)
    }
  }

  return params.toString()
}

function hasSearchParamsMethods(
  searchParams: PredictionResultsSearchParamsRecord | Pick<URLSearchParams, 'get' | 'toString'>,
): searchParams is Pick<URLSearchParams, 'get' | 'toString'> {
  return typeof searchParams.get === 'function'
}

export function resolvePredictionResultsFiltersFromSearchParams(
  searchParams:
    | PredictionResultsSearchParamsRecord
    | Pick<URLSearchParams, 'get' | 'toString'>
    | null
    | undefined,
) {
  if (!searchParams) {
    return {
      searchParamsString: '',
      sort: DEFAULT_PREDICTION_RESULTS_SORT,
      status: DEFAULT_PREDICTION_RESULTS_STATUS,
    }
  }

  if (hasSearchParamsMethods(searchParams)) {
    return {
      searchParamsString: searchParams.toString(),
      sort: parsePredictionResultsSort(searchParams.get(PREDICTION_RESULTS_SORT_PARAM)),
      status: parsePredictionResultsStatus(searchParams.get(PREDICTION_RESULTS_STATUS_PARAM)),
    }
  }

  return {
    searchParamsString: serializePredictionResultsSearchParams(searchParams),
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
