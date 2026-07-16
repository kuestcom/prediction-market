import { act, render, screen, waitFor } from '@testing-library/react'
import * as React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function ReadyConsumer({ ctx, onValue }: { ctx: React.Context<any>, onValue?: (value: any) => void }) {
  const value = React.use(ctx)
  onValue?.(value)
  return React.createElement('div', { 'data-testid': 'ready' }, value.isReady ? 'yes' : 'no')
}

const mocks = vi.hoisted(() => ({
  cookieToInitialState: vi.fn(),
  createAppKit: vi.fn(),
  createSIWEConfig: vi.fn(),
  setThemeMode: vi.fn(),
  WagmiProvider: vi.fn(({ children }: any) => children),
}))

vi.mock('@reown/appkit/react', () => ({
  __esModule: true,
  createAppKit: mocks.createAppKit,
  useAppKitTheme: () => ({ setThemeMode: mocks.setThemeMode }),
}))

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
      return React.createElement(
        React.Suspense,
        { fallback: null },
        React.createElement(LazyComponent, props),
      )
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
    mocks.cookieToInitialState.mockReset()
    mocks.createAppKit.mockReset()
    mocks.createSIWEConfig.mockReset()
    mocks.createSIWEConfig.mockImplementation(config => config)
    mocks.setThemeMode.mockReset()
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
    }
    finally {
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

    let latestValue: any = null
    function handleValue(value: any) {
      latestValue = value
    }

    const view = render(
      React.createElement(
        AppKitProvider,
        { wagmiCookie: 'test-state' },
        React.createElement(ReadyConsumer, { ctx: AppKitContext, onValue: handleValue }),
      ),
    )

    await waitFor(() => {
      expect(mocks.createAppKit).toHaveBeenCalledTimes(1)
      expect(mocks.createAppKit).toHaveBeenCalledWith(expect.objectContaining({
        defaultNetwork: { id: 1 },
        networks: [{ id: 1 }],
      }))
      expect(mocks.createSIWEConfig).toHaveBeenCalledWith(expect.objectContaining({
        signOutOnAccountChange: false,
        signOutOnNetworkChange: false,
      }))
      expect(mocks.setThemeMode).toHaveBeenCalledWith('dark')
      expect(mocks.cookieToInitialState).toHaveBeenCalledWith({}, 'wagmi.store=test-state')
      expect(mocks.WagmiProvider.mock.calls[0]?.[0]).toEqual(expect.objectContaining({
        config: {},
        initialState: undefined,
      }))
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
        AppKitProvider,
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
      let latestValue: any = null
      function handleValue(value: any) {
        latestValue = value
      }

      render(
        React.createElement(
          AppKitProvider,
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
    }
    finally {
      warnSpy.mockRestore()
    }
  })
})
