import type { ViemRpcUrls } from '@/lib/viem-network'
import { createPublicClient } from 'viem'
import { createViemTransport, defaultViemNetwork, defaultViemRpcUrls } from '@/lib/viem-network'

const exchangeReferralAbi = [
  {
    name: 'referrals',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'maker', type: 'address' }],
    outputs: [
      { name: 'builder', type: 'address' },
      { name: 'affiliate', type: 'address' },
      { name: 'affiliatePercentage', type: 'uint256' },
      { name: 'locked', type: 'bool' },
    ],
  },
] as const

let exchangeClient: ReturnType<typeof createPublicClient> | null = null
let exchangeClientRpcUrlsKey: string | null = null

function getExchangeClient(rpcUrls: ViemRpcUrls) {
  const rpcUrlsKey = rpcUrls.join(',')
  if (!exchangeClient || exchangeClientRpcUrlsKey !== rpcUrlsKey) {
    exchangeClient = createPublicClient({
      chain: defaultViemNetwork,
      transport: createViemTransport(rpcUrls),
    })
    exchangeClientRpcUrlsKey = rpcUrlsKey
  }
  return exchangeClient
}

export async function fetchReferralLocked(
  exchange: `0x${string}`,
  maker: `0x${string}`,
  rpcUrls: ViemRpcUrls = defaultViemRpcUrls,
): Promise<boolean | null> {
  try {
    const result = await getExchangeClient(rpcUrls).readContract({
      address: exchange,
      abi: exchangeReferralAbi,
      functionName: 'referrals',
      args: [maker],
    }) as readonly [`0x${string}`, `0x${string}`, bigint, boolean]
    return result[3]
  }
  catch {
    return null
  }
}
