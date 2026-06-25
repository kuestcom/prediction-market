import { afterEach, describe, expect, it, vi } from 'vitest'

async function importViemNetwork() {
  vi.resetModules()
  return await import('@/lib/viem-network')
}

describe('viem-network RPC URL resolution', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('uses the default network RPC when NEXT_PUBLIC_RPC_URL is empty', async () => {
    vi.stubEnv('NEXT_PUBLIC_RPC_URL', '')

    const { defaultViemNetwork, defaultViemRpcUrl } = await importViemNetwork()

    expect(defaultViemRpcUrl).toBe(defaultViemNetwork.rpcUrls.default.http[0])
  })

  it('uses a valid NEXT_PUBLIC_RPC_URL override', async () => {
    vi.stubEnv('NEXT_PUBLIC_RPC_URL', ' https://rpc.example.com/path ')

    const { defaultViemRpcUrl } = await importViemNetwork()

    expect(defaultViemRpcUrl).toBe('https://rpc.example.com/path')
  })

  it.each([
    'rpc.example.com',
    'ftp://rpc.example.com',
    'ws://rpc.example.com',
  ])('rejects invalid NEXT_PUBLIC_RPC_URL value %s', async (rpcUrl) => {
    vi.stubEnv('NEXT_PUBLIC_RPC_URL', rpcUrl)

    await expect(importViemNetwork()).rejects.toThrow('Invalid NEXT_PUBLIC_RPC_URL')
  })
})
