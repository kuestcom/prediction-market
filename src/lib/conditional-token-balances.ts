import type { PublicClient } from 'viem'
import type { ViemRpcUrls } from '@/lib/viem-network'
import { createPublicClient } from 'viem'
import { MICRO_UNIT } from '@/lib/constants'
import { createViemTransport, defaultViemNetwork, defaultViemRpcUrls } from '@/lib/viem-network'

export function createConditionalTokenBalanceClient(rpcUrls: ViemRpcUrls = defaultViemRpcUrls): PublicClient {
  return createPublicClient({
    chain: defaultViemNetwork,
    transport: createViemTransport(rpcUrls),
  })
}

export function normalizeSharesFromBalance(balance: bigint): number {
  if (balance <= 0n) {
    return 0
  }

  const decimalValue = Number(balance) / MICRO_UNIT
  return Math.max(0, Math.floor(decimalValue * MICRO_UNIT) / MICRO_UNIT)
}
