'use server'

import { eq } from 'drizzle-orm'
import { users } from '@/lib/db/schema/auth/tables'
import { db } from '@/lib/drizzle'
import { decryptSecret, encryptSecret } from '@/lib/encryption'
import {
  createL2AuthContext,
  isL2AuthContextExpired,
  isValidL2AuthContextId,
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

export interface L2AuthContextValidationResult {
  valid: boolean
  error?: string
  requiresReauth?: boolean
}

/**
 * Generate and store a new L2 auth context for a user
 */
export async function generateL2AuthContext(userId: string): Promise<string> {
  const context = createL2AuthContext()

  await db
    .update(users)
    .set({
      l2_auth_context_id: context.contextId,
      l2_auth_context_expires_at: context.expiresAt,
    })
    .where(eq(users.id, userId))

  return context.contextId
}

/**
 * Validate L2 auth context from client parameter
 */
export async function validateL2AuthContext(userId: string, contextIdFromClient: string | null | undefined): Promise<L2AuthContextValidationResult> {
  if (!contextIdFromClient) {
    return {
      valid: false,
      error: 'Missing L2 auth context',
      requiresReauth: true,
    }
  }

  if (!isValidL2AuthContextId(contextIdFromClient)) {
    return {
      valid: false,
      error: 'Invalid L2 auth context format',
      requiresReauth: true,
    }
  }

  // Get user's stored context
  const [userRow] = await db
    .select({
      l2_auth_context_id: users.l2_auth_context_id,
      l2_auth_context_expires_at: users.l2_auth_context_expires_at,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!userRow) {
    return {
      valid: false,
      error: 'User not found',
      requiresReauth: true,
    }
  }

  // Check if context exists
  if (!userRow.l2_auth_context_id) {
    return {
      valid: false,
      error: 'No L2 auth context found for user',
      requiresReauth: true,
    }
  }

  // Check if context matches
  if (userRow.l2_auth_context_id !== contextIdFromClient) {
    return {
      valid: false,
      error: 'L2 auth context mismatch',
      requiresReauth: true,
    }
  }

  // Check if context is expired
  if (isL2AuthContextExpired(userRow.l2_auth_context_expires_at)) {
    return {
      valid: false,
      error: 'L2 auth context expired',
      requiresReauth: true,
    }
  }

  return { valid: true }
}

/**
 * Clear L2 auth context for a user (on logout or revocation)
 */
export async function clearL2AuthContext(userId: string): Promise<void> {
  await db
    .update(users)
    .set({
      l2_auth_context_id: null,
      l2_auth_context_expires_at: null,
    })
    .where(eq(users.id, userId))
}

function hasStoredTradingCredentials(tradingAuth: TradingAuthSecretSettings) {
  return Boolean(tradingAuth.relayer?.key || tradingAuth.clob?.key)
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

  const nextTradingAuth: TradingAuthSecretSettings = {
    ...tradingAuth,
    encryptionSecretHash: currentHash,
  }

  delete nextTradingAuth.relayer
  delete nextTradingAuth.clob

  const nextSettings = {
    ...settings,
    tradingAuth: nextTradingAuth,
  }

  await db
    .update(users)
    .set({ settings: nextSettings })
    .where(eq(users.id, userId))

  return { invalidated: true, settings: nextSettings }
}

export async function ensureUserTradingAuthSecretFingerprint(userId: string, rawSettings: Record<string, any> | null | undefined) {
  const settings = (rawSettings ?? {}) as Record<string, any>
  const result = await invalidateTradingAuthCredentials(userId, settings)
  return result.settings
}

/**
 * Get user trading auth secrets without L2 context validation
 * @deprecated Use getUserTradingAuthSecretsWithL2Validation instead
 */
export async function getUserTradingAuthSecrets(userId: string): Promise<TradingAuthSecrets | null> {
  const [row] = await db
    .select({ settings: users.settings })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  const settings = (row?.settings ?? {}) as Record<string, any>
  const invalidation = await invalidateTradingAuthCredentials(userId, settings)
  if (invalidation.invalidated) {
    return null
  }

  const tradingAuth = (settings as any)?.tradingAuth as TradingAuthSecretSettings | undefined
  if (!tradingAuth) {
    return null
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

  return {
    relayer: decodeEntry(tradingAuth.relayer),
    clob: decodeEntry(tradingAuth.clob),
  }
}

/**
 * Get user trading auth secrets with L2 context validation
 * Returns null if L2 auth context is missing, invalid, or expired
 */
export async function getUserTradingAuthSecretsWithL2Validation(userId: string, l2AuthContextId?: string | null): Promise<TradingAuthSecrets | null> {
  // First validate L2 auth context
  const l2Validation = await validateL2AuthContext(userId, l2AuthContextId)
  if (!l2Validation.valid) {
    console.warn(`L2 auth context validation failed for user ${userId}:`, l2Validation.error)
    return null
  }

  // If L2 context is valid, get the trading secrets
  return getUserTradingAuthSecrets(userId)
}

export async function saveUserTradingAuthCredentials(userId: string, payload: TradingAuthStorePayload) {
  if (!payload.relayer && !payload.clob) {
    return
  }

  const encryptionSecretHash = getBetterAuthSecretHash()

  const [row] = await db
    .select({ settings: users.settings })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  const settings = (row?.settings ?? {}) as Record<string, any>
  const tradingAuth = (settings.tradingAuth ?? {}) as Record<string, any>
  const updatedAt = new Date().toISOString()
  tradingAuth.encryptionSecretHash = encryptionSecretHash

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

  // Generate new L2 auth context when credentials are updated
  const context = createL2AuthContext()

  await db
    .update(users)
    .set({
      settings,
      l2_auth_context_id: context.contextId,
      l2_auth_context_expires_at: context.expiresAt,
    })
    .where(eq(users.id, userId))

  return context.contextId
}

export async function markTokenApprovalsCompleted(userId: string) {
  const [row] = await db
    .select({ settings: users.settings })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  const settings = (row?.settings ?? {}) as Record<string, any>
  const tradingAuth = (settings.tradingAuth ?? {}) as Record<string, any>
  const updatedAt = new Date().toISOString()

  tradingAuth.approvals = {
    completed: true,
    updatedAt,
  }

  settings.tradingAuth = tradingAuth

  await db
    .update(users)
    .set({ settings })
    .where(eq(users.id, userId))

  return {
    enabled: true,
    updatedAt,
  }
}
