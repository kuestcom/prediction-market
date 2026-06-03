import type { PublicClient } from 'viem'
import { parseGwei } from 'viem'
import { AMOY_CHAIN_ID } from '@/lib/network'

const MIN_AMOY_PRIORITY_FEE_WEI = parseGwei('25')
const FEE_BUFFER_NUMERATOR = 12n
const FEE_BUFFER_DENOMINATOR = 10n

export interface FeeOverrides {
  maxFeePerGas?: bigint
  maxPriorityFeePerGas?: bigint
}

type FeeEstimateClient = Pick<PublicClient, 'estimateFeesPerGas' | 'getGasPrice'>

function applyFeeBuffer(value: bigint) {
  if (value <= 0n) {
    return value
  }

  return (value * FEE_BUFFER_NUMERATOR) / FEE_BUFFER_DENOMINATOR
}

function getPriorityFloor(chainId: number) {
  return chainId === AMOY_CHAIN_ID ? MIN_AMOY_PRIORITY_FEE_WEI : 0n
}

function hasFeeOverrides(overrides: FeeOverrides | undefined): overrides is Required<FeeOverrides> | FeeOverrides {
  return Boolean(overrides?.maxFeePerGas || overrides?.maxPriorityFeePerGas)
}

function areFeeOverridesEqual(left: FeeOverrides | undefined, right: FeeOverrides | undefined) {
  return left?.maxFeePerGas === right?.maxFeePerGas
    && left?.maxPriorityFeePerGas === right?.maxPriorityFeePerGas
}

export function parseMinTipCapFromError(errorMessage: string): bigint | null {
  const match = errorMessage.match(/minimum needed\s+(\d+)/i)
  if (!match?.[1]) {
    return null
  }

  try {
    return BigInt(match[1])
  }
  catch {
    return null
  }
}

export async function getFeeOverridesForChain(client: FeeEstimateClient, chainId: number): Promise<FeeOverrides> {
  const priorityFloor = getPriorityFloor(chainId)

  try {
    const estimated = await client.estimateFeesPerGas()
    const hasEip1559Fees = typeof estimated.maxFeePerGas === 'bigint' || typeof estimated.maxPriorityFeePerGas === 'bigint'
    if (hasEip1559Fees) {
      const maxPriorityFeePerGas = (() => {
        const value = estimated.maxPriorityFeePerGas ?? null
        if (!value) {
          return priorityFloor > 0n ? priorityFloor : null
        }
        return value < priorityFloor ? priorityFloor : value
      })()

      const maxFeePerGas = (() => {
        const estimatedBase = estimated.maxFeePerGas ?? (typeof estimated.gasPrice === 'bigint' ? estimated.gasPrice * 2n : null)
        const bufferedBase = estimatedBase ? applyFeeBuffer(estimatedBase) : null
        if (!maxPriorityFeePerGas) {
          return bufferedBase
        }

        const bufferedPriority = applyFeeBuffer(maxPriorityFeePerGas)
        if (!bufferedBase || bufferedBase < bufferedPriority * 2n) {
          return bufferedPriority * 2n
        }
        return bufferedBase
      })()

      if (typeof maxFeePerGas === 'bigint' && typeof maxPriorityFeePerGas === 'bigint') {
        return {
          maxFeePerGas,
          maxPriorityFeePerGas: applyFeeBuffer(maxPriorityFeePerGas),
        }
      }
    }

    if (typeof estimated.gasPrice === 'bigint') {
      const gasPrice = estimated.gasPrice < priorityFloor ? priorityFloor : estimated.gasPrice
      const maxPriorityFeePerGas = applyFeeBuffer(gasPrice)
      return {
        maxPriorityFeePerGas,
        maxFeePerGas: maxPriorityFeePerGas * 2n,
      }
    }
  }
  catch (error) {
    console.warn('Could not estimate fees with estimateFeesPerGas:', error)
  }

  try {
    const gasPrice = await client.getGasPrice()
    const nextGasPrice = gasPrice < priorityFloor ? priorityFloor : gasPrice
    const maxPriorityFeePerGas = applyFeeBuffer(nextGasPrice)
    return {
      maxPriorityFeePerGas,
      maxFeePerGas: maxPriorityFeePerGas * 2n,
    }
  }
  catch (error) {
    console.warn('Could not estimate fees with getGasPrice:', error)
  }

  if (priorityFloor > 0n) {
    return {
      maxPriorityFeePerGas: priorityFloor,
      maxFeePerGas: priorityFloor * 2n,
    }
  }

  return {}
}

export async function sendWithEstimatedFeeRetry<T>(input: {
  chainId: number
  client: FeeEstimateClient
  send: (overrides?: FeeOverrides) => Promise<T>
}) {
  const initialOverrides = await getFeeOverridesForChain(input.client, input.chainId)

  try {
    return await input.send(hasFeeOverrides(initialOverrides) ? initialOverrides : undefined)
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const minTip = parseMinTipCapFromError(message)
    if (minTip) {
      const bufferedMinTip = applyFeeBuffer(minTip)
      return input.send({
        maxPriorityFeePerGas: bufferedMinTip,
        maxFeePerGas: bufferedMinTip * 2n,
      })
    }

    const retryOverrides = await getFeeOverridesForChain(input.client, input.chainId)
    if (!hasFeeOverrides(retryOverrides) || areFeeOverridesEqual(initialOverrides, retryOverrides)) {
      throw error
    }

    return input.send(retryOverrides)
  }
}
