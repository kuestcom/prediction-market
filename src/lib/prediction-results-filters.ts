import type { EventListSortBy } from '@/lib/event-list-filters'

export const PREDICTION_RESULTS_SORT_PARAM = '_sort'
export const PREDICTION_RESULTS_STATUS_PARAM = '_status'

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
] as const

export type PredictionResultsSortOption = typeof PREDICTION_RESULTS_SORT_OPTIONS[number]
export type PredictionResultsStatusOption = typeof PREDICTION_RESULTS_STATUS_OPTIONS[number]

export const DEFAULT_PREDICTION_RESULTS_SORT: PredictionResultsSortOption = 'trending'
export const DEFAULT_PREDICTION_RESULTS_STATUS: PredictionResultsStatusOption = 'active'

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

export function buildPredictionResultsUrlSearchParams(
  source: URLSearchParams | { toString: () => string } | string,
  filters: {
    sort: PredictionResultsSortOption
    status: PredictionResultsStatusOption
  },
) {
  const params = new URLSearchParams(typeof source === 'string' ? source : source.toString())
  params.set(PREDICTION_RESULTS_SORT_PARAM, filters.sort)
  params.set(PREDICTION_RESULTS_STATUS_PARAM, filters.status)
  return params
}
