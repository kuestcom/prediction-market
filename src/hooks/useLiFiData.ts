import type { ExtendedChain, TokensExtendedResponse, WalletTokenExtended } from '@lifi/sdk'
import { useQuery } from '@tanstack/react-query'

const LIFI_TOKENS_QUERY_KEY = ['lifi', 'tokens'] as const
const LIFI_CHAINS_QUERY_KEY = ['lifi', 'chains'] as const
const LIFI_WALLET_BALANCES_QUERY_KEY = ['lifi', 'wallet-balances'] as const
const LIFI_CATALOG_STALE_TIME_MS = 5 * 60_000
const LIFI_BALANCES_STALE_TIME_MS = 60_000
const LIFI_GC_TIME_MS = 10 * 60_000

export function useLiFiTokensQuery(enabled: boolean) {
  return useQuery({
    queryKey: LIFI_TOKENS_QUERY_KEY,
    enabled,
    staleTime: LIFI_CATALOG_STALE_TIME_MS,
    gcTime: LIFI_GC_TIME_MS,
    queryFn: async (): Promise<TokensExtendedResponse | null> => {
      const response = await fetch('/api/lifi/tokens', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })

      if (!response.ok) {
        return null
      }

      const data = await response.json()
      return data.tokens as TokensExtendedResponse
    },
  })
}

export function useLiFiChainsQuery(enabled: boolean) {
  return useQuery({
    queryKey: LIFI_CHAINS_QUERY_KEY,
    enabled,
    staleTime: LIFI_CATALOG_STALE_TIME_MS,
    gcTime: LIFI_GC_TIME_MS,
    queryFn: async (): Promise<ExtendedChain[] | null> => {
      const response = await fetch('/api/lifi/chains')
      if (!response.ok) {
        return null
      }

      const data = await response.json()
      return data.chains as ExtendedChain[]
    },
  })
}

export function useLiFiWalletBalancesQuery(walletAddress: string | null | undefined, enabled: boolean) {
  return useQuery({
    queryKey: [...LIFI_WALLET_BALANCES_QUERY_KEY, walletAddress],
    enabled: enabled && Boolean(walletAddress),
    staleTime: LIFI_BALANCES_STALE_TIME_MS,
    gcTime: LIFI_GC_TIME_MS,
    queryFn: async (): Promise<Record<number, WalletTokenExtended[]> | null> => {
      if (!walletAddress) {
        return null
      }

      const response = await fetch('/api/lifi/balances', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ walletAddress }),
      })

      if (!response.ok) {
        return null
      }

      const data = await response.json()
      return data.balances as Record<number, WalletTokenExtended[]>
    },
  })
}
