import type { Address, TypedDataDomain } from 'viem'
import { createPublicClient, http, isAddress } from 'viem'
import {
  DEPOSIT_WALLET_FACTORY_ADDRESS,
  DEPOSIT_WALLET_IMPLEMENTATION_ADDRESS,
  ZERO_ADDRESS,
} from '@/lib/contracts'
import { DEFAULT_CHAIN_ID } from '@/lib/network'
import { defaultViemNetwork, defaultViemRpcUrl } from '@/lib/viem-network'

export const DEPOSIT_WALLET_DOMAIN_NAME = 'DepositWallet'
export const DEPOSIT_WALLET_DOMAIN_VERSION = '1'
export const DEPOSIT_WALLET_BATCH_DEADLINE_SECONDS = 240

const DEPOSIT_WALLET_FACTORY_ABI = [
  {
    name: 'predictWalletAddress',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'implementation_', type: 'address' },
      { name: 'walletId', type: 'bytes32' },
    ],
    outputs: [{ type: 'address' }],
  },
] as const

let client: ReturnType<typeof createPublicClient> | null = null

function getDepositWalletClient() {
  if (client) {
    return client
  }

  client = createPublicClient({
    chain: defaultViemNetwork,
    transport: http(defaultViemRpcUrl),
  })

  return client
}

export function getDepositWalletDomain(depositWallet: Address): TypedDataDomain {
  return {
    name: DEPOSIT_WALLET_DOMAIN_NAME,
    version: DEPOSIT_WALLET_DOMAIN_VERSION,
    chainId: DEFAULT_CHAIN_ID,
    verifyingContract: depositWallet,
  }
}

export function getDepositWalletId(owner: Address): `0x${string}` {
  const normalized = owner.toLowerCase().replace(/^0x/, '')
  return `0x${'0'.repeat(24)}${normalized}` as `0x${string}`
}

export async function getDepositWalletAddress(owner: Address) {
  return await getDepositWalletClient().readContract({
    address: DEPOSIT_WALLET_FACTORY_ADDRESS,
    abi: DEPOSIT_WALLET_FACTORY_ABI,
    functionName: 'predictWalletAddress',
    args: [DEPOSIT_WALLET_IMPLEMENTATION_ADDRESS, getDepositWalletId(owner)],
  }) as Address
}

export async function isDepositWalletDeployed(address?: Address | string | null) {
  if (!address || typeof address !== 'string' || !isAddress(address)) {
    return false
  }

  const normalizedAddress = address as Address
  if (normalizedAddress.toLowerCase() === ZERO_ADDRESS.toLowerCase()) {
    return false
  }

  const bytecode = await getDepositWalletClient().getBytecode({ address: normalizedAddress })
  return Boolean(bytecode && bytecode !== '0x')
}
