'use client'

import { usePwaInstallStore } from '@/stores/usePwaInstall'

type PwaInstallOutcome = 'accepted' | 'dismissed' | 'unavailable'

export function usePwaInstall() {
  const isIos = usePwaInstallStore(state => state.isIos)
  const isStandalone = usePwaInstallStore(state => state.isStandalone)
  const isPrompting = usePwaInstallStore(state => state.isPrompting)
  const deferredPrompt = usePwaInstallStore(state => state.deferredPrompt)
  const setDeferredPrompt = usePwaInstallStore(state => state.setDeferredPrompt)
  const setStandalone = usePwaInstallStore(state => state.setStandalone)
  const setPrompting = usePwaInstallStore(state => state.setPrompting)

  const canInstall = Boolean(deferredPrompt)
  const canShowInstallUi = !isStandalone && (isIos || canInstall)

  async function requestInstall(): Promise<PwaInstallOutcome> {
    if (!deferredPrompt) {
      return 'unavailable'
    }

    setPrompting(true)

    try {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice

      if (outcome === 'accepted') {
        setStandalone(true)
      }

      return outcome
    }
    finally {
      setDeferredPrompt(null)
      setPrompting(false)
    }
  }

  return {
    isIos,
    isStandalone,
    isPrompting,
    canInstall,
    canShowInstallUi,
    requestInstall,
  }
}
