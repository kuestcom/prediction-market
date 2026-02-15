'use client'

import { useEffect, useState } from 'react'
import {
  clearL2AuthContextId,
  getL2AuthContextId,
  storeL2AuthContextId,
} from '@/lib/l2-auth-context-client'

export interface UseL2AuthContextResult {
  contextId: string | null
  isLoading: boolean
  storeContextId: (contextId: string) => void
  clearContextId: () => void
  hasValidContext: boolean
}

/**
 * Hook to manage L2 auth context ID in localStorage
 */
export function useL2AuthContext(): UseL2AuthContextResult {
  const [contextId, setContextId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Load context ID from localStorage on mount
  useEffect(() => {
    setContextId(getL2AuthContextId())
    setIsLoading(false)
  }, [])

  function storeContextId(newContextId: string) {
    storeL2AuthContextId(newContextId)
    setContextId(newContextId)
  }

  function clearContextId() {
    clearL2AuthContextId()
    setContextId(null)
  }

  const hasValidContext = contextId !== null

  return {
    contextId,
    isLoading,
    storeContextId,
    clearContextId,
    hasValidContext,
  }
}
