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

export function getMarketEndTimestamp(market: Market): number | null {
  const metadataEndTime = parseMetadata(market).end_time
  const value = market.end_time
    ?? (typeof metadataEndTime === 'string' ? metadataEndTime : null)
  if (!value) {
    return null
  }
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : null
}

export function isChainlinkMarketEnded(market: Market, nowMs: number): boolean {
  if (getMirrorResolutionType(market) !== 'chainlink') {
    return false
  }
  const endTimestamp = getMarketEndTimestamp(market)
  return endTimestamp != null && nowMs >= endTimestamp
}
