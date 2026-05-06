import type { PublicClient } from 'viem'
import type { Event } from '@/types'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useRef } from 'react'
import { createPublicClient, erc1155Abi, http } from 'viem'
import { MICRO_UNIT, OUTCOME_INDEX } from '@/lib/constants'
import { CONDITIONAL_TOKENS_CONTRACT } from '@/lib/contracts'
import { defaultViemNetwork, defaultViemRpcUrl } from '@/lib/viem-network'

export interface SharesByCondition {
  [conditionId: string]: {
    [OUTCOME_INDEX.YES]: number
    [OUTCOME_INDEX.NO]: number
  }
}

interface UseUserShareBalancesOptions {
  event?: Event
  ownerAddress?: `0x${string}` | null
}

function createBrowserPublicClient(): PublicClient {
  return createPublicClient({
    chain: defaultViemNetwork,
    transport: http(defaultViemRpcUrl),
  })
}

function normalizeSharesFromBalance(balance: bigint): number {
  if (balance <= 0n) {
    return 0
  }

  const decimalValue = Number(balance) / MICRO_UNIT
  return Math.max(0, Math.floor(decimalValue * MICRO_UNIT) / MICRO_UNIT)
}

export function useUserShareBalances({ event, ownerAddress }: UseUserShareBalancesOptions) {
  const clientRef = useRef<PublicClient | null>(null)
  if (clientRef.current === null && typeof window !== 'undefined') {
    clientRef.current = createBrowserPublicClient()
  }
  const client = clientRef.current

  const outcomeDescriptors = useMemo(() => {
    if (!event?.markets?.length) {
      return []
    }

    return event.markets.flatMap(market =>
      market.outcomes.map(outcome => ({
        conditionId: market.condition_id,
        outcomeIndex: outcome.outcome_index ?? OUTCOME_INDEX.YES,
        tokenId: outcome.token_id,
      })),
    )
  }, [event])

  const descriptorKey = useMemo(() => outcomeDescriptors.map(descriptor => `${descriptor.conditionId}:${descriptor.tokenId}`).join('|'), [outcomeDescriptors])

  const query = useQuery({
    queryKey: ['user-conditional-shares', ownerAddress, event?.slug, descriptorKey],
    enabled: Boolean(client && ownerAddress && outcomeDescriptors.length),
    staleTime: 10_000,
    gcTime: 5 * 60 * 1000,
    refetchInterval: 10_000,
    refetchIntervalInBackground: true,
    queryFn: async (): Promise<SharesByCondition> => {
      if (!client || !ownerAddress || !outcomeDescriptors.length) {
        return {}
      }

      const owners = outcomeDescriptors.map(() => ownerAddress)
      const tokenIds = outcomeDescriptors.map(descriptor => BigInt(descriptor.tokenId))

      const balances = await client.readContract({
        address: CONDITIONAL_TOKENS_CONTRACT,
        abi: erc1155Abi,
        functionName: 'balanceOfBatch',
        args: [owners, tokenIds],
      }) as bigint[]

      return outcomeDescriptors.reduce<SharesByCondition>((acc, descriptor, index) => {
        const normalizedShares = normalizeSharesFromBalance(balances[index] ?? 0n)

        if (!acc[descriptor.conditionId]) {
          acc[descriptor.conditionId] = {
            [OUTCOME_INDEX.YES]: 0,
            [OUTCOME_INDEX.NO]: 0,
          }
        }

        const outcomeKey = descriptor.outcomeIndex === OUTCOME_INDEX.NO
          ? OUTCOME_INDEX.NO
          : OUTCOME_INDEX.YES

        acc[descriptor.conditionId][outcomeKey] = normalizedShares
        return acc
      }, {})
    },
  })

  const sharesByCondition = useMemo(() => query.data ?? {}, [query.data])

  return {
    ...query,
    sharesByCondition,
  }
}
