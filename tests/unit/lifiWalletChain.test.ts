import type { AddEthereumChainParameter } from '@lifi/sdk'
import { describe, expect, it, vi } from 'vitest'
import { ensureLiFiWalletChain } from '@/lib/lifi-wallet-chain'

const polygon: AddEthereumChainParameter = {
  chainId: '0x89',
  chainName: 'Polygon',
  nativeCurrency: {
    name: 'POL',
    symbol: 'POL',
    decimals: 18,
  },
  rpcUrls: ['https://polygon-rpc.com'],
  blockExplorerUrls: ['https://polygonscan.com'],
}

describe('ensureLiFiWalletChain', () => {
  it('does not request a switch when the source chain is already active', async () => {
    const request = vi.fn().mockResolvedValue('0x89')

    await ensureLiFiWalletChain({ request }, 137, polygon)

    expect(request).toHaveBeenCalledTimes(1)
    expect(request).toHaveBeenCalledWith({ method: 'eth_chainId' })
  })

  it('adds an unknown source chain before continuing', async () => {
    let currentChainId = '0x1'
    let chainAdded = false
    const request = vi.fn(async ({ method }: { method: string, params?: unknown[] }) => {
      if (method === 'eth_chainId') {
        return currentChainId
      }
      if (method === 'wallet_switchEthereumChain') {
        if (!chainAdded) {
          throw Object.assign(new Error('Unknown chain.'), { code: 4902 })
        }
        currentChainId = '0x89'
        return null
      }
      if (method === 'wallet_addEthereumChain') {
        chainAdded = true
        return null
      }
      return null
    })

    await ensureLiFiWalletChain({ request }, 137, polygon)

    expect(request).toHaveBeenCalledWith({
      method: 'wallet_addEthereumChain',
      params: [{ ...polygon, chainId: '0x89' }],
    })
  })

  it('preserves wallet cancellations instead of replacing their message', async () => {
    const cancellation = Object.assign(new Error('User rejected the request.'), { code: 4001 })
    const request = vi.fn()
      .mockResolvedValueOnce('0x1')
      .mockRejectedValueOnce(cancellation)

    await expect(ensureLiFiWalletChain({ request }, 137, polygon)).rejects.toBe(cancellation)
  })

  it('requests a manual switch when an unknown chain has no configuration', async () => {
    const unknownChain = Object.assign(new Error('Unknown chain.'), { code: 4902 })
    const request = vi.fn()
      .mockResolvedValueOnce('0x1')
      .mockRejectedValueOnce(unknownChain)

    await expect(ensureLiFiWalletChain({ request }, 137)).rejects.toThrow(
      'Switch your wallet to chain 137 to continue.',
    )
  })
})
