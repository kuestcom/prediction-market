import type { TypedDataDomain } from 'viem'
import { DEFAULT_CHAIN_ID } from '@/lib/network'

const TRADING_AUTH_DOMAIN_NAME = 'ClobAuthDomain'
const TRADING_AUTH_DOMAIN_VERSION = '1'
export const TRADING_AUTH_PRIMARY_TYPE = 'ClobAuth'

export const TRADING_AUTH_TYPES = {
  ClobAuth: [
    { name: 'address', type: 'address' },
    { name: 'timestamp', type: 'string' },
    { name: 'nonce', type: 'uint256' },
    { name: 'message', type: 'string' },
  ],
} as const

const TRADING_AUTH_NONCE = '0'

export function getTradingAuthDomain(chainId: number = DEFAULT_CHAIN_ID): TypedDataDomain {
  return {
    name: TRADING_AUTH_DOMAIN_NAME,
    version: TRADING_AUTH_DOMAIN_VERSION,
    chainId,
  }
}

export interface TradingAuthMessage {
  address: `0x${string}`
  timestamp: string
  nonce: bigint
  message: string
}

export function buildTradingAuthMessage(params: {
  address: `0x${string}`
  timestamp: string
  nonce?: string
  prompt?: string
}): TradingAuthMessage {
  const nonce = params.nonce ?? TRADING_AUTH_NONCE
  const prompt = params.prompt?.trim() || 'This message attests that I control the given wallet'

  return {
    address: params.address,
    timestamp: params.timestamp,
    nonce: BigInt(nonce),
    message: prompt,
  }
}
