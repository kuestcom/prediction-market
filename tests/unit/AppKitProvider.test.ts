import { SIWXUtil } from '@reown/appkit-controllers'
import { act, render, screen, waitFor } from '@testing-library/react'
import * as React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function ReadyConsumer({ ctx, onValue }: { ctx: React.Context<any>; onValue?: (value: any) => void }) {
  const value = React.use(ctx)
  onValue?.(value)
  return React.createElement('div', { 'data-testid': 'ready' }, value.isReady ? 'yes' : 'no')
}

const mocks = vi.hoisted(() => ({
  chainControllerGetActiveCaipAddress: vi.fn(),
  cookieToInitialState: vi.fn(),
  createAppKit: vi.fn(),
  createSIWEConfig: vi.fn(),
  setThemeMode: vi.fn(),
  siweClientSignIn: vi.fn(),
  siwxRequestSignMessage: vi.fn(),
  useAppKitAccount: vi.fn(),
  WagmiProvider: vi.fn(({ children }: any) => children),
}))

vi.mock('@reown/appkit/react', () => ({
  __esModule: true,
  createAppKit: mocks.createAppKit,
  useAppKitAccount: mocks.useAppKitAccount,
  useAppKitTheme: () => ({ setThemeMode: mocks.setThemeMode }),
}))

vi.mock('@reown/appkit-controllers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@reown/appkit-controllers')>()
  return {
    ...actual,
    ChainController: {
      ...actual.ChainController,
      getActiveCaipAddress: mocks.chainControllerGetActiveCaipAddress,
    },
    SIWXUtil: {
      ...actual.SIWXUtil,
      requestSignMessage: mocks.siwxRequestSignMessage,
    },
  }
})

vi.mock('@reown/appkit-siwe', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@reown/appkit-siwe')>()
  return {
    ...actual,
    createSIWEConfig: mocks.createSIWEConfig,
  }
})

vi.mock('@/lib/appkit', () => ({
  __esModule: true,
  createAppKitWagmiAdapter: vi.fn(() => ({ wagmiConfig: {} })),
  defaultNetwork: { id: 1 },
  networks: [{ id: 1 }],
}))

vi.mock('@/hooks/usePublicRuntimeConfig', () => ({
  usePublicRuntimeConfig: () => ({
    reownAppKitProjectId: 'test-project',
    siteUrl: 'https://markets.test',
  }),
}))

vi.mock('wagmi', () => ({
  cookieToInitialState: mocks.cookieToInitialState,
  WagmiProvider: mocks.WagmiProvider,
  useConnections: () => [],
}))

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'dark' }),
}))

vi.mock('next-intl', () => ({
  useExtracted: () => (value: string) => value,
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

vi.mock('next/dynamic', () => ({
  __esModule: true,
  default: (loader: () => Promise<{ default: React.ComponentType<any> }>) => {
    const LazyComponent = React.lazy(loader)
    return function MockDynamicComponent(props: Record<string, unknown>) {
      return React.createElement(React.Suspense, { fallback: null }, React.createElement(LazyComponent, props))
    }
  },
}))

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    getSession: vi.fn().mockResolvedValue({ data: { user: null } }),
    signOut: vi.fn(),
    siwe: {
      nonce: vi.fn(),
      verify: vi.fn().mockResolvedValue({ data: { success: true } }),
    },
  },
}))

