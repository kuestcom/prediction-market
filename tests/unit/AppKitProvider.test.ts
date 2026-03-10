import { act, render, screen, waitFor } from '@testing-library/react'
import * as React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function ReadyConsumer({ ctx, onValue }: { ctx: React.Context<any>, onValue?: (value: any) => void }) {
  const value = React.use(ctx)
  onValue?.(value)
  return React.createElement('div', { 'data-testid': 'ready' }, value.isReady ? 'yes' : 'no')
}

const mocks = vi.hoisted(() => ({
  createAppKit: vi.fn(),
  setThemeMode: vi.fn(),
}))

vi.mock('@reown/appkit/react', () => ({
  __esModule: true,
  createAppKit: mocks.createAppKit,
  useAppKitTheme: () => ({ setThemeMode: mocks.setThemeMode }),
}))

vi.mock('@/lib/appkit', () => ({
  __esModule: true,
  projectId: 'test-project',
  defaultNetwork: { id: 1 },
  networks: [{ id: 1 }],
  wagmiAdapter: {},
  wagmiConfig: {},
}))

vi.mock('wagmi', () => ({
  WagmiProvider: ({ children }: any) => children,
}))

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'dark' }),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
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
    mocks.createAppKit.mockReset()
    mocks.setThemeMode.mockReset()
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
        null,
        React.createElement(ReadyConsumer, { ctx: AppKitContext, onValue: handleValue }),
      ),
    )

    expect(mocks.createAppKit).not.toHaveBeenCalled()
    expect(mocks.setThemeMode).not.toHaveBeenCalled()
    expect(screen.getByTestId('ready')).toHaveTextContent('no')

    await act(async () => {
      await latestValue.open()
    })

    await waitFor(() => {
      expect(mocks.createAppKit).toHaveBeenCalledTimes(1)
      expect(mocks.setThemeMode).toHaveBeenCalledWith('dark')
      expect(screen.getByTestId('ready')).toHaveTextContent('yes')
      expect(appKitInstance.open).toHaveBeenCalled()
    })

    await act(async () => {
      await latestValue.close()
    })
    expect(appKitInstance.close).toHaveBeenCalled()

    view.rerender(
      React.createElement(
        AppKitProvider,
        null,
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
          null,
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
