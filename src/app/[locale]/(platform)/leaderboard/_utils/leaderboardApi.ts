import type { LeaderboardFilters } from '@/app/[locale]/(platform)/leaderboard/_utils/leaderboardFilters'
import type {
  BiggestWinEntry,
  LeaderboardEntry,
  TimeframePnlBatchResponse,
} from '@/app/[locale]/(platform)/leaderboard/_utils/leaderboardTypes'

const DATA_API_URL = process.env.DATA_URL!
export const LEADERBOARD_API_URL = DATA_API_URL.endsWith('/v1') ? DATA_API_URL : `${DATA_API_URL}/v1`
export const PAGE_SIZE = 20
export const BIGGEST_WINS_CACHE = new Map<string, BiggestWinEntry[]>()
export const BIGGEST_WINS_IN_FLIGHT = new Map<string, Promise<BiggestWinEntry[]>>()

export const LIST_ROW_COLUMNS = 'grid-cols-[minmax(0,1fr)_7.5rem] md:grid-cols-[minmax(0,1fr)_7.5rem_7.5rem]'

export function normalizeLeaderboardResponse(payload: unknown): LeaderboardEntry[] {
  if (Array.isArray(payload)) {
    return payload as LeaderboardEntry[]
  }

  if (!payload || typeof payload !== 'object') {
    return []
  }

  const data = (payload as { data?: unknown }).data
  if (Array.isArray(data)) {
    return data as LeaderboardEntry[]
  }

  const nested = (payload as { leaderboard?: unknown }).leaderboard
  if (Array.isArray(nested)) {
    return nested as LeaderboardEntry[]
  }

  return []
}

function normalizeBiggestWinsResponse(payload: unknown): BiggestWinEntry[] {
  if (Array.isArray(payload)) {
    return payload as BiggestWinEntry[]
  }

  if (!payload || typeof payload !== 'object') {
    return []
  }

  const data = (payload as { data?: unknown }).data
  if (Array.isArray(data)) {
    return data as BiggestWinEntry[]
  }

  const nested = (payload as { wins?: unknown }).wins
  if (Array.isArray(nested)) {
    return nested as BiggestWinEntry[]
  }

  return []
}

function getNestedValue(entry: Record<string, unknown>, path: string) {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (!acc || typeof acc !== 'object') {
      return undefined
    }
    return (acc as Record<string, unknown>)[key]
  }, entry)
}

export function resolveString(entry: Record<string, unknown>, paths: string[]) {
  for (const path of paths) {
    const value = getNestedValue(entry, path)
    if (typeof value === 'string' && value.trim()) {
      return value
    }
  }
  return ''
}

export function resolveNumber(entry: Record<string, unknown>, paths: string[]) {
  for (const path of paths) {
    const value = getNestedValue(entry, path)
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) {
        return parsed
      }
    }
  }
  return undefined
}

export function normalizeWalletAddress(value?: string) {
  return (value ?? '').trim().toLowerCase()
}

export function buildFiltersKey(filters: LeaderboardFilters) {
  return `${filters.category}:${filters.period}:${filters.order}`
}

export function buildLeaderboardScopeKey(filters: LeaderboardFilters, searchQuery: string) {
  return `${buildFiltersKey(filters)}:${searchQuery}`
}

export async function fetchBiggestWins(category: string, period: string) {
  const params = new URLSearchParams({
    limit: '20',
    offset: '0',
    category,
    timePeriod: period,
  })

  const response = await fetch(`${LEADERBOARD_API_URL}/biggest-winners?${params.toString()}`)
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null)
    throw new Error(errorBody?.error || 'Failed to load biggest winners.')
  }
  const result_2 = await response.json()
  return normalizeBiggestWinsResponse(result_2)
}

async function fetchTimeframePnlBatch(
  userAddresses: string[],
  period: LeaderboardFilters['period'],
  signal: AbortSignal,
): Promise<Map<string, number>> {
  const response = await fetch('/api/leaderboard/timeframe-pnl', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      period,
      addresses: userAddresses,
    }),
    signal,
  })

  if (!response.ok) {
    return new Map()
  }

  const payload = await response.json() as TimeframePnlBatchResponse
  if (!payload || typeof payload !== 'object' || !payload.values || typeof payload.values !== 'object') {
    return new Map()
  }

  const values = new Map<string, number>()
  for (const [address, rawValue] of Object.entries(payload.values)) {
    const normalizedAddress = normalizeWalletAddress(address)
    if (!normalizedAddress) {
      continue
    }
    if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
      values.set(normalizedAddress, rawValue)
    }
  }

  return values
}

export async function hydrateEntriesWithPortfolioPnl(
  entries: LeaderboardEntry[],
  filters: LeaderboardFilters,
  signal: AbortSignal,
): Promise<LeaderboardEntry[]> {
  if (entries.length === 0) {
    return entries
  }

  if (filters.category !== 'overall') {
    return entries
  }

  const addresses = Array.from(
    new Set(
      entries
        .map(entry => normalizeWalletAddress(entry.proxyWallet))
        .filter(address => address.length > 0),
    ),
  )

  if (addresses.length === 0) {
    return entries
  }

  const pnlByAddress = await fetchTimeframePnlBatch(addresses, filters.period, signal).catch(() => new Map())

  if (pnlByAddress.size === 0) {
    return entries
  }

  return entries.map((entry) => {
    const address = normalizeWalletAddress(entry.proxyWallet)
    const pnl = pnlByAddress.get(address)
    if (typeof pnl !== 'number') {
      return entry
    }
    return { ...entry, pnl }
  })
}

export function sortEntriesForDisplay(
  entries: LeaderboardEntry[],
  filters: LeaderboardFilters,
  page: number,
): LeaderboardEntry[] {
  if (entries.length === 0 || filters.category !== 'overall' || filters.order !== 'profit') {
    return entries
  }

  const sorted = [...entries].sort((left, right) => {
    const leftPnl = Number.isFinite(left.pnl) ? Number(left.pnl) : Number.NEGATIVE_INFINITY
    const rightPnl = Number.isFinite(right.pnl) ? Number(right.pnl) : Number.NEGATIVE_INFINITY
    if (leftPnl !== rightPnl) {
      return rightPnl - leftPnl
    }

    return normalizeWalletAddress(left.proxyWallet).localeCompare(normalizeWalletAddress(right.proxyWallet))
  })

  const rankOffset = (page - 1) * PAGE_SIZE
  return sorted.map((entry, index) => ({
    ...entry,
    rank: String(rankOffset + index + 1),
  }))
}
