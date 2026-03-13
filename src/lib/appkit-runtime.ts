import type { AppKit } from '@reown/appkit'
import type { SIWECreateMessageArgs, SIWESession, SIWEVerifyMessageArgs } from '@reown/appkit-siwe'
import type { User } from '@/types'
import { defaultNetwork, networks, projectId, wagmiAdapter } from '@/lib/appkit'
import { authClient } from '@/lib/auth-client'
import { IS_BROWSER } from '@/lib/constants'
import { buildTwoFactorRedirectPath, stripLocalePrefix } from '@/lib/locale-path'
import { signOutAndRedirect } from '@/lib/logout'
import { clearBrowserStorage, clearNonHttpOnlyCookies } from '@/lib/utils'
import { useUser } from '@/stores/useUser'

let hasInitializedAppKit = false
let appKitInstance: AppKit | null = null
let appKitInitializationPromise: Promise<AppKit | null> | null = null
let runtimeModulesPromise: Promise<{
  createAppKit: typeof import('@reown/appkit/react').createAppKit
  createSIWEConfig: typeof import('@reown/appkit-siwe').createSIWEConfig
  formatMessage: typeof import('@reown/appkit-siwe').formatMessage
  generateRandomString: typeof import('better-auth/crypto').generateRandomString
  getAddressFromMessage: typeof import('@reown/appkit-siwe').getAddressFromMessage
}> | null = null

const SIWE_TWO_FACTOR_INTENT_COOKIE = 'siwe_2fa_intent'

function getBrowserOrigin() {
  if (!IS_BROWSER) {
    return null
  }

  try {
    return window.location.origin
  }
  catch {
    return null
  }
}

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

function loadRuntimeModules() {
  if (!runtimeModulesPromise) {
    runtimeModulesPromise = Promise.all([
      import('@reown/appkit/react'),
      import('@reown/appkit-siwe'),
      import('better-auth/crypto'),
    ]).then(([appKitReactModule, appKitSiweModule, cryptoModule]) => ({
      createAppKit: appKitReactModule.createAppKit,
      createSIWEConfig: appKitSiweModule.createSIWEConfig,
      formatMessage: appKitSiweModule.formatMessage,
      generateRandomString: cryptoModule.generateRandomString,
      getAddressFromMessage: appKitSiweModule.getAddressFromMessage,
    }))
  }

  return runtimeModulesPromise
}

export async function initializeAppKitSingleton(
  themeMode: 'light' | 'dark',
  site: { name: string, description: string, logoUrl: string },
) {
  if (hasInitializedAppKit || !IS_BROWSER) {
    return appKitInstance
  }

  if (appKitInitializationPromise) {
    return appKitInitializationPromise
  }

  appKitInitializationPromise = (async () => {
    try {
      const {
        createAppKit,
        createSIWEConfig,
        formatMessage,
        generateRandomString,
        getAddressFromMessage,
      } = await loadRuntimeModules()
      const origin = getBrowserOrigin()
      const metadataUrl = origin ?? 'http://localhost:3000'
      const siweDomain = origin ? new URL(origin).host : 'localhost:3000'

      appKitInstance = createAppKit({
        projectId: projectId!,
        adapters: [wagmiAdapter],
        enableAuthLogger: process.env.NODE_ENV !== 'production',
        themeMode,
        defaultAccountTypes: { eip155: 'eoa' },
        metadata: {
          name: site.name,
          description: site.description,
          url: metadataUrl,
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
          analytics: false,
        },
        siweConfig: createSIWEConfig({
          signOutOnAccountChange: true,
          getMessageParams: async () => ({
            domain: siweDomain,
            uri: origin ?? '',
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
                if (stripLocalePrefix(window.location.pathname) !== '/2fa' && hasSiweTwoFactorIntentCookie()) {
                  clearSiweTwoFactorIntentCookie()
                  window.location.href = buildTwoFactorRedirectPath(window.location.pathname, window.location.search)
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
              void signOutAndRedirect({
                currentPathname: window.location.pathname,
              })
            }
          },
        }),
      })

      hasInitializedAppKit = true
      return appKitInstance
    }
    catch (error) {
      console.warn('Wallet initialization failed. Using local/default values.', error)
      appKitInstance = null
      return null
    }
    finally {
      appKitInitializationPromise = null
    }
  })()

  return appKitInitializationPromise
}

export function getAppKitInstance() {
  return appKitInstance
}

export function hasAppKitInstance() {
  return appKitInstance !== null
}

export function openSiweTwoFactorIntentCookie() {
  setSiweTwoFactorIntentCookie()
}
