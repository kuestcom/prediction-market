import type { Address, TypedDataDomain } from 'viem'
import { createPublicClient, http } from 'viem'
import { SAFE_PROXY_FACTORY_ADDRESS, ZERO_ADDRESS } from '@/lib/contracts'
import { DEFAULT_CHAIN_ID } from '@/lib/network'
import { defaultViemNetwork, defaultViemRpcUrl } from '@/lib/viem-network'

export const SAFE_PROXY_DOMAIN_NAME = 'Contract Proxy Factory'
export const SAFE_PROXY_PRIMARY_TYPE = 'CreateProxy'

export const SAFE_PROXY_TYPES = {
  CreateProxy: [
    { name: 'paymentToken', type: 'address' },
    { name: 'payment', type: 'uint256' },
    { name: 'paymentReceiver', type: 'address' },
  ],
} as const

export const SAFE_PROXY_CREATE_PROXY_MESSAGE = {
  paymentToken: ZERO_ADDRESS,
  payment: 0n,
  paymentReceiver: ZERO_ADDRESS,
} as const

const SAFE_FACTORY_ABI = [
  {
    name: 'computeProxyAddress',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ type: 'address' }],
  },
] as const

let client: ReturnType<typeof createPublicClient> | null = null

function getSafeProxyClient() {
  if (client) {
    return client
  }

  client = createPublicClient({
    chain: defaultViemNetwork,
    transport: http(defaultViemRpcUrl),
  })

  return client
}

export function getSafeProxyDomain(): TypedDataDomain {
  return {
    name: SAFE_PROXY_DOMAIN_NAME,
    chainId: DEFAULT_CHAIN_ID,
    verifyingContract: SAFE_PROXY_FACTORY_ADDRESS,
  }
}

export async function getSafeProxyWalletAddress(owner: Address) {
  return await getSafeProxyClient().readContract({
    address: SAFE_PROXY_FACTORY_ADDRESS,
    abi: SAFE_FACTORY_ABI,
    functionName: 'computeProxyAddress',
    args: [owner],
  }) as Address
}

export async function isProxyWalletDeployed(address?: Address | string | null) {
  if (!address || typeof address !== 'string' || !address.startsWith('0x')) {
    return false
  }

  const normalizedAddress = address as Address
  if (normalizedAddress.toLowerCase() === ZERO_ADDRESS.toLowerCase()) {
    return false
  }

  const bytecode = await getSafeProxyClient().getBytecode({ address: normalizedAddress })
  return Boolean(bytecode && bytecode !== '0x')
}
