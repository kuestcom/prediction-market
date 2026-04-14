export const VOLUME_BATCH_SIZE = 100
export const VOLUME_REQUEST_TIMEOUT_MS = 10_000
export const DEFAULT_VOLUME_SYNC_LIMIT = 150
export const MAX_VOLUME_SYNC_LIMIT = 500
export const SYNC_TIME_LIMIT_MS = 250_000

export interface VolumeWorkItem {
  conditionId: string
  tokenIds: [string, string]
  previousTotalVolume: string
  previousVolume24h: string
}

export interface VolumeResponseItem {
  condition_id: string
  status: number
  volume?: string | number
  volume_24h?: string | number
  error?: string
}

export function parseLimitParam(
  rawValue: string | null,
  defaultLimit: number = DEFAULT_VOLUME_SYNC_LIMIT,
  maxLimit: number = MAX_VOLUME_SYNC_LIMIT,
): number {
  if (!rawValue) {
    return defaultLimit
  }

  const parsed = Number.parseInt(rawValue, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultLimit
  }

  return Math.min(parsed, maxLimit)
}

export function hasReachedTimeLimit(startedAtMs: number, nowMs: number, limitMs: number = SYNC_TIME_LIMIT_MS): boolean {
  return nowMs - startedAtMs >= limitMs
}

export function chunkVolumeWork(
  items: VolumeWorkItem[],
  chunkSize: number = VOLUME_BATCH_SIZE,
): VolumeWorkItem[][] {
  const chunks: VolumeWorkItem[][] = []
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize))
  }
  return chunks
}

export function normalizeVolumeValue(value: unknown): string {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) {
      return '0'
    }
    return value.toString()
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) {
      return '0'
    }

    const parsed = Number(trimmed)
    if (!Number.isFinite(parsed) || parsed < 0) {
      return '0'
    }
    return trimmed
  }

  return '0'
}
