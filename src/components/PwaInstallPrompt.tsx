'use client'

import { DownloadIcon, Share2Icon, XIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

const DISMISS_STORAGE_KEY = 'pwa_install_prompt_dismissed'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
}

function detectIos() {
  const userAgent = window.navigator.userAgent
  const hasTouchOnMac = /Macintosh/.test(userAgent) && window.navigator.maxTouchPoints > 1

  return /iPad|iPhone|iPod/.test(userAgent) || hasTouchOnMac
}

function detectStandaloneMode() {
  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean }
  return window.matchMedia('(display-mode: standalone)').matches || navigatorWithStandalone.standalone === true
}

export default function PwaInstallPrompt() {
  const t = useExtracted()
  const [isIos, setIsIos] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)
  const [isPrompting, setIsPrompting] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    setIsIos(detectIos())
    setIsStandalone(detectStandaloneMode())

    try {
      setIsDismissed(window.localStorage.getItem(DISMISS_STORAGE_KEY) === '1')
    }
    catch {
      setIsDismissed(false)
    }

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
    }

    function handleAppInstalled() {
      setDeferredPrompt(null)
      setIsStandalone(true)
      setIsDismissed(false)

      try {
        window.localStorage.removeItem(DISMISS_STORAGE_KEY)
      }
      catch {
        //
      }
    }

    function handleDisplayModeChange(_event: MediaQueryListEvent) {
      setIsStandalone(detectStandaloneMode())
    }

    const displayModeQuery = window.matchMedia('(display-mode: standalone)')

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)
    displayModeQuery.addEventListener('change', handleDisplayModeChange)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
      displayModeQuery.removeEventListener('change', handleDisplayModeChange)
    }
  }, [])

  function dismissPrompt() {
    setIsDismissed(true)

    try {
      window.localStorage.setItem(DISMISS_STORAGE_KEY, '1')
    }
    catch {
      //
    }
  }

  async function handleInstallClick() {
    if (!deferredPrompt) {
      return
    }

    setIsPrompting(true)

    try {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice

      if (outcome === 'accepted') {
        setIsStandalone(true)
      }
      else {
        dismissPrompt()
      }
    }
    finally {
      setDeferredPrompt(null)
      setIsPrompting(false)
    }
  }

  const canShowInstallCta = Boolean(deferredPrompt)
  const shouldShowPrompt = !isStandalone && !isDismissed && (isIos || canShowInstallCta)

  if (!shouldShowPrompt) {
    return null
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-60">
      <div className="container flex justify-center">
        <section
          className="pointer-events-auto w-full max-w-md rounded-xl border bg-background p-3 shadow-xl"
          data-testid="pwa-install-prompt"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground">{t('Install app')}</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {isIos
                  ? t('Install this app from Safari to keep it on your home screen.')
                  : t('Install this app for a faster, full-screen experience.')}
              </p>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 shrink-0"
              onClick={dismissPrompt}
              data-testid="pwa-install-prompt-dismiss"
            >
              <XIcon className="size-4" />
              <span className="sr-only">{t('Dismiss')}</span>
            </Button>
          </div>

          {isIos
            ? (
                <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                  {t('Tap Share')}
                  <Share2Icon className="size-3.5" />
                  {t('then Add to Home Screen.')}
                </p>
              )
            : (
                <div className="mt-3 flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      void handleInstallClick()
                    }}
                    disabled={isPrompting}
                    data-testid="pwa-install-prompt-action"
                  >
                    <DownloadIcon className="size-4" />
                    {isPrompting ? t('Opening...') : t('Install')}
                  </Button>
                </div>
              )}
        </section>
      </div>
    </div>
  )
}
