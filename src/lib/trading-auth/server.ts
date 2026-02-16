'use server'

import type { L2AuthContextRecord } from '@/lib/l2-auth-context'
import { eq } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { users } from '@/lib/db/schema/auth/tables'
import { db } from '@/lib/drizzle'
import { decryptSecret, encryptSecret } from '@/lib/encryption'
import {
  createL2AuthContextId,
  createL2AuthContextRecord,
  hashL2AuthContextId,
  isValidL2AuthContextId,
  L2_AUTH_CONTEXT_COOKIE_NAMES,
  L2_AUTH_CONTEXT_MAX_PER_USER,
  normalizeL2AuthContextRecords,
} from '@/lib/l2-auth-context'
import { getBetterAuthSecretHash } from '@/lib/trading-auth/secret-hash'

interface TradingAuthSecretEntry {
  key: string
  secret: string
  passphrase: string
  updatedAt: string
}

interface TradingAuthSecretSettings {
  encryptionSecretHash?: string
  relayer?: TradingAuthSecretEntry
  clob?: TradingAuthSecretEntry
  l2Contexts?: L2AuthContextRecord[]
  approvals?: {
    completed?: boolean
    updatedAt?: string
  }
}

interface TradingAuthStorePayload {
  relayer?: {
    key: string
    secret: string
    passphrase: string
  }
  clob?: {
    key: string
    secret: string
    passphrase: string
  }
}

export interface TradingAuthSecrets {
  relayer?: {
    key: string
    secret: string
    passphrase: string
  }
  clob?: {
    key: string
    secret: string
    passphrase: string
  }
}

function hasStoredTradingCredentials(tradingAuth: TradingAuthSecretSettings) {
  return Boolean(tradingAuth.relayer?.key || tradingAuth.clob?.key)
}

async function withLockedUserSettings<T>(
  userId: string,
  callback: (args: { settings: Record<string, any>, tx: any }) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ settings: users.settings })
      .from(users)
      .where(eq(users.id, userId))
      .for('update')
      .limit(1)

    const settings = (row?.settings ?? {}) as Record<string, any>
    return callback({ settings, tx })
  })
}

function decodeEntry(entry?: TradingAuthSecretEntry | null) {
  if (!entry) {
    return undefined
  }

  return {
    key: decryptSecret(entry.key),
    secret: decryptSecret(entry.secret),
    passphrase: decryptSecret(entry.passphrase),
  }
}

async function getL2AuthContextIdFromRequestCookies() {
  let cookieStore: Awaited<ReturnType<typeof cookies>>
  try {
    cookieStore = await cookies()
  }
  catch {
    return null
  }

  for (const cookieName of L2_AUTH_CONTEXT_COOKIE_NAMES) {
    const value = cookieStore.get(cookieName)?.value
    if (isValidL2AuthContextId(value)) {
      return value
    }
  }

  return null
}

function upsertAndPruneL2AuthContexts(current: unknown, contextId: string, now = Date.now()) {
  const currentContexts = normalizeL2AuthContextRecords(current, now)
  const nextContext = createL2AuthContextRecord(contextId, now)
  const deduped = currentContexts.filter(context => context.idHash !== nextContext.idHash)

  return [nextContext, ...deduped].slice(0, L2_AUTH_CONTEXT_MAX_PER_USER)
}

async function validateL2AuthContext(settings: Record<string, any>) {
  const tradingAuth = (settings.tradingAuth ?? {}) as TradingAuthSecretSettings
  const hasSecrets = hasStoredTradingCredentials(tradingAuth)

  // No credentials stored yet; let caller handle auth-required flow.
  if (!hasSecrets) {
    return { valid: true, contextsChanged: false, normalizedContexts: [] as L2AuthContextRecord[] }
  }

  const normalizedContexts = normalizeL2AuthContextRecords(tradingAuth.l2Contexts)
  const contextsChanged = JSON.stringify(tradingAuth.l2Contexts ?? []) !== JSON.stringify(normalizedContexts)
  if (!normalizedContexts.length) {
    return { valid: false, contextsChanged, normalizedContexts }
  }

  const contextId = await getL2AuthContextIdFromRequestCookies()
  if (!contextId) {
    return { valid: false, contextsChanged, normalizedContexts }
  }

  const contextHash = hashL2AuthContextId(contextId)
  const hasContext = normalizedContexts.some(context => context.idHash === contextHash)

  return { valid: hasContext, contextsChanged, normalizedContexts }
}

