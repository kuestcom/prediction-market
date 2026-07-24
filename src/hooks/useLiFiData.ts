import type { ExtendedChain, TokensExtendedResponse, WalletTokenExtended } from '@lifi/sdk'
import { useQuery } from '@tanstack/react-query'

const LIFI_TOKENS_QUERY_KEY = ['lifi', 'tokens'] as const
const LIFI_CHAINS_QUERY_KEY = ['lifi', 'chains'] as const
const LIFI_WALLET_BALANCES_QUERY_KEY = ['lifi', 'wallet-balances'] as const
const LIFI_CATALOG_STALE_TIME_MS = 5 * 60_000
const LIFI_BALANCES_STALE_TIME_MS = 60_000
const LIFI_GC_TIME_MS = 10 * 60_000

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isTokenCatalog(value: unknown): value is TokensExtendedResponse {
  if (!isRecord(value) || !isRecord(value.tokens)) {
    return false
  }

  return Object.values(value.tokens).every(tokens =>
    Array.isArray(tokens)
    && tokens.every(token => isRecord(token) && typeof token.address === 'string'),
  )
}

function isChainCatalog(value: unknown): value is ExtendedChain[] {
  return Array.isArray(value)
    && value.every(chain =>
      isRecord(chain)
      && typeof chain.id === 'number'
      && typeof chain.name === 'string',
    )
}

function isWalletToken(value: unknown): value is WalletTokenExtended {
  return isRecord(value)
    && typeof value.address === 'string'
    && typeof value.symbol === 'string'
    && typeof value.decimals === 'number'
    && typeof value.amount === 'string'
    && typeof value.priceUSD === 'string'
}

function isWalletBalances(value: unknown): value is Record<number, WalletTokenExtended[]> {
  return isRecord(value)
    && Object.values(value).every(tokens =>
      Array.isArray(tokens) && tokens.every(isWalletToken),
    )
}

async function getLiFiResponseError(response: Response, fallbackMessage: string) {
  const data: unknown = await response.json().catch(() => null)
  const message = isRecord(data) && typeof data.error === 'string'
    ? data.error
    : fallbackMessage

  return new Error(message)
}

export function useLiFiTokensQuery(enabled: boolean) {
  return useQuery({
    queryKey: LIFI_TOKENS_QUERY_KEY,
    enabled,
    staleTime: LIFI_CATALOG_STALE_TIME_MS,
    gcTime: LIFI_GC_TIME_MS,
    refetchOnMount: 'always',
    queryFn: async (): Promise<TokensExtendedResponse> => {
      const response = await fetch('/api/lifi/tokens', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })

      if (!response.ok) {
        throw await getLiFiResponseError(response, 'Failed to fetch LI.FI tokens.')
      }

      const data: unknown = await response.json()
      if (!isRecord(data) || !isTokenCatalog(data.tokens)) {
        throw new Error('LI.FI returned an invalid token catalog.')
      }

      return data.tokens
    },
  })
}

export function useLiFiChainsQuery(enabled: boolean) {
  return useQuery({
    queryKey: LIFI_CHAINS_QUERY_KEY,
    enabled,
    staleTime: LIFI_CATALOG_STALE_TIME_MS,
    gcTime: LIFI_GC_TIME_MS,
    refetchOnMount: 'always',
    queryFn: async (): Promise<ExtendedChain[]> => {
      const response = await fetch('/api/lifi/chains')
      if (!response.ok) {
        throw await getLiFiResponseError(response, 'Failed to fetch LI.FI chains.')
      }

      const data: unknown = await response.json()
      if (!isRecord(data) || !isChainCatalog(data.chains)) {
        throw new Error('LI.FI returned an invalid chain catalog.')
      }

      return data.chains
    },
  })
}

export function useLiFiWalletBalancesQuery(walletAddress: string | null | undefined, enabled: boolean) {
  return useQuery({
    queryKey: [...LIFI_WALLET_BALANCES_QUERY_KEY, walletAddress],
    enabled: enabled && Boolean(walletAddress),
    staleTime: LIFI_BALANCES_STALE_TIME_MS,
    gcTime: LIFI_GC_TIME_MS,
    refetchOnMount: 'always',
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
        throw await getLiFiResponseError(response, 'Failed to fetch LI.FI wallet balances.')
      }

      const data: unknown = await response.json()
      if (!isRecord(data) || !isWalletBalances(data.balances)) {
        throw new Error('LI.FI returned invalid wallet balances.')
      }

      return data.balances
    },
  })
}
