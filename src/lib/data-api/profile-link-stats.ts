import { normalizeAddress } from '@/lib/wallet'

export interface ProfileLinkStats {
  positions: number
  profitLoss: number
  volume: string | null
  positionsValue: number
  biggestWin: number
}

const DATA_API_URL = process.env.DATA_URL!

const CACHE_TTL_MS = 5 * 60 * 1000
const CACHE_MAX_ENTRIES = 200

interface CacheEntry {
  value?: ProfileLinkStats | null
  promise?: Promise<ProfileLinkStats | null>
  expiresAt: number
}

const statsCache = new Map<string, CacheEntry>()

function pruneCache(now: number) {
  for (const [key, entry] of statsCache.entries()) {
    if (entry.expiresAt <= now) {
      statsCache.delete(key)
    }
  }

  while (statsCache.size > CACHE_MAX_ENTRIES) {
    const oldestKey = statsCache.keys().next().value
    if (!oldestKey) {
      break
    }
    statsCache.delete(oldestKey)
  }
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function parseTradedCount(body: unknown): number {
  if (!body) {
    return 0
  }

  if (typeof body === 'object' && 'traded' in body) {
    return toNumber((body as { traded?: unknown }).traded) ?? 0
  }

  return toNumber(body) ?? 0
}

function parsePortfolioValue(body: unknown): number {
  if (!body) {
    return 0
  }

  if (Array.isArray(body)) {
    return toNumber(body[0]?.value ?? body[0]) ?? 0
  }

  if (typeof body === 'object' && body !== null && 'value' in body) {
    return toNumber((body as { value?: unknown }).value) ?? 0
  }

  return toNumber(body) ?? 0
}

function parseVolume(body: unknown): string | null {
  if (!body) {
    return null
  }

  if (typeof body === 'object') {
    const candidate = body as {
      volume?: unknown
      total_volume?: unknown
      totalVolume?: unknown
      tradedVolume?: unknown
    }
    const resolved = candidate.volume
      ?? candidate.total_volume
      ?? candidate.totalVolume
      ?? candidate.tradedVolume
    return parseVolumeValue(resolved)
  }

  return parseVolumeValue(body)
}

function parseVolumeValue(value: unknown): string | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value.toString() : null
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed || null
  }

  return null
}

async function fetchJson(url: string, signal?: AbortSignal) {
  const response = await fetch(url, { signal })

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }

  return await response.json()
}

export async function fetchProfileLinkStats(
  userAddress?: string | null,
  signal?: AbortSignal,
): Promise<ProfileLinkStats | null> {
  if (!DATA_API_URL) {
    return null
  }

  const address = normalizeAddress(userAddress)
  if (!address) {
    return null
  }

  const cacheKey = address.toLowerCase()
  const now = Date.now()
  pruneCache(now)
  const cached = statsCache.get(cacheKey)
  if (cached) {
    if (cached.expiresAt <= now) {
      statsCache.delete(cacheKey)
    }
    else if (cached.promise) {
      return await cached.promise
    }
    else if ('value' in cached) {
      return cached.value ?? null
    }
  }

  const request = (async () => {
    try {
      const activeParams = new URLSearchParams({
        user: address,
        limit: '100',
        offset: '0',
        sizeThreshold: '0.01',
        sortDirection: 'DESC',
      })
      const closedParams = new URLSearchParams({
        user: address,
        limit: '100',
        offset: '0',
        sortBy: 'TIMESTAMP',
        sortDirection: 'DESC',
        sizeThreshold: '0.01',
      })
      const valueUrl = `${DATA_API_URL}/value?user=${encodeURIComponent(address)}`
      const tradedUrl = `${DATA_API_URL}/traded?user=${encodeURIComponent(address)}`
      const volumeUrl = `${DATA_API_URL}/volume?user=${encodeURIComponent(address)}`

      const [valueResult, activePositionsResult, closedPositionsResult, tradedResult, volumeResult] = await Promise.allSettled([
        fetchJson(valueUrl, signal),
        fetchJson(`${DATA_API_URL}/positions?${activeParams.toString()}`, signal),
        fetchJson(`${DATA_API_URL}/closed-positions?${closedParams.toString()}`, signal),
        fetchJson(tradedUrl, signal),
        fetchJson(volumeUrl, signal),
      ])

      const activePositions = activePositionsResult.status === 'fulfilled'
        && Array.isArray(activePositionsResult.value)
        ? activePositionsResult.value
        : []

      const closedPositions = closedPositionsResult.status === 'fulfilled'
        && Array.isArray(closedPositionsResult.value)
        ? closedPositionsResult.value
        : []

      const tradedCount = tradedResult.status === 'fulfilled'
        ? parseTradedCount(tradedResult.value)
        : 0

      const volume = volumeResult.status === 'fulfilled'
        ? parseVolume(volumeResult.value)
        : null

      const positionsValue = valueResult.status === 'fulfilled'
        ? parsePortfolioValue(valueResult.value)
        : 0

      const positions = tradedCount || (activePositions.length + closedPositions.length)

      const profitLossActive = activePositions.reduce(
        (total, position) => total + (toNumber((position as any).cashPnl) ?? 0),
        0,
      )
      const profitLossClosed = closedPositions.reduce(
        (total, position) => total + (toNumber((position as any).realizedPnl) ?? 0),
        0,
      )
      const biggestWin = closedPositions.reduce((max, position) => {
        const realized = toNumber((position as any).realizedPnl) ?? 0
        return realized > max ? realized : max
      }, 0)

      return {
        positions,
        profitLoss: profitLossActive + profitLossClosed,
        volume,
        positionsValue,
        biggestWin,
      }
    }
    catch (error) {
      console.error('Failed to fetch profile link stats', error)
      return null
    }
  })()

  statsCache.set(cacheKey, { promise: request, expiresAt: now + CACHE_TTL_MS })
  const result = await request
  if (signal?.aborted) {
    statsCache.delete(cacheKey)
    return null
  }
  statsCache.set(cacheKey, { value: result, expiresAt: Date.now() + CACHE_TTL_MS })
  return result
}
