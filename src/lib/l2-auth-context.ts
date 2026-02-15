import { generateRandomString } from 'better-auth/crypto'

export const L2_AUTH_CONTEXT_STORAGE_KEY = 'kuest_l2_auth_context_id'
export const L2_AUTH_CONTEXT_HEADER_NAME = 'X-Kuest-L2-Auth-Context'

// L2 auth context expires after 7 days
export const L2_AUTH_CONTEXT_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000

export interface L2AuthContext {
  contextId: string
  expiresAt: Date
}

/**
 * Generate a new L2 auth context ID
 */
export function generateL2AuthContextId(): string {
  return `l2_${generateRandomString(32)}`
}

/**
 * Create a new L2 auth context with expiry date
 */
export function createL2AuthContext(): L2AuthContext {
  const contextId = generateL2AuthContextId()
  const expiresAt = new Date(Date.now() + L2_AUTH_CONTEXT_EXPIRY_MS)

  return {
    contextId,
    expiresAt,
  }
}

/**
 * Check if an L2 auth context is expired
 */
export function isL2AuthContextExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) {
    return true
  }
  return expiresAt.getTime() <= Date.now()
}

/**
 * Validate L2 auth context format
 */
export function isValidL2AuthContextId(contextId: string | null | undefined): boolean {
  if (!contextId || typeof contextId !== 'string') {
    return false
  }
  return /^l2_[\w-]{32}$/.test(contextId)
}
