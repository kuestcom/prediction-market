import { generateRandomString } from 'better-auth/crypto'
import { createHash } from 'node:crypto'

const L2_AUTH_CONTEXT_PREFIX = 'l2_'
export const L2_AUTH_CONTEXT_COOKIE_NAME = 'kuest_l2_auth_context'
export const L2_AUTH_CONTEXT_COOKIE_NAME_SECURE = '__Secure-kuest_l2_auth_context'
const L2_AUTH_CONTEXT_COOKIE_NAMES = [L2_AUTH_CONTEXT_COOKIE_NAME_SECURE, L2_AUTH_CONTEXT_COOKIE_NAME] as const

const L2_AUTH_CONTEXT_USER_COOKIE_SUFFIX_LENGTH = 24
const L2_AUTH_CONTEXT_TTL_MS = 30 * 24 * 60 * 60 * 1000
export const L2_AUTH_CONTEXT_TTL_SECONDS = Math.floor(L2_AUTH_CONTEXT_TTL_MS / 1000)
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

function l2AuthContextUserCookieSuffix(userId: string) {
  return createHash('sha256').update(userId).digest('hex').slice(0, L2_AUTH_CONTEXT_USER_COOKIE_SUFFIX_LENGTH)
}

export function getL2AuthContextCookieName({ secure, userId }: { secure: boolean; userId?: string | null }) {
  const baseName = secure ? L2_AUTH_CONTEXT_COOKIE_NAME_SECURE : L2_AUTH_CONTEXT_COOKIE_NAME
  const normalizedUserId = userId?.trim()
  if (!normalizedUserId) {
    return baseName
  }

  return `${baseName}_${l2AuthContextUserCookieSuffix(normalizedUserId)}`
}

export function getL2AuthContextCookieNames(userId?: string | null) {
  const normalizedUserId = userId?.trim()
  if (!normalizedUserId) {
    return [...L2_AUTH_CONTEXT_COOKIE_NAMES]
  }

  return [
    getL2AuthContextCookieName({ secure: true, userId: normalizedUserId }),
    getL2AuthContextCookieName({ secure: false, userId: normalizedUserId }),
    ...L2_AUTH_CONTEXT_COOKIE_NAMES,
  ]
}

export function createL2AuthContextRecord(contextId: string, now = Date.now()): L2AuthContextRecord {
  return {
    idHash: hashL2AuthContextId(contextId),
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + L2_AUTH_CONTEXT_TTL_MS).toISOString(),
  }
}

function isL2AuthContextRecordExpired(record: { expiresAt?: unknown }, now = Date.now()) {
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
        item &&
        typeof item === 'object' &&
        typeof (item as any).idHash === 'string' &&
        /^[a-f0-9]{64}$/.test((item as any).idHash) &&
        typeof (item as any).createdAt === 'string' &&
        typeof (item as any).expiresAt === 'string',
      )
    })
    .filter((record) => !isL2AuthContextRecordExpired(record, now))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))

  return records.slice(0, L2_AUTH_CONTEXT_MAX_PER_USER)
}
