import { createPublicClient, http } from 'viem'
import { defaultNetwork } from '@/lib/appkit'

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

function getExchangeClient() {
  if (!exchangeClient) {
    exchangeClient = createPublicClient({
      chain: defaultNetwork,
      transport: http(defaultNetwork.rpcUrls.default.http[0]),
    })
  }
  return exchangeClient
}

export async function fetchReferralLocked(
  exchange: `0x${string}`,
  maker: `0x${string}`,
): Promise<boolean | null> {
  try {
    const result = await getExchangeClient().readContract({
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
