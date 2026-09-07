import type { LeaderboardFilters } from '@/app/[locale]/(platform)/leaderboard/_utils/leaderboardFilters'
import type { BiggestWinEntry, LeaderboardEntry } from '@/app/[locale]/(platform)/leaderboard/_utils/leaderboardTypes'

import {
  resolveCategoryApiValue,
  resolveOrderApiValue,
  resolvePeriodApiValue,
} from '@/app/[locale]/(platform)/leaderboard/_utils/leaderboardFilters'

export const PAGE_SIZE = 20
export const LEADERBOARD_STALE_TIME = 5 * 60_000
export const LEADERBOARD_GC_TIME = 15 * 60_000

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

export function resolveLeaderboardProxyWallet(entry: object | null | undefined) {
  if (!entry || typeof entry !== 'object') {
    return ''
  }

  return resolveString(entry as Record<string, unknown>, [
    'proxyWallet',
    'proxy_wallet',
    'proxyAddress',
    'proxy_address',
    'proxyWalletAddress',
    'proxy_wallet_address',
    'user.proxyWallet',
    'user.proxy_wallet',
    'user.proxyAddress',
    'user.proxy_address',
    'user.proxyWalletAddress',
    'user.proxy_wallet_address',
    'user.address',
    'address',
    'walletAddress',
    'wallet',
  ])
}

export function buildFiltersKey(filters: LeaderboardFilters) {
  return `${filters.category}:${filters.period}:${filters.order}`
}

export function buildLeaderboardScopeKey(filters: LeaderboardFilters, searchQuery: string) {
  return `${buildFiltersKey(filters)}:${searchQuery}`
}

export function resolveLeaderboardApiUrl(dataApiUrl: string) {
  return dataApiUrl.endsWith('/v1') ? dataApiUrl : `${dataApiUrl}/v1`
}

function buildLeaderboardParams(filters: LeaderboardFilters, page: number, searchQuery?: string, userAddress?: string) {
  const params = new URLSearchParams({
    limit: String(userAddress ? 1 : PAGE_SIZE + 1),
    offset: String(userAddress ? 0 : (page - 1) * PAGE_SIZE),
    category: resolveCategoryApiValue(filters.category),
    timePeriod: resolvePeriodApiValue(filters.period),
    orderBy: resolveOrderApiValue(filters.order),
  })

  if (searchQuery) {
    params.set('userName', searchQuery)
  }
  if (userAddress) {
    params.set('user', userAddress)
  }

  return params
}

async function readLeaderboardResponse(response: Response, errorMessage: string) {
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null)
    throw new Error(errorBody?.error || errorMessage)
  }

  return normalizeLeaderboardResponse(await response.json())
}

export async function fetchLeaderboardEntries(
  leaderboardApiUrl: string,
  filters: LeaderboardFilters,
  searchQuery: string,
  page: number,
  signal: AbortSignal,
) {
  const params = buildLeaderboardParams(filters, page, searchQuery)
  const response = await fetch(`${leaderboardApiUrl}/leaderboard?${params.toString()}`, { signal })
  return readLeaderboardResponse(response, 'Failed to load leaderboard.')
}

export async function fetchLeaderboardUserEntry(
  leaderboardApiUrl: string,
  filters: LeaderboardFilters,
  userAddress: string,
  signal: AbortSignal,
) {
  const params = buildLeaderboardParams(filters, 1, undefined, userAddress)
  const response = await fetch(`${leaderboardApiUrl}/leaderboard?${params.toString()}`, { signal })
  const [entry] = await readLeaderboardResponse(response, 'Failed to load leaderboard user entry.')
  return entry ?? null
}

export async function fetchBiggestWins(
  leaderboardApiUrl: string,
  category: string,
  period: string,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({
    limit: '20',
    offset: '0',
    category,
    timePeriod: period,
  })

  const response = await fetch(`${leaderboardApiUrl}/biggest-winners?${params.toString()}`, { signal })
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null)
    throw new Error(errorBody?.error || 'Failed to load biggest winners.')
  }
  const result_2 = await response.json()
  return normalizeBiggestWinsResponse(result_2)
}
