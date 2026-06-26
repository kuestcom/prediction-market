import { afterEach, describe, expect, it, vi } from 'vitest'

async function importViemNetwork() {
  vi.resetModules()
  return await import('@/lib/viem-network')
}

describe('viem-network RPC URL resolution', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    if (typeof window !== 'undefined') {
      delete (window as Window & { __PUBLIC_RUNTIME_CONFIG__?: unknown }).__PUBLIC_RUNTIME_CONFIG__
    }
    vi.resetModules()
  })

  it('uses the default network RPC when POLYGON_RPC_URL is empty', async () => {
    vi.stubEnv('CHAIN_ID', '')
    vi.stubEnv('POLYGON_RPC_URL', '')

    const { defaultViemNetwork, defaultViemRpcUrl } = await importViemNetwork()

    expect(defaultViemRpcUrl).toBe(defaultViemNetwork.rpcUrls.default.http[0])
  })

  it('uses a valid POLYGON_RPC_URL override', async () => {
    vi.stubEnv('CHAIN_ID', '')
    vi.stubEnv('POLYGON_RPC_URL', ' https://rpc.example.com/path ')

    const { resolveRuntimeViemRpcUrl } = await importViemNetwork()

    expect(resolveRuntimeViemRpcUrl()).toBe('https://rpc.example.com/path')
  })

  it('uses Polygon mainnet when CHAIN_ID is set to 137', async () => {
    vi.stubEnv('CHAIN_ID', '137')
    vi.stubEnv('POLYGON_RPC_URL', '')

    const { defaultViemNetwork, defaultViemRpcUrl } = await importViemNetwork()

    expect(defaultViemNetwork.id).toBe(137)
    expect(defaultViemRpcUrl).toBe(defaultViemNetwork.rpcUrls.default.http[0])
  })

  it('uses the runtime chain id from the public config when present', async () => {
    vi.stubEnv('CHAIN_ID', '')
    vi.stubEnv('POLYGON_RPC_URL', '')
    ;(window as Window & {
      __PUBLIC_RUNTIME_CONFIG__?: { chainId?: number }
    }).__PUBLIC_RUNTIME_CONFIG__ = {
      chainId: 137,
    }

    const { defaultViemNetwork, defaultViemRpcUrl } = await importViemNetwork()

    expect(defaultViemNetwork.id).toBe(137)
    expect(defaultViemRpcUrl).toBe(defaultViemNetwork.rpcUrls.default.http[0])
  })

  it.each([
    'rpc.example.com',
    'ftp://rpc.example.com',
    'ws://rpc.example.com',
  ])('rejects invalid POLYGON_RPC_URL value %s', async (rpcUrl) => {
    vi.stubEnv('CHAIN_ID', '')
    vi.stubEnv('POLYGON_RPC_URL', rpcUrl)

    const { resolveRuntimeViemRpcUrl } = await importViemNetwork()

    expect(() => resolveRuntimeViemRpcUrl()).toThrow('Invalid POLYGON_RPC_URL')
  })
})
