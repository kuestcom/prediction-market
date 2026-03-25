'use client'

import type { BeforeInstallPromptEvent } from '@/lib/pwa-install'
import { create } from 'zustand'

interface PwaInstallState {
  isIos: boolean
  isStandalone: boolean
  isPrompting: boolean
  deferredPrompt: BeforeInstallPromptEvent | null
  setEnvironment: (payload: { isIos: boolean, isStandalone: boolean }) => void
  setDeferredPrompt: (prompt: BeforeInstallPromptEvent | null) => void
  setStandalone: (isStandalone: boolean) => void
  setPrompting: (isPrompting: boolean) => void
}

export const usePwaInstallStore = create<PwaInstallState>(set => ({
  isIos: false,
  isStandalone: false,
  isPrompting: false,
  deferredPrompt: null,
  setEnvironment: payload => set(payload),
  setDeferredPrompt: deferredPrompt => set({ deferredPrompt }),
  setStandalone: isStandalone => set({ isStandalone }),
  setPrompting: isPrompting => set({ isPrompting }),
}))