describe('appKitProvider SSR guard', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
    mocks.chainControllerGetActiveCaipAddress.mockReset()
    mocks.chainControllerGetActiveCaipAddress.mockReturnValue('eip155:1:0x123')
    mocks.cookieToInitialState.mockReset()
    mocks.createAppKit.mockReset()
    mocks.createSIWEConfig.mockReset()
    mocks.createSIWEConfig.mockImplementation((config) => ({ ...config, signIn: mocks.siweClientSignIn }))
    mocks.setThemeMode.mockReset()
    mocks.siweClientSignIn.mockReset()
    mocks.siweClientSignIn.mockImplementation(() =>
      SIWXUtil.requestSignMessage().then(() => ({ address: '0x123', chainId: 1 })),
    )
    mocks.siwxRequestSignMessage.mockReset()
    mocks.siwxRequestSignMessage.mockResolvedValue(undefined)
    mocks.useAppKitAccount.mockReset()
    mocks.useAppKitAccount.mockReturnValue({
      address: undefined,
      embeddedWalletInfo: undefined,
      isConnected: false,
    })
    mocks.WagmiProvider.mockClear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does not initialize AppKit during SSR import', async () => {
    const globalAny = globalThis as any
    const originalWindow = globalAny.window
    globalAny.window = undefined

    try {
      await import('@/providers/AppKitProvider')

      expect(mocks.createAppKit).not.toHaveBeenCalled()
    } finally {
      globalAny.window = originalWindow
    }
  })

  it('initializes AppKit in the browser and synchronizes theme', async () => {
    const appKitInstance = {
      open: vi.fn(),
      close: vi.fn(),
    }
    mocks.createAppKit.mockReturnValueOnce(appKitInstance)

    const { AppKitContext } = await import('@/hooks/useAppKit')
    const AppKitProvider = (await import('@/providers/AppKitProvider')).default
    const TestAppKitProvider = AppKitProvider as React.ComponentType<
      React.PropsWithChildren<{ wagmiCookie: string | null }>
    >

    let latestValue: any = null
    function handleValue(value: any) {
      latestValue = value
    }

    const view = render(
      React.createElement(
        TestAppKitProvider,
        { wagmiCookie: 'test-state' },
        React.createElement(ReadyConsumer, { ctx: AppKitContext, onValue: handleValue }),
      ),
    )

    await waitFor(() => {
      expect(mocks.createAppKit).toHaveBeenCalledTimes(1)
      expect(mocks.createAppKit).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultNetwork: { id: 1 },
          networks: [{ id: 1 }],
        }),
      )
      expect(mocks.createSIWEConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          signOutOnAccountChange: false,
          signOutOnNetworkChange: false,
        }),
      )
      expect(mocks.setThemeMode).toHaveBeenCalledWith('dark')
      expect(mocks.cookieToInitialState).toHaveBeenCalledWith({}, 'wagmi.store=test-state')
      expect(mocks.WagmiProvider.mock.calls[0]?.[0]).toEqual(
        expect.objectContaining({
          config: {},
          initialState: undefined,
        }),
      )
      expect(screen.getByTestId('ready')).toHaveTextContent('yes')
      expect(latestValue?.isReady).toBe(true)
    })

    await act(async () => {
      await latestValue.open()
    })

    await waitFor(() => {
      expect(appKitInstance.open).toHaveBeenCalled()
    })

    await act(async () => {
      await latestValue.close()
    })
    expect(appKitInstance.close).toHaveBeenCalled()

    view.rerender(
      React.createElement(
        TestAppKitProvider,
        { wagmiCookie: 'test-state' },
        React.createElement(ReadyConsumer, { ctx: AppKitContext, onValue: handleValue }),
      ),
    )

    expect(mocks.createAppKit).toHaveBeenCalledTimes(1)
  })

  it('keeps defaults when AppKit initialization fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      mocks.createAppKit.mockImplementationOnce(() => {
        throw new Error('boom')
      })

      const { AppKitContext } = await import('@/hooks/useAppKit')
      const AppKitProvider = (await import('@/providers/AppKitProvider')).default
      const TestAppKitProvider = AppKitProvider as React.ComponentType<
        React.PropsWithChildren<{ wagmiCookie: string | null }>
      >
      let latestValue: any = null
      function handleValue(value: any) {
        latestValue = value
      }

      render(
        React.createElement(
          TestAppKitProvider,
          { wagmiCookie: 'test-state' },
          React.createElement(ReadyConsumer, { ctx: AppKitContext, onValue: handleValue }),
        ),
      )

      await act(async () => {
        await latestValue.open()
      })

      await waitFor(() => {
        expect(mocks.createAppKit).toHaveBeenCalled()
        expect(warnSpy).toHaveBeenCalled()
        expect(screen.getByTestId('ready')).toHaveTextContent('no')
      })
    } finally {
      warnSpy.mockRestore()
    }
  })

  it('automatically starts SIWE after an external wallet connects', async () => {
    mocks.createAppKit.mockReturnValueOnce({
      open: vi.fn(),
      close: vi.fn(),
    })
    mocks.useAppKitAccount.mockReturnValue({
      address: '0x123',
      embeddedWalletInfo: undefined,
      isConnected: true,
    })

    const { AppKitContext } = await import('@/hooks/useAppKit')
    const AppKitProvider = (await import('@/providers/AppKitProvider')).default
    const TestAppKitProvider = AppKitProvider as React.ComponentType<
      React.PropsWithChildren<{ wagmiCookie: string | null }>
    >

    render(
      React.createElement(
        TestAppKitProvider,
        { wagmiCookie: 'test-state' },
        React.createElement(ReadyConsumer, { ctx: AppKitContext }),
      ),
    )

    await waitFor(
      () => {
        expect(mocks.siwxRequestSignMessage).toHaveBeenCalledTimes(1)
      },
      { timeout: 2000 },
    )
  })

  it('deduplicates the complete SIWE sign-in orchestration', async () => {
    let releaseSignIn: (() => void) | undefined
    mocks.siwxRequestSignMessage.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          releaseSignIn = resolve
        }),
    )
    mocks.createAppKit.mockReturnValueOnce({
      open: vi.fn(),
      close: vi.fn(),
    })
    mocks.useAppKitAccount.mockReturnValue({
      address: '0x123',
      embeddedWalletInfo: undefined,
      isConnected: true,
    })

    const { AppKitContext } = await import('@/hooks/useAppKit')
    const AppKitProvider = (await import('@/providers/AppKitProvider')).default
    const TestAppKitProvider = AppKitProvider as React.ComponentType<
      React.PropsWithChildren<{ wagmiCookie: string | null }>
    >

    const view = render(
      React.createElement(
        TestAppKitProvider,
        { wagmiCookie: 'test-state' },
        React.createElement(ReadyConsumer, { ctx: AppKitContext }),
      ),
    )

    await waitFor(
      () => {
        expect(mocks.siwxRequestSignMessage).toHaveBeenCalledTimes(1)
        expect(mocks.siweClientSignIn).toHaveBeenCalledTimes(1)
      },
      { timeout: 2000 },
    )

    const siweClient = mocks.createSIWEConfig.mock.results[0]?.value as { signIn: () => Promise<unknown> }
    const manualSignIn = siweClient.signIn()
    expect(mocks.siweClientSignIn).toHaveBeenCalledTimes(1)
    expect(mocks.siwxRequestSignMessage).toHaveBeenCalledTimes(1)

    releaseSignIn?.()
    await manualSignIn
    view.unmount()
  })

  it('does not share a pending SIWE sign-in between different accounts', async () => {
    const pendingSignatures: Array<() => void> = []
    mocks.siwxRequestSignMessage.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          pendingSignatures.push(resolve)
        }),
    )
    mocks.createAppKit.mockReturnValueOnce({
      open: vi.fn(),
      close: vi.fn(),
    })
    mocks.useAppKitAccount.mockReturnValue({
      address: '0x123',
      embeddedWalletInfo: undefined,
      isConnected: true,
    })

    const { AppKitContext } = await import('@/hooks/useAppKit')
    const AppKitProvider = (await import('@/providers/AppKitProvider')).default
    const TestAppKitProvider = AppKitProvider as React.ComponentType<
      React.PropsWithChildren<{ wagmiCookie: string | null }>
    >

    const view = render(
      React.createElement(
        TestAppKitProvider,
        { wagmiCookie: 'test-state' },
        React.createElement(ReadyConsumer, { ctx: AppKitContext }),
      ),
    )

    await waitFor(
      () => {
        expect(mocks.siwxRequestSignMessage).toHaveBeenCalledTimes(1)
      },
      { timeout: 2000 },
    )

    mocks.chainControllerGetActiveCaipAddress.mockReturnValue('eip155:1:0x456')
    mocks.useAppKitAccount.mockReturnValue({
      address: '0x456',
      embeddedWalletInfo: undefined,
      isConnected: true,
    })
    view.rerender(
      React.createElement(
        TestAppKitProvider,
        { wagmiCookie: 'test-state' },
        React.createElement(ReadyConsumer, { ctx: AppKitContext }),
      ),
    )

    await waitFor(
      () => {
        expect(mocks.siwxRequestSignMessage).toHaveBeenCalledTimes(2)
        expect(mocks.siweClientSignIn).toHaveBeenCalledTimes(2)
      },
      { timeout: 2000 },
    )
    expect(pendingSignatures).toHaveLength(2)
    pendingSignatures.forEach((release) => release())
    view.unmount()
  })

  it('retries automatic SIWE when the previous attempt is cancelled', async () => {
    mocks.createAppKit.mockReturnValueOnce({
      open: vi.fn(),
      close: vi.fn(),
    })
    mocks.useAppKitAccount.mockReturnValue({
      address: '0x123',
      embeddedWalletInfo: undefined,
      isConnected: true,
    })

    const { AppKitContext } = await import('@/hooks/useAppKit')
    const AppKitProvider = (await import('@/providers/AppKitProvider')).default
    const TestAppKitProvider = AppKitProvider as React.ComponentType<
      React.PropsWithChildren<{ wagmiCookie: string | null }>
    >

    const view = render(
      React.createElement(
        TestAppKitProvider,
        { wagmiCookie: 'test-state' },
        React.createElement(ReadyConsumer, { ctx: AppKitContext }),
      ),
    )

    await new Promise((resolve) => setTimeout(resolve, 25))
    view.rerender(
      React.createElement(
        TestAppKitProvider,
        { wagmiCookie: 'test-state' },
        React.createElement(ReadyConsumer, { ctx: AppKitContext }),
      ),
    )

    await waitFor(
      () => {
        expect(mocks.siwxRequestSignMessage).toHaveBeenCalledTimes(1)
      },
      { timeout: 2000 },
    )
    view.unmount()
  })

  it('does not automatically start SIWE when the current region is blocked', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ blocked: true }),
    })
    vi.stubGlobal('fetch', fetchMock)
    mocks.createAppKit.mockReturnValueOnce({
      open: vi.fn(),
      close: vi.fn(),
    })
    mocks.useAppKitAccount.mockReturnValue({
      address: '0x123',
      embeddedWalletInfo: undefined,
      isConnected: true,
    })

    const { AppKitContext } = await import('@/hooks/useAppKit')
    const AppKitProvider = (await import('@/providers/AppKitProvider')).default
    const TestAppKitProvider = AppKitProvider as React.ComponentType<
      React.PropsWithChildren<{ wagmiCookie: string | null }>
    >

    render(
      React.createElement(
        TestAppKitProvider,
        { wagmiCookie: 'test-state' },
        React.createElement(ReadyConsumer, { ctx: AppKitContext }),
      ),
    )

    await waitFor(
      () => {
        expect(fetchMock).toHaveBeenCalledWith('/api/geoblock-status', {
          cache: 'no-store',
          headers: { accept: 'application/json' },
        })
      },
      { timeout: 2000 },
    )
    expect(mocks.siwxRequestSignMessage).not.toHaveBeenCalled()
  })

  it('shares the in-flight SIWE request with the manual Sign action', async () => {
    let releaseSignIn: (() => void) | undefined
    mocks.siwxRequestSignMessage.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          releaseSignIn = resolve
        }),
    )
    mocks.createAppKit.mockImplementationOnce(() => {
      return {
        open: vi.fn(),
        close: vi.fn(),
      }
    })
    mocks.useAppKitAccount.mockReturnValue({
      address: '0x123',
      embeddedWalletInfo: undefined,
      isConnected: true,
    })

    const { AppKitContext } = await import('@/hooks/useAppKit')
    const AppKitProvider = (await import('@/providers/AppKitProvider')).default
    const TestAppKitProvider = AppKitProvider as React.ComponentType<
      React.PropsWithChildren<{ wagmiCookie: string | null }>
    >

    const view = render(
      React.createElement(
        TestAppKitProvider,
        { wagmiCookie: 'test-state' },
        React.createElement(ReadyConsumer, { ctx: AppKitContext }),
      ),
    )

    await waitFor(
      () => {
        expect(mocks.siwxRequestSignMessage).toHaveBeenCalledTimes(1)
      },
      { timeout: 2000 },
    )

    const manualSignIn = SIWXUtil.requestSignMessage()
    expect(mocks.siwxRequestSignMessage).toHaveBeenCalledTimes(1)
    releaseSignIn?.()
    await manualSignIn
    view.unmount()
  })
})
