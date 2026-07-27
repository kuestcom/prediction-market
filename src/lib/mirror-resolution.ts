import type { Market } from '@/types'

export type MirrorResolutionType = 'chainlink' | 'uma'

function parseMetadata(market: Market): Record<string, unknown> {
  if (!market.metadata) {
    return {}
  }
  if (typeof market.metadata === 'string') {
    try {
      const parsed = JSON.parse(market.metadata) as unknown
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {}
    }
    catch {
      return {}
    }
  }
  return typeof market.metadata === 'object' && !Array.isArray(market.metadata)
    ? market.metadata as Record<string, unknown>
    : {}
}

export function getMirrorResolutionType(market: Market): MirrorResolutionType | null {
  const value = parseMetadata(market).mirror_resolution_type
  return value === 'chainlink' || value === 'uma' ? value : null
}

export function getMirrorOracleAddress(market: Market): string | null {
  const value = parseMetadata(market).mirror_oracle_address
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function normalizeEndTimestamp(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const timestamp = value > 10_000_000_000 ? value : value * 1000
    return Number.isFinite(timestamp) ? timestamp : null
  }

  if (typeof value !== 'string') {
    return null
  }

  const text = value.trim()
  if (!text) {
    return null
  }

  if (/^\d+(?:\.\d+)?$/.test(text)) {
    const numeric = Number(text)
    if (Number.isFinite(numeric)) {
      const timestamp = numeric > 10_000_000_000 ? numeric : numeric * 1000
      return Number.isFinite(timestamp) ? timestamp : null
    }
  }

  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text)
    ? `${text.replace(' ', 'T')}Z`
    : text
  const timestamp = Date.parse(normalized)
  return Number.isFinite(timestamp) ? timestamp : null
}

export function getMarketEndTimestamp(market: Market): number | null {
  const metadataEndTime = parseMetadata(market).end_time
  return normalizeEndTimestamp(market.end_time)
    ?? normalizeEndTimestamp(metadataEndTime)
}

export function isMarketEnded(market: Market, nowMs: number): boolean {
  const endTimestamp = getMarketEndTimestamp(market)
  return endTimestamp != null && nowMs >= endTimestamp
}

export function isChainlinkMarketEnded(market: Market, nowMs: number): boolean {
  return getMirrorResolutionType(market) === 'chainlink'
    && isMarketEnded(market, nowMs)
}
