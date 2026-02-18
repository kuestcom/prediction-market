'use client'

import { useCallback } from 'react'
import { useSignaturePrompt } from '@/stores/useSignaturePrompt'

interface SignaturePromptOptions {
  enabled?: boolean
  title?: string
  description?: string
}

export function useSignaturePromptRunner() {
  const showPrompt = useSignaturePrompt(state => state.showPrompt)
  const hidePrompt = useSignaturePrompt(state => state.hidePrompt)

  const runWithSignaturePrompt = useCallback(async <T>(
    action: () => Promise<T>,
    options: SignaturePromptOptions = {},
  ): Promise<T> => {
    const { enabled = true, title, description } = options
    if (!enabled) {
      return await action()
    }

    showPrompt({ title, description })

    try {
      return await action()
    }
    finally {
      hidePrompt()
    }
  }, [hidePrompt, showPrompt])

  return {
    runWithSignaturePrompt,
  }
}
