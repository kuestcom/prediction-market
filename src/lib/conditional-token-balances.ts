import type { PublicClient } from 'viem'
import { createPublicClient, http } from 'viem'
import { MICRO_UNIT } from '@/lib/constants'
import { defaultViemNetwork, defaultViemRpcUrl } from '@/lib/viem-network'

export function createConditionalTokenBalanceClient(rpcUrl = defaultViemRpcUrl): PublicClient {
  return createPublicClient({
    chain: defaultViemNetwork,
    transport: http(rpcUrl),
  })
}

export function normalizeSharesFromBalance(balance: bigint): number {
  if (balance <= 0n) {
    return 0
  }

  const decimalValue = Number(balance) / MICRO_UNIT
  return Math.max(0, Math.floor(decimalValue * MICRO_UNIT) / MICRO_UNIT)
}
