import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  cookieStorage: {},
  createStorage: vi.fn(() => 'cookie-storage'),
  WagmiAdapter: vi.fn(),
}))

vi.mock('@reown/appkit-adapter-wagmi', () => ({
  WagmiAdapter: class WagmiAdapter {
    constructor(options: unknown) {
      mocks.WagmiAdapter(options)
    }
  },
}))

vi.mock('wagmi', () => ({
  cookieStorage: mocks.cookieStorage,
  createStorage: mocks.createStorage,
}))

describe('appKit config', () => {
  beforeEach(() => {
    mocks.createStorage.mockClear()
    mocks.WagmiAdapter.mockClear()
  })

  it('configures cookie-backed SSR hydration', async () => {
    const { createAppKitWagmiAdapter, networks } = await import('@/lib/appkit')
    const { WAGMI_STORAGE_KEY } = await import('@/lib/wagmi-storage')

    createAppKitWagmiAdapter('test-project')

    expect(mocks.createStorage).toHaveBeenCalledWith({
      key: WAGMI_STORAGE_KEY,
      storage: mocks.cookieStorage,
    })
    expect(mocks.WagmiAdapter).toHaveBeenCalledWith({
      networks,
      projectId: 'test-project',
      ssr: true,
      storage: 'cookie-storage',
    })
  })
})
