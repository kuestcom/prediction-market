'use client'

import type { ReactNode } from 'react'
import type { AppKitValue } from '@/hooks/useAppKit'
import { useTheme } from 'next-themes'
import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { WagmiProvider } from 'wagmi'
import { AppKitContext } from '@/hooks/useAppKit'
import { useSiteIdentity } from '@/hooks/useSiteIdentity'
import { wagmiConfig } from '@/lib/appkit'
import {
  getAppKitInstance,
  hasAppKitInstance,
  initializeAppKitSingleton,
  openSiweTwoFactorIntentCookie,
} from '@/lib/appkit-runtime'
import { IS_BROWSER } from '@/lib/constants'

const AppKitThemeSynchronizer = dynamic(
  () => import('@/providers/AppKitThemeSynchronizer'),
  { ssr: false },
)

export default function AppKitProvider({ children }: { children: ReactNode }) {
  const site = useSiteIdentity()
  const { resolvedTheme } = useTheme()
  const [appKitThemeMode, setAppKitThemeMode] = useState<'light' | 'dark'>('light')
  const [canSyncTheme, setCanSyncTheme] = useState(false)
  const [appKitReady, setAppKitReady] = useState(false)

  async function ensureAppKitInstance() {
    if (!IS_BROWSER) {
      return null
    }

    const nextThemeMode: 'light' | 'dark' = resolvedTheme === 'dark' ? 'dark' : 'light'
    const instance = await initializeAppKitSingleton(nextThemeMode, {
      name: site.name,
      description: site.description,
      logoUrl: site.logoUrl,
    })

    if (!instance) {
      return null
    }

    setAppKitThemeMode(nextThemeMode)
    setCanSyncTheme(true)
    setAppKitReady(true)
    return instance
  }

  useEffect(() => {
    if (!IS_BROWSER || !hasAppKitInstance()) {
      return
    }

    const nextThemeMode: 'light' | 'dark' = resolvedTheme === 'dark' ? 'dark' : 'light'
    setAppKitThemeMode(nextThemeMode)
    setCanSyncTheme(true)
    setAppKitReady(true)
  }, [resolvedTheme])

  const appKitValue: AppKitValue = {
    open: async (options) => {
      const instance = await ensureAppKitInstance()
      if (!instance) {
        return
      }

      openSiweTwoFactorIntentCookie()
      await instance.open(options)
    },
    close: async () => {
      const appKitInstance = getAppKitInstance()
      if (!appKitInstance) {
        return
      }

      await appKitInstance.close()
    },
    isReady: appKitReady,
  }

  return (
    <WagmiProvider config={wagmiConfig}>
      <AppKitContext value={appKitValue}>
        {children}
        {canSyncTheme && <AppKitThemeSynchronizer themeMode={appKitThemeMode} />}
      </AppKitContext>
    </WagmiProvider>
  )
}
