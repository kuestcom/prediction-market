'use client'

import { create } from 'zustand'

const DEFAULT_SIGNATURE_PROMPT_TITLE = 'Requesting Signature'
const DEFAULT_SIGNATURE_PROMPT_DESCRIPTION = 'Open your wallet and approve the signature to continue.'

interface SignaturePromptPayload {
  title?: string | null
  description?: string | null
}

interface SignaturePromptState {
  open: boolean
  title: string
  description: string
  pendingCount: number
  showPrompt: (payload?: SignaturePromptPayload) => void
  hidePrompt: () => void
  forceHidePrompt: () => void
}

export const useSignaturePrompt = create<SignaturePromptState>(set => ({
  open: false,
  title: DEFAULT_SIGNATURE_PROMPT_TITLE,
  description: DEFAULT_SIGNATURE_PROMPT_DESCRIPTION,
  pendingCount: 0,
  showPrompt: (payload) => {
    set(state => ({
      open: true,
      title: payload?.title?.trim() || state.title || DEFAULT_SIGNATURE_PROMPT_TITLE,
      description: payload?.description?.trim() || state.description || DEFAULT_SIGNATURE_PROMPT_DESCRIPTION,
      pendingCount: state.pendingCount + 1,
    }))
  },
  hidePrompt: () => {
    set((state) => {
      const nextPendingCount = Math.max(0, state.pendingCount - 1)
      if (nextPendingCount > 0) {
        return {
          pendingCount: nextPendingCount,
        }
      }

      return {
        open: false,
        title: DEFAULT_SIGNATURE_PROMPT_TITLE,
        description: DEFAULT_SIGNATURE_PROMPT_DESCRIPTION,
        pendingCount: 0,
      }
    })
  },
  forceHidePrompt: () => {
    set({
      open: false,
      title: DEFAULT_SIGNATURE_PROMPT_TITLE,
      description: DEFAULT_SIGNATURE_PROMPT_DESCRIPTION,
      pendingCount: 0,
    })
  },
}))
