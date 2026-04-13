'use client'

import type { AppKit } from '@reown/appkit'
import type { SIWECreateMessageArgs, SIWESession, SIWEVerifyMessageArgs } from '@reown/appkit-siwe'
import type { ReactNode } from 'react'
import type { User } from '@/types'
import { createSIWEConfig, formatMessage, getAddressFromMessage } from '@reown/appkit-siwe'
import { createAppKit, useAppKitTheme } from '@reown/appkit/react'
import { generateRandomString } from 'better-auth/crypto'
import { useTheme } from 'next-themes'
import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { WagmiProvider } from 'wagmi'
import { AppKitContext, defaultAppKitValue } from '@/hooks/useAppKit'
import { useSiteIdentity } from '@/hooks/useSiteIdentity'
import { defaultNetwork, networks, projectId, wagmiAdapter, wagmiConfig } from '@/lib/appkit'
import { authClient } from '@/lib/auth-client'
import { IS_BROWSER } from '@/lib/constants'
import { clearBrowserStorage, clearNonHttpOnlyCookies } from '@/lib/utils'
import { mergeSessionUserState, useUser } from '@/stores/useUser'

let hasInitializedAppKit = false
let appKitInstance: AppKit | null = null
const appKitStateListeners = new Set<() => void>()
const APPKIT_INIT_RETRY_DELAY_MS = 3000

const SignaturePrompt = dynamic(
  () => import('@/components/SignaturePrompt').then(mod => mod.SignaturePrompt),
  { ssr: false },
)

function clearAppKitState() {
  if (!IS_BROWSER) {
    return
  }

  clearBrowserStorage()
  clearNonHttpOnlyCookies()
}

function notifyAppKitStateChange() {
  appKitStateListeners.forEach((listener) => {
    listener()
  })
}

function subscribeAppKitStateChange(onStoreChange: () => void) {
  appKitStateListeners.add(onStoreChange)
  return () => {
    appKitStateListeners.delete(onStoreChange)
  }
}

function getAppKitInstanceSnapshot() {
  return appKitInstance
}

function initializeAppKitSingleton(
  themeMode: 'light' | 'dark',
  site: { name: string, description: string, logoUrl: string },
) {
  if (hasInitializedAppKit || !IS_BROWSER) {
    return appKitInstance
  }

  try {
    appKitInstance = createAppKit({
      projectId: projectId!,
      adapters: [wagmiAdapter],
      themeMode,
      defaultAccountTypes: { eip155: 'eoa' },
      metadata: {
        name: site.name,
        description: site.description,
        url: process.env.SITE_URL!,
        icons: [site.logoUrl],
      },
      themeVariables: {
        '--w3m-font-family': 'var(--font-sans)',
        '--w3m-border-radius-master': '2px',
        '--w3m-accent': 'var(--primary)',
      },
      networks,
      featuredWalletIds: ['c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96'],
      features: {
        analytics: process.env.NODE_ENV === 'production',
      },
      siweConfig: createSIWEConfig({
        signOutOnAccountChange: true,
        getMessageParams: async () => ({
          domain: new URL(process.env.SITE_URL!).host,
          uri: typeof window !== 'undefined' ? window.location.origin : '',
          chains: [defaultNetwork.id],
          statement: 'Please sign with your account',
        }),
        createMessage: ({ address, ...args }: SIWECreateMessageArgs) => formatMessage(args, address),
        getNonce: async () => generateRandomString(32),
        getSession: async () => {
          try {
            const session = await authClient.getSession()
            if (!session.data?.user) {
              return null
            }

            return {
              // @ts-expect-error address not defined in session type
              address: session.data?.user.address,
              chainId: defaultNetwork.id,
            } satisfies SIWESession
          }
          catch {
            return null
          }
        },
        verifyMessage: async ({ message, signature }: SIWEVerifyMessageArgs) => {
          try {
            const address = getAddressFromMessage(message)
            await authClient.siwe.nonce({
              walletAddress: address,
              chainId: defaultNetwork.id,
            })
            const { data } = await authClient.siwe.verify({
              message,
              signature,
              walletAddress: address,
              chainId: defaultNetwork.id,
            })
            return Boolean(data?.success)
          }
          catch {
            return false
          }
        },
        signOut: async () => {
          try {
            await authClient.signOut()
            useUser.setState(null)
            return true
          }
          catch {
            return false
          }
        },
        onSignIn: () => {
          authClient.getSession().then((session) => {
            const user = session?.data?.user
            if (user) {
              useUser.setState((previous) => {
                return mergeSessionUserState(previous, user as unknown as User)
              })
            }
          }).catch(() => {})
        },
        onSignOut: () => {
          clearAppKitState()
          window.location.reload()
        },
      }),
    })

    hasInitializedAppKit = true
    notifyAppKitStateChange()
    return appKitInstance
  }
  catch (error) {
    console.warn('Wallet initialization failed. Using local/default values.', error)
    return null
  }
}

function AppKitThemeSynchronizer({ themeMode }: { themeMode: 'light' | 'dark' }) {
  useSyncAppKitThemeMode(themeMode)

  return null
}

function useSyncAppKitThemeMode(themeMode: 'light' | 'dark') {
  const { setThemeMode } = useAppKitTheme()

  useEffect(() => {
    setThemeMode(themeMode)
  }, [setThemeMode, themeMode])
}

function useResolvedThemeMode() {
  const { resolvedTheme } = useTheme()
  return resolvedTheme
}

function createAppKitContextValue(instance: AppKit | null) {
  if (!instance) {
    return defaultAppKitValue
  }

  return {
    open: async (options: Parameters<AppKit['open']>[0]) => {
      await instance.open(options)
    },
    close: async () => {
      await instance.close()
    },
    isReady: true,
  }
}

export default function AppKitProvider({ children }: { children: ReactNode }) {
  const site = useSiteIdentity()
  const resolvedTheme = useResolvedThemeMode()
  const appKitThemeMode: 'light' | 'dark' = resolvedTheme === 'dark' ? 'dark' : 'light'
  const [appKitInitRetryToken, setAppKitInitRetryToken] = useState(0)
  const instance = useSyncExternalStore(
    subscribeAppKitStateChange,
    getAppKitInstanceSnapshot,
    () => null,
  )

  useEffect(() => {
    if (instance) {
      return
    }

    const initializedInstance = initializeAppKitSingleton(appKitThemeMode, {
      name: site.name,
      description: site.description,
      logoUrl: site.logoUrl,
    })
    if (initializedInstance) {
      return
    }

    const retryTimeout = window.setTimeout(() => {
      setAppKitInitRetryToken(previous => previous + 1)
    }, APPKIT_INIT_RETRY_DELAY_MS)
    return () => {
      window.clearTimeout(retryTimeout)
    }
  }, [appKitThemeMode, appKitInitRetryToken, instance, site.description, site.logoUrl, site.name])

  const appKitValue = useMemo(() => createAppKitContextValue(instance), [instance])
  const canSyncTheme = Boolean(instance)

  return (
    <WagmiProvider config={wagmiConfig}>
      <AppKitContext value={appKitValue}>
        {children}
        <SignaturePrompt />
        {canSyncTheme && <AppKitThemeSynchronizer themeMode={appKitThemeMode} />}
      </AppKitContext>
    </WagmiProvider>
  )
}
