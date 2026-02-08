'use client'

import type { AppKit } from '@reown/appkit'
import type { SIWECreateMessageArgs, SIWESession, SIWEVerifyMessageArgs } from '@reown/appkit-siwe'
import type { ReactNode } from 'react'
import type { User } from '@/types'
import { createSIWEConfig, formatMessage, getAddressFromMessage } from '@reown/appkit-siwe'
import { createAppKit, useAppKitTheme } from '@reown/appkit/react'
import { generateRandomString } from 'better-auth/crypto'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { WagmiProvider } from 'wagmi'
import { AppKitContext, defaultAppKitValue } from '@/hooks/useAppKit'
import { useSiteIdentity } from '@/hooks/useSiteIdentity'
import { defaultNetwork, networks, projectId, wagmiAdapter, wagmiConfig } from '@/lib/appkit'
import { authClient } from '@/lib/auth-client'
import { IS_BROWSER } from '@/lib/constants'
import { clearBrowserStorage, clearNonHttpOnlyCookies } from '@/lib/utils'
import { useUser } from '@/stores/useUser'

let hasInitializedAppKit = false
let appKitInstance: AppKit | null = null
const SIWE_TWO_FACTOR_INTENT_COOKIE = 'siwe_2fa_intent'

function setSiweTwoFactorIntentCookie() {
  if (!IS_BROWSER) {
    return
  }

  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${SIWE_TWO_FACTOR_INTENT_COOKIE}=1; Max-Age=180; Path=/; SameSite=Lax${secure}`
}

function hasSiweTwoFactorIntentCookie() {
  if (!IS_BROWSER) {
    return false
  }

  return document.cookie
    .split('; ')
    .some(cookie => cookie.startsWith(`${SIWE_TWO_FACTOR_INTENT_COOKIE}=`))
}

function clearSiweTwoFactorIntentCookie() {
  if (!IS_BROWSER) {
    return
  }

  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${SIWE_TWO_FACTOR_INTENT_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax${secure}`
}

function clearAppKitLocalStorage() {
  if (!IS_BROWSER) {
    return
  }

  clearBrowserStorage()
  clearNonHttpOnlyCookies()
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
            // @ts-expect-error does not recognize twoFactorRedirect
            if (data?.twoFactorRedirect && typeof window !== 'undefined') {
              if (window.location.pathname !== '/2fa' && hasSiweTwoFactorIntentCookie()) {
                clearSiweTwoFactorIntentCookie()
                window.location.href = '/2fa'
              }
              return false
            }
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
              const sessionSettings = (user as Partial<User>).settings
              useUser.setState((previous) => {
                if (!previous) {
                  return { ...user, image: user.image ?? '' }
                }

                return {
                  ...previous,
                  ...user,
                  image: user.image ?? previous.image ?? '',
                  settings: {
                    ...(previous.settings ?? {}),
                    ...(sessionSettings ?? {}),
                  },
                }
              })
            }
          }).catch(() => {})
        },
        onSignOut: () => {
          clearAppKitLocalStorage()
          if (IS_BROWSER) {
            window.location.href = '/auth/reset'
          }
        },
      }),
    })

    hasInitializedAppKit = true
    return appKitInstance
  }
  catch (error) {
    console.warn('Wallet initialization failed. Using local/default values.', error)
    return null
  }
}

function AppKitThemeSynchronizer({ themeMode }: { themeMode: 'light' | 'dark' }) {
  const { setThemeMode } = useAppKitTheme()

  useEffect(() => {
    setThemeMode(themeMode)
  }, [setThemeMode, themeMode])

  return null
}

export default function AppKitProvider({ children }: { children: ReactNode }) {
  const site = useSiteIdentity()
  const { resolvedTheme } = useTheme()
  const [appKitThemeMode, setAppKitThemeMode] = useState<'light' | 'dark'>('light')
  const [canSyncTheme, setCanSyncTheme] = useState(false)
  const [AppKitValue, setAppKitValue] = useState(defaultAppKitValue)

  useEffect(() => {
    if (!IS_BROWSER) {
      return
    }

    const nextThemeMode: 'light' | 'dark' = resolvedTheme === 'dark' ? 'dark' : 'light'
    const instance = initializeAppKitSingleton(nextThemeMode, {
      name: site.name,
      description: site.description,
      logoUrl: site.logoUrl,
    })

    if (instance) {
      setAppKitThemeMode(nextThemeMode)
      setCanSyncTheme(true)
      setAppKitValue({
        open: async (options) => {
          setSiweTwoFactorIntentCookie()
          await instance.open(options)
        },
        close: async () => {
          await instance.close()
        },
        isReady: true,
      })
    }
  }, [resolvedTheme, site.description, site.logoUrl, site.name])

  return (
    <WagmiProvider config={wagmiConfig}>
      <AppKitContext value={AppKitValue}>
        {children}
        {canSyncTheme && <AppKitThemeSynchronizer themeMode={appKitThemeMode} />}
      </AppKitContext>
    </WagmiProvider>
  )
}
