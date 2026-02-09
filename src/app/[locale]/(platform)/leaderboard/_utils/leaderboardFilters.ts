export const CATEGORY_OPTIONS = [
  { value: 'overall', label: 'All Categories', apiValue: 'overall' },
  { value: 'politics', label: 'Politics', apiValue: 'politics' },
  { value: 'sports', label: 'Sports', apiValue: 'sports' },
  { value: 'crypto', label: 'Crypto', apiValue: 'crypto' },
  { value: 'finance', label: 'Finance', apiValue: 'finance' },
  { value: 'culture', label: 'Culture', apiValue: 'culture' },
  { value: 'mentions', label: 'Mentions', apiValue: 'mentions' },
  { value: 'weather', label: 'Weather', apiValue: 'weather' },
  { value: 'economics', label: 'Economics', apiValue: 'economics' },
  { value: 'tech', label: 'Tech', apiValue: 'tech' },
] as const

export const PERIOD_OPTIONS = [
  { value: 'today', label: 'Today', apiValue: 'day' },
  { value: 'weekly', label: 'Weekly', apiValue: 'week' },
  { value: 'monthly', label: 'Monthly', apiValue: 'month' },
  { value: 'all', label: 'All', apiValue: 'all' },
] as const

export const ORDER_OPTIONS = [
  { value: 'profit', label: 'Profit/Loss', apiValue: 'PNL' },
  { value: 'volume', label: 'Volume', apiValue: 'VOL' },
] as const

export type CategoryValue = typeof CATEGORY_OPTIONS[number]['value']
export type PeriodValue = typeof PERIOD_OPTIONS[number]['value']
export type OrderValue = typeof ORDER_OPTIONS[number]['value']

export interface LeaderboardFilters {
  category: CategoryValue
  period: PeriodValue
  order: OrderValue
}

export const DEFAULT_FILTERS: LeaderboardFilters = {
  category: 'overall',
  period: 'monthly',
  order: 'profit',
}

const CATEGORY_VALUES = new Set<CategoryValue>(CATEGORY_OPTIONS.map(option => option.value))
const PERIOD_VALUES = new Set<PeriodValue>(PERIOD_OPTIONS.map(option => option.value))
const ORDER_VALUES = new Set<OrderValue>(ORDER_OPTIONS.map(option => option.value))

function normalizeSegment(segment?: string | null) {
  if (!segment) {
    return null
  }

  const normalized = segment.trim().toLowerCase()
  return normalized || null
}

function normalizeCategorySegment(segment?: string | null) {
  const normalized = normalizeSegment(segment)
  if (!normalized) {
    return null
  }

  if (normalized === 'all' || normalized === 'all-categories') {
    return 'overall'
  }

  return normalized
}

export function parseLeaderboardFilters(segments?: string[] | null): LeaderboardFilters {
  const [categorySegment, periodSegment, orderSegment] = segments ?? []
  const normalizedCategory = normalizeCategorySegment(categorySegment)
  const normalizedPeriod = normalizeSegment(periodSegment)
  const normalizedOrder = normalizeSegment(orderSegment)

  const category = CATEGORY_VALUES.has(normalizedCategory as CategoryValue)
    ? (normalizedCategory as CategoryValue)
    : DEFAULT_FILTERS.category
  const period = PERIOD_VALUES.has(normalizedPeriod as PeriodValue)
    ? (normalizedPeriod as PeriodValue)
    : DEFAULT_FILTERS.period
  const order = ORDER_VALUES.has(normalizedOrder as OrderValue)
    ? (normalizedOrder as OrderValue)
    : DEFAULT_FILTERS.order

  return { category, period, order }
}

export function buildLeaderboardPath(filters: LeaderboardFilters) {
  return `/leaderboard/${filters.category}/${filters.period}/${filters.order}`
}

export function resolveCategoryApiValue(value: CategoryValue) {
  return CATEGORY_OPTIONS.find(option => option.value === value)?.apiValue ?? 'OVERALL'
}

export function resolvePeriodApiValue(value: PeriodValue) {
  return PERIOD_OPTIONS.find(option => option.value === value)?.apiValue ?? 'DAY'
}

export function resolveOrderApiValue(value: OrderValue) {
  return ORDER_OPTIONS.find(option => option.value === value)?.apiValue ?? 'PNL'
}
