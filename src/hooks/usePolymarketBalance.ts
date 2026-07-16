'use client'

import type { Address, PublicClient } from 'viem'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { createPublicClient, http } from 'viem'
import { polygon } from 'viem/chains'
import { usePublicRuntimeConfig } from '@/hooks/usePublicRuntimeConfig'
import { resolvePolymarketRpcUrl } from '@/lib/polymarket-network'
import { normalizeAddress } from '@/lib/wallet'
import { usePolymarketWallet } from '@/stores/usePolymarketWallet'

const POLYMARKET_CASH_BALANCE_QUERY_KEY = 'polymarket-pusd-balance'
const POLYMARKET_PUSD_ADDRESS = '0xC011a7E12a19f7B1f670d46F03B03f3342E82DFB' as Address
const PUSD_DECIMALS = 6
const BALANCE_OF_ABI = [{
  type: 'function',
  name: 'balanceOf',
  stateMutability: 'view',
  inputs: [{ name: 'account', type: 'address' }],
  outputs: [{ type: 'uint256' }],
}] as const

function createClient(rpcUrl: string): PublicClient {
  return createPublicClient({ chain: polygon, transport: http(rpcUrl) })
}

export function usePolymarketBalance({ enabled: enabledOption = true }: { enabled?: boolean } = {}) {
  const status = usePolymarketWallet(state => state.status)
  const funderAddressValue = usePolymarketWallet(state => state.funderAddress)
  const { reownAppKitProjectId } = usePublicRuntimeConfig()
  const rpcUrl = useMemo(
    () => resolvePolymarketRpcUrl(reownAppKitProjectId),
    [reownAppKitProjectId],
  )
  const client = useMemo(() => typeof window === 'undefined' ? null : createClient(rpcUrl), [rpcUrl])
  const funderAddress = normalizeAddress(funderAddressValue) as Address | null
  const enabled = Boolean(enabledOption && client && funderAddress && status === 'connected')

  const query = useQuery({
    queryKey: [POLYMARKET_CASH_BALANCE_QUERY_KEY, funderAddress],
    enabled,
    staleTime: 5_000,
    refetchInterval: enabled ? 10_000 : false,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      if (!client || !funderAddress) {
        return 0
      }
      const raw = await client.readContract({
        address: POLYMARKET_PUSD_ADDRESS,
        abi: BALANCE_OF_ABI,
        functionName: 'balanceOf',
        args: [funderAddress],
      })
      return Number(raw) / 10 ** PUSD_DECIMALS
    },
  })

  return {
    balance: enabled ? query.data ?? 0 : 0,
    isLoading: enabled && query.isLoading,
    isError: enabled && query.isError,
    error: enabled ? query.error : null,
    refetch: query.refetch,
  }
}
