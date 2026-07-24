import type { AddEthereumChainParameter } from '@lifi/sdk'
import { numberToHex } from 'viem'

export interface LiFiWalletProvider {
  request: (request: { method: string, params?: unknown[] }) => Promise<unknown>
}

function getProviderErrorCode(error: unknown): number | null {
  if (!error || typeof error !== 'object') {
    return null
  }

  if ('code' in error && typeof error.code === 'number') {
    return error.code
  }

  if ('cause' in error) {
    return getProviderErrorCode(error.cause)
  }

  return null
}

export async function ensureLiFiWalletChain(
  provider: LiFiWalletProvider,
  chainId: number,
  chainConfig?: AddEthereumChainParameter,
) {
  const targetChainId = numberToHex(chainId)
  const currentChainId = await provider.request({ method: 'eth_chainId' })
  if (typeof currentChainId === 'string' && Number(currentChainId) === chainId) {
    return
  }

  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: targetChainId }],
    })
  }
  catch (error) {
    if (getProviderErrorCode(error) !== 4902) {
      throw error
    }

    if (!chainConfig) {
      throw new Error(`Switch your wallet to chain ${chainId} to continue.`, {
        cause: error,
      })
    }

    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [{ ...chainConfig, chainId: targetChainId }],
    })
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: targetChainId }],
    })
  }

  const nextChainId = await provider.request({ method: 'eth_chainId' })
  if (typeof nextChainId !== 'string' || Number(nextChainId) !== chainId) {
    throw new Error(`Switch your wallet to ${chainConfig?.chainName ?? `chain ${chainId}`} to continue.`)
  }
}
