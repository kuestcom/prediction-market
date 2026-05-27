import type { SQLWrapper } from 'drizzle-orm'
import { sql } from 'drizzle-orm'

export const VOLUME_SYNC_JOB_TYPE = 'sync_market_volume'
export const VOLUME_JOB_ENQUEUE_LIMIT = 100
export const VOLUME_JOB_PROCESS_LIMIT = 10
export const VOLUME_JOB_MAX_ATTEMPTS = 8
export const VOLUME_JOB_REQUEST_TIMEOUT_MS = 8_000
export const VOLUME_JOB_REFRESH_INTERVAL_MS = 10 * 60 * 1000
export const VOLUME_JOB_FAILED_REFRESH_INTERVAL_MS = 60 * 60 * 1000

export interface VolumeResponseItem {
  condition_id: string
  status: number
  volume?: string | number
  volume_24h?: string | number
  error?: string
}

export interface VolumeJobPayload {
  conditionId: string
}

export interface VolumeJobRow {
  id: string
  job_type: string
  dedupe_key: string
  payload: unknown
  status: 'pending' | 'processing' | 'completed' | 'failed'
  attempts: number
  max_attempts: number
  available_at: Date
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

export function buildVolumeJobDedupeKey(conditionId: string) {
  return conditionId
}

export function buildVolumeJobDedupeKeySql(conditionId: SQLWrapper) {
  return sql<string>`${conditionId}`
}

export function parseVolumeJobPayload(payload: unknown, dedupeKey: string): VolumeJobPayload {
  if (payload && typeof payload === 'object') {
    const candidate = payload as Partial<VolumeJobPayload>
    if (typeof candidate.conditionId === 'string' && candidate.conditionId.trim()) {
      return { conditionId: candidate.conditionId.trim() }
    }
  }

  const fallbackConditionId = dedupeKey.trim()
  if (fallbackConditionId) {
    return { conditionId: fallbackConditionId }
  }

  throw new Error('Volume job payload is missing conditionId.')
}

export function buildVolumeJobRetryAt(attempts: number) {
  const backoffMinutes = Math.min(60, Math.max(1, attempts * 2))
  return new Date(Date.now() + (backoffMinutes * 60_000))
}

export function truncateVolumeJobError(error: unknown) {
  const message = error instanceof Error
    ? error.message
    : typeof error === 'string'
      ? error
      : 'Unknown volume sync error'

  return message.slice(0, 1000)
}
