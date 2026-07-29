'use client'

import { useEffect } from 'react'

import type { BeforeInstallPromptEvent } from '@/lib/pwa-install'

import { detectIos, detectStandaloneMode } from '@/lib/pwa-install'
import { usePwaInstallStore } from '@/stores/usePwaInstall'

function usePwaInstallSync() {
  const setEnvironment = usePwaInstallStore((state) => state.setEnvironment)
  const setDeferredPrompt = usePwaInstallStore((state) => state.setDeferredPrompt)
  const setStandalone = usePwaInstallStore((state) => state.setStandalone)

  useEffect(
    function syncPwaInstallState() {
      setEnvironment({
        isIos: detectIos(),
        isStandalone: detectStandaloneMode(),
      })

      function handleBeforeInstallPrompt(event: Event) {
        event.preventDefault()
        setDeferredPrompt(event as BeforeInstallPromptEvent)
      }

      function handleAppInstalled() {
        setDeferredPrompt(null)
        setStandalone(true)
      }

      function handleDisplayModeChange() {
        setStandalone(detectStandaloneMode())
      }

      const displayModeQuery = window.matchMedia('(display-mode: standalone)')

      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.addEventListener('appinstalled', handleAppInstalled)

      if (typeof displayModeQuery.addEventListener === 'function') {
        displayModeQuery.addEventListener('change', handleDisplayModeChange)
      } else {
        displayModeQuery.addListener(handleDisplayModeChange)
      }

      return function cleanupPwaInstallListeners() {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
        window.removeEventListener('appinstalled', handleAppInstalled)

        if (typeof displayModeQuery.removeEventListener === 'function') {
          displayModeQuery.removeEventListener('change', handleDisplayModeChange)
        } else {
          displayModeQuery.removeListener(handleDisplayModeChange)
        }
      }
    },
    [setDeferredPrompt, setEnvironment, setStandalone],
  )
}

export default function PwaInstallStateSync() {
  usePwaInstallSync()

  return null
}
