import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test'

const createAppKit = vi.fn()

vi.mock('@reown/appkit/react', () => ({
  createAppKit,
  useAppKitAccount: vi.fn(),
  useAppKitTheme: () => ({ setThemeMode: vi.fn() }),
}))

vi.mock('@reown/appkit-controllers', () => ({
  ChainController: { getActiveCaipAddress: vi.fn() },
  SIWXUtil: { requestSignMessage: vi.fn() },
}))

vi.mock('@reown/appkit-siwe', () => ({
  createSIWEConfig: vi.fn(),
  formatMessage: vi.fn(),
  getAddressFromMessage: vi.fn(),
  getDidAddress: vi.fn(),
}))

vi.mock('@/lib/appkit', () => ({
  createAppKitWagmiAdapter: vi.fn(() => ({ wagmiConfig: {} })),
  defaultNetwork: { id: 1 },
  networks: [{ id: 1 }],
}))

vi.mock('@/hooks/usePublicRuntimeConfig', () => ({
  usePublicRuntimeConfig: () => ({ reownAppKitProjectId: 'test-project', siteUrl: 'https://markets.test' }),
}))

vi.mock('wagmi', () => ({
  cookieToInitialState: vi.fn(),
  WagmiProvider: ({ children }: { children: unknown }) => children,
  useConnections: () => [],
  useSignMessage: vi.fn(),
}))

vi.mock('next-intl', () => ({ useExtracted: () => (value: string) => value }))
vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'dark' }) }))
vi.mock('@/lib/auth-client', () => ({ authClient: {} }))

describe('appKitProvider SSR guard', () => {
  beforeEach(() => {
    createAppKit.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does not initialize AppKit during SSR import', async () => {
    const globalAny = globalThis as any
    const originalWindow = globalAny.window
    globalAny.window = undefined

    try {
      await import('@/providers/AppKitProvider?ssr')
      expect(createAppKit).not.toHaveBeenCalled()
    } finally {
      globalAny.window = originalWindow
    }
  })
})
