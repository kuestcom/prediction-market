import { createHash } from 'node:crypto'
import { generateRandomString } from 'better-auth/crypto'

export const L2_AUTH_CONTEXT_PREFIX = 'l2_'
export const L2_AUTH_CONTEXT_COOKIE_NAME = 'kuest_l2_auth_context'
export const L2_AUTH_CONTEXT_COOKIE_NAME_SECURE = '__Secure-kuest_l2_auth_context'
export const L2_AUTH_CONTEXT_COOKIE_NAMES = [
  L2_AUTH_CONTEXT_COOKIE_NAME_SECURE,
  L2_AUTH_CONTEXT_COOKIE_NAME,
] as const

// Keep it fixed as requested: 30 days
export const L2_AUTH_CONTEXT_TTL_MS = 30 * 24 * 60 * 60 * 1000
export const L2_AUTH_CONTEXT_TTL_SECONDS = Math.floor(L2_AUTH_CONTEXT_TTL_MS / 1000)

// Avoid unbounded growth in users.settings.tradingAuth
export const L2_AUTH_CONTEXT_MAX_PER_USER = 20

export interface L2AuthContextRecord {
  idHash: string
  createdAt: string
  expiresAt: string
}

export function createL2AuthContextId() {
  return `${L2_AUTH_CONTEXT_PREFIX}${generateRandomString(32)}`
}

export function isValidL2AuthContextId(value: unknown): value is string {
  return typeof value === 'string' && /^l2_[\w-]{32}$/.test(value)
}

export function hashL2AuthContextId(contextId: string) {
  return createHash('sha256').update(contextId).digest('hex')
}

export function createL2AuthContextRecord(contextId: string, now = Date.now()): L2AuthContextRecord {
  return {
    idHash: hashL2AuthContextId(contextId),
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + L2_AUTH_CONTEXT_TTL_MS).toISOString(),
  }
}

export function isL2AuthContextRecordExpired(record: { expiresAt?: unknown }, now = Date.now()) {
  if (typeof record.expiresAt !== 'string') {
    return true
  }

  const expiresAt = Date.parse(record.expiresAt)
  if (Number.isNaN(expiresAt)) {
    return true
  }

  return expiresAt <= now
}

export function normalizeL2AuthContextRecords(value: unknown, now = Date.now()): L2AuthContextRecord[] {
  if (!Array.isArray(value)) {
    return []
  }

  const records = value
    .filter((item): item is L2AuthContextRecord => {
      return Boolean(
        item
        && typeof item === 'object'
        && typeof (item as any).idHash === 'string'
        && /^[a-f0-9]{64}$/.test((item as any).idHash)
        && typeof (item as any).createdAt === 'string'
        && typeof (item as any).expiresAt === 'string',
      )
    })
    .filter(record => !isL2AuthContextRecordExpired(record, now))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))

  return records.slice(0, L2_AUTH_CONTEXT_MAX_PER_USER)
}
