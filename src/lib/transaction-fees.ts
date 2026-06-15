import type { PublicClient } from 'viem'
import { parseGwei } from 'viem'
import { AMOY_CHAIN_ID } from '@/lib/network'

const MIN_AMOY_PRIORITY_FEE_WEI = parseGwei('25')
const FEE_ESCALATION_STEPS = [
  { numerator: 15n, denominator: 10n },
  { numerator: 2n, denominator: 1n },
  { numerator: 3n, denominator: 1n },
] as const

export interface FeeOverrides {
  maxFeePerGas?: bigint
  maxPriorityFeePerGas?: bigint
}

type FeeEstimateClient = Pick<PublicClient, 'estimateFeesPerGas' | 'getGasPrice'>

function multiplyFee(value: bigint, numerator: bigint, denominator: bigint) {
  if (value <= 0n) {
    return value
  }

  return ((value * numerator) + denominator - 1n) / denominator
}

function getPriorityFloor(chainId: number) {
  return chainId === AMOY_CHAIN_ID ? MIN_AMOY_PRIORITY_FEE_WEI : 0n
}

function hasFeeOverrides(overrides: FeeOverrides | undefined): overrides is Required<FeeOverrides> | FeeOverrides {
  return Boolean(overrides?.maxFeePerGas || overrides?.maxPriorityFeePerGas)
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

function isUserRejectedFeeError(message: string) {
  return /\b(?:user rejected|user denied|rejected the request)\b/i.test(message)
}

export function isGasFeeTooLowError(message: string) {
  return /\b(?:gas price below minimum|gas tip cap .*minimum needed|transaction underpriced|replacement transaction underpriced|max fee per gas less than block base fee|fee cap less than block base fee)\b/i.test(message)
}

function isRetryableFeeError(message: string) {
  return isGasFeeTooLowError(message)
    || /\b(?:wallet_transport_error|transport error|bad gateway|gateway timeout|timeout waiting for relay)\b/i.test(message)
}

export async function getFeeOverridesForChain(
  client: FeeEstimateClient,
  chainId: number,
  attempt = 0,
  minPriorityFeePerGas?: bigint | null,
): Promise<FeeOverrides> {
  const priorityFloor = getPriorityFloor(chainId)
  const step = FEE_ESCALATION_STEPS[Math.min(attempt, FEE_ESCALATION_STEPS.length - 1)]!
  const priorityMinimum = (() => {
    if (typeof minPriorityFeePerGas !== 'bigint' || minPriorityFeePerGas <= 0n) {
      return priorityFloor
    }

    return minPriorityFeePerGas > priorityFloor ? minPriorityFeePerGas : priorityFloor
  })()

  try {
    const estimated = await client.estimateFeesPerGas()
    const hasEip1559Fees = typeof estimated.maxFeePerGas === 'bigint' || typeof estimated.maxPriorityFeePerGas === 'bigint'
    if (hasEip1559Fees) {
      const maxPriorityFeePerGas = (() => {
        const value = estimated.maxPriorityFeePerGas ?? null
        if (!value) {
          return priorityMinimum > 0n ? priorityMinimum : null
        }
        return value < priorityMinimum ? priorityMinimum : value
      })()

      const maxFeePerGas = (() => {
        const estimatedBase = estimated.maxFeePerGas ?? (typeof estimated.gasPrice === 'bigint' ? estimated.gasPrice * 2n : null)
        const bufferedBase = estimatedBase
          ? multiplyFee(estimatedBase, step.numerator, step.denominator)
          : null
        if (!maxPriorityFeePerGas) {
          return bufferedBase
        }

        const bufferedPriority = multiplyFee(maxPriorityFeePerGas, step.numerator, step.denominator)
        if (!bufferedBase || bufferedBase < bufferedPriority * 2n) {
          return bufferedPriority * 2n
        }
        return bufferedBase
      })()

      if (typeof maxFeePerGas === 'bigint' && typeof maxPriorityFeePerGas === 'bigint') {
        return {
          maxFeePerGas,
          maxPriorityFeePerGas: multiplyFee(maxPriorityFeePerGas, step.numerator, step.denominator),
        }
      }
    }

    if (typeof estimated.gasPrice === 'bigint') {
      const gasPrice = estimated.gasPrice < priorityMinimum ? priorityMinimum : estimated.gasPrice
      const maxPriorityFeePerGas = multiplyFee(gasPrice, step.numerator, step.denominator)
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
    const nextGasPrice = gasPrice < priorityMinimum ? priorityMinimum : gasPrice
    const maxPriorityFeePerGas = multiplyFee(nextGasPrice, step.numerator, step.denominator)
    return {
      maxPriorityFeePerGas,
      maxFeePerGas: maxPriorityFeePerGas * 2n,
    }
  }
  catch (error) {
    console.warn('Could not estimate fees with getGasPrice:', error)
  }

  if (priorityMinimum > 0n) {
    const maxPriorityFeePerGas = multiplyFee(priorityMinimum, step.numerator, step.denominator)
    return {
      maxPriorityFeePerGas,
      maxFeePerGas: maxPriorityFeePerGas * 2n,
    }
  }

  return {}
}

export async function sendWithEstimatedFeeRetry<T>(input: {
  chainId: number
  client: FeeEstimateClient
  send: (overrides?: FeeOverrides) => Promise<T>
}) {
  let minTipFloor: bigint | null = null
  let lastError: unknown = null

  for (let attempt = 0; attempt < FEE_ESCALATION_STEPS.length; attempt += 1) {
    const overrides = await getFeeOverridesForChain(input.client, input.chainId, attempt, minTipFloor)
    try {
      return await input.send(hasFeeOverrides(overrides) ? overrides : undefined)
    }
    catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : String(error)

      if (isUserRejectedFeeError(message)) {
        throw error
      }

      const minTip = parseMinTipCapFromError(message)
      if (minTip) {
        minTipFloor = minTipFloor && minTipFloor > minTip ? minTipFloor : minTip
        continue
      }

      if (!isRetryableFeeError(message)) {
        throw error
      }
    }
  }

  throw lastError
}
