'use client'

import {
  isValidL2AuthContextId,
  L2_AUTH_CONTEXT_HEADER_NAME,
  L2_AUTH_CONTEXT_STORAGE_KEY,
} from '@/lib/l2-auth-context'

/**
 * Store L2 auth context ID in localStorage
 */
export function storeL2AuthContextId(contextId: string): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    localStorage.setItem(L2_AUTH_CONTEXT_STORAGE_KEY, contextId)
  }
  catch (error) {
    console.warn('Failed to store L2 auth context ID', error)
  }
}

/**
 * Retrieve L2 auth context ID from localStorage
 */
export function getL2AuthContextId(): string | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const contextId = localStorage.getItem(L2_AUTH_CONTEXT_STORAGE_KEY)
    return isValidL2AuthContextId(contextId) ? contextId : null
  }
  catch (error) {
    console.warn('Failed to retrieve L2 auth context ID', error)
    return null
  }
}

/**
 * Remove L2 auth context ID from localStorage
 */
export function clearL2AuthContextId(): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    localStorage.removeItem(L2_AUTH_CONTEXT_STORAGE_KEY)
  }
  catch (error) {
    console.warn('Failed to clear L2 auth context ID', error)
  }
}

/**
 * Add L2 auth context header to fetch headers
 */
export function addL2AuthContextHeader(headers: Record<string, string> = {}): Record<string, string> {
  const contextId = getL2AuthContextId()

  if (contextId) {
    return {
      ...headers,
      [L2_AUTH_CONTEXT_HEADER_NAME]: contextId,
    }
  }

  return headers
}

/**
 * Check if the environment/browser changed (basic check)
 * This helps detect context migration between devices
 */
export function generateEnvironmentFingerprint(): string {
  if (typeof window === 'undefined') {
    return 'server'
  }

  const components = [
    navigator.userAgent || 'unknown',
    window.screen?.width || 0,
    window.screen?.height || 0,
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  ]

  return btoa(components.join('|')).slice(0, 16)
}