async function invalidateTradingAuthCredentials(userId: string, settings: Record<string, any>) {
  const tradingAuth = settings.tradingAuth as TradingAuthSecretSettings | undefined
  if (!tradingAuth) {
    return { invalidated: false, settings }
  }

  if (!hasStoredTradingCredentials(tradingAuth)) {
    return { invalidated: false, settings }
  }

  const currentHash = getBetterAuthSecretHash()
  const storedHash = tradingAuth.encryptionSecretHash

  const hasMismatch = !storedHash || storedHash !== currentHash
  if (!hasMismatch) {
    return { invalidated: false, settings }
  }

  return withLockedUserSettings(userId, async ({ settings: lockedSettings, tx }) => {
    const lockedTradingAuth = lockedSettings.tradingAuth as TradingAuthSecretSettings | undefined
    if (!lockedTradingAuth || !hasStoredTradingCredentials(lockedTradingAuth)) {
      return { invalidated: false, settings: lockedSettings }
    }

    const lockedStoredHash = lockedTradingAuth.encryptionSecretHash
    const stillMismatch = !lockedStoredHash || lockedStoredHash !== currentHash
    if (!stillMismatch) {
      return { invalidated: false, settings: lockedSettings }
    }

    const nextTradingAuth: TradingAuthSecretSettings = {
      ...lockedTradingAuth,
      encryptionSecretHash: currentHash,
    }

    delete nextTradingAuth.relayer
    delete nextTradingAuth.clob

    const nextSettings = {
      ...lockedSettings,
      tradingAuth: nextTradingAuth,
    }

    await tx
      .update(users)
      .set({ settings: nextSettings })
      .where(eq(users.id, userId))

    return { invalidated: true, settings: nextSettings }
  })
}

export async function ensureUserTradingAuthSecretFingerprint(userId: string, rawSettings: Record<string, any> | null | undefined) {
  const settings = (rawSettings ?? {}) as Record<string, any>
  const result = await invalidateTradingAuthCredentials(userId, settings)
  return result.settings
}

export async function getUserTradingAuthSecrets(userId: string): Promise<TradingAuthSecrets | null> {
  const [row] = await db
    .select({ settings: users.settings })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  const currentSettings = (row?.settings ?? {}) as Record<string, any>
  const invalidation = await invalidateTradingAuthCredentials(userId, currentSettings)
  if (invalidation.invalidated) {
    return null
  }

  const settings = invalidation.settings as Record<string, any>
  const tradingAuth = (settings as any)?.tradingAuth as TradingAuthSecretSettings | undefined
  if (!tradingAuth) {
    return null
  }

  const l2Validation = await validateL2AuthContext(settings)
  if (l2Validation.contextsChanged) {
    await withLockedUserSettings(userId, async ({ settings: lockedSettings, tx }) => {
      const lockedTradingAuth = (lockedSettings as any)?.tradingAuth as TradingAuthSecretSettings | undefined
      if (!lockedTradingAuth) {
        return
      }

      const normalizedContexts = normalizeL2AuthContextRecords(lockedTradingAuth.l2Contexts)
      const contextsChanged = JSON.stringify(lockedTradingAuth.l2Contexts ?? []) !== JSON.stringify(normalizedContexts)
      if (!contextsChanged) {
        return
      }

      const nextTradingAuth: TradingAuthSecretSettings = {
        ...lockedTradingAuth,
        l2Contexts: normalizedContexts,
      }
      const nextSettings = {
        ...lockedSettings,
        tradingAuth: nextTradingAuth,
      }

      await tx
        .update(users)
        .set({ settings: nextSettings })
        .where(eq(users.id, userId))
    })
  }

  if (!l2Validation.valid) {
    return null
  }

  return {
    relayer: decodeEntry(tradingAuth.relayer),
    clob: decodeEntry(tradingAuth.clob),
  }
}

export async function saveUserTradingAuthCredentials(userId: string, payload: TradingAuthStorePayload) {
  if (!payload.relayer && !payload.clob) {
    return
  }

  const now = Date.now()
  const encryptionSecretHash = getBetterAuthSecretHash()
  const l2AuthContextId = createL2AuthContextId()

  await withLockedUserSettings(userId, async ({ settings, tx }) => {
    const tradingAuth = (settings.tradingAuth ?? {}) as Record<string, any>
    const updatedAt = new Date().toISOString()
    tradingAuth.encryptionSecretHash = encryptionSecretHash
    tradingAuth.l2Contexts = upsertAndPruneL2AuthContexts(tradingAuth.l2Contexts, l2AuthContextId, now)

    if (payload.relayer) {
      tradingAuth.relayer = {
        key: encryptSecret(payload.relayer.key),
        secret: encryptSecret(payload.relayer.secret),
        passphrase: encryptSecret(payload.relayer.passphrase),
        updatedAt,
      }
    }

    if (payload.clob) {
      tradingAuth.clob = {
        key: encryptSecret(payload.clob.key),
        secret: encryptSecret(payload.clob.secret),
        passphrase: encryptSecret(payload.clob.passphrase),
        updatedAt,
      }
    }

    settings.tradingAuth = tradingAuth

    await tx
      .update(users)
      .set({ settings })
      .where(eq(users.id, userId))
  })

  return l2AuthContextId
}

export async function markTokenApprovalsCompleted(userId: string) {
  const updatedAt = new Date().toISOString()
  await withLockedUserSettings(userId, async ({ settings, tx }) => {
    const tradingAuth = (settings.tradingAuth ?? {}) as Record<string, any>
    tradingAuth.approvals = {
      completed: true,
      updatedAt,
    }

    settings.tradingAuth = tradingAuth

    await tx
      .update(users)
      .set({ settings })
      .where(eq(users.id, userId))
  })

  return {
    enabled: true,
    updatedAt,
  }
}
