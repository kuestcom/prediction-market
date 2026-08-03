'use client'

import { useCallback } from 'react'

import { useAppKit } from '@/hooks/useAppKit'
import { isRecoverableWalletConnectorError, WALLET_CONNECTOR_NOT_CONNECTED_MESSAGE } from '@/lib/wallet'
import { useSignaturePrompt } from '@/stores/useSignaturePrompt'

interface SignaturePromptOptions {
  enabled?: boolean
  title?: string
  description?: string
}

export function useSignaturePromptRunner() {
  const { open: openAppKit } = useAppKit()
  const showPrompt = useSignaturePrompt((state) => state.showPrompt)
  const hidePrompt = useSignaturePrompt((state) => state.hidePrompt)

  const runWithSignaturePrompt = useCallback(
    async <T>(
      action: (dismissPrompt: () => void, restorePrompt: () => void) => Promise<T>,
      options: SignaturePromptOptions = {},
    ): Promise<T> => {
      const { enabled = true, title, description } = options
      if (!enabled) {
        return await action(
          () => undefined,
          () => undefined,
        )
      }

      showPrompt({ title, description })
      let dismissed = false
      function dismissPrompt() {
        if (dismissed) {
          return
        }
        dismissed = true
        hidePrompt()
      }

      function restorePrompt() {
        if (!dismissed) {
          return
        }
        dismissed = false
        showPrompt({ title, description })
      }

      try {
        return await action(dismissPrompt, restorePrompt)
      } catch (error) {
        if (isRecoverableWalletConnectorError(error)) {
          void openAppKit({ view: 'Connect' })
          throw new Error(WALLET_CONNECTOR_NOT_CONNECTED_MESSAGE)
        }

        throw error
      } finally {
        dismissPrompt()
      }
    },
    [hidePrompt, openAppKit, showPrompt],
  )

  return {
    runWithSignaturePrompt,
  }
}
