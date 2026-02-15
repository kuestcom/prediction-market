'use client'

import { useCallback } from 'react'
import { getL2AuthContextId } from '@/lib/l2-auth-context-client'

/**
 * Hook that provides utilities for L2 auth context
 */
export function useTradingActions() {
  /**
   * Get current L2 auth context ID
   */
  const getContextId = useCallback(() => getL2AuthContextId(), [])

  /**
   * Add L2 context to payload
   */
  const addL2Context = useCallback(<T extends Record<string, any>>(payload: T): T & { l2_auth_context_id?: string } => {
    const contextId = getContextId()
    return {
      ...payload,
      l2_auth_context_id: contextId || undefined,
    }
  }, [getContextId])

  return {
    getContextId,
    addL2Context,
  }
}
