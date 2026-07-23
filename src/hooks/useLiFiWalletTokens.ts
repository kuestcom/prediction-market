import type { AddEthereumChainParameter, ChainId, ExtendedChain, TokensExtendedResponse, WalletTokenExtended } from '@lifi/sdk'
import { useMemo } from 'react'
import { formatUnits } from 'viem'
import { useLiFiChainsQuery, useLiFiTokensQuery, useLiFiWalletBalancesQuery } from '@/hooks/useLiFiData'
import { formatNumber } from '@/lib/formatters'

export const MIN_USD_BALANCE = 2

function buildAcceptedTokenMap(tokensResponse: TokensExtendedResponse) {
  const acceptedByChain = new Map<number, Set<string>>()

  for (const [chainIdKey, tokens] of Object.entries(tokensResponse.tokens)) {
    const chainId = Number(chainIdKey)
    const accepted = new Set<string>()

    for (const token of tokens) {
      accepted.add(token.address.toLowerCase())
    }

    acceptedByChain.set(chainId, accepted)
  }

  return acceptedByChain
}

function buildChainMap(chains: ExtendedChain[]) {
  const chainMap = new Map<number, ExtendedChain>()
  for (const chain of chains) {
    chainMap.set(chain.id as number, chain)
  }
  return chainMap
}

function normalizeAmount(token: WalletTokenExtended) {
  try {
    const decimals = Number(token.decimals)
    if (!Number.isFinite(decimals)) {
      return 0
    }
    const amount = BigInt(token.amount)
    return Number(formatUnits(amount, decimals))
  }
  catch {
    return 0
  }
}

function toUsdValue(token: WalletTokenExtended) {
  const priceUsd = Number(token.priceUSD ?? 0)

  if (!Number.isFinite(priceUsd)) {
    return 0
  }

  const normalizedAmount = normalizeAmount(token)
  return normalizedAmount * priceUsd
}

function formatTokenAmount(token: WalletTokenExtended) {
  const normalizedAmount = normalizeAmount(token)

  return formatNumber(normalizedAmount, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  })
}

export interface LiFiWalletTokenItem {
  id: string
  chainId: number
  address: string
  decimals: number
  symbol: string
  network: string
  icon: string
  chainIcon?: string
  chainConfig?: AddEthereumChainParameter
  balance: string
  balanceRaw: number
  usd: string
  usdValue: number
  disabled: boolean
}

interface UseLiFiWalletTokensOptions {
  enabled?: boolean
}

export function useLiFiWalletTokens(walletAddress?: string | null, options: UseLiFiWalletTokensOptions = {}) {
  const isEnabled = Boolean(options.enabled ?? true)
  const hasAddress = Boolean(walletAddress)
  const queriesEnabled = isEnabled && hasAddress
  const tokensQuery = useLiFiTokensQuery(queriesEnabled)
  const balancesQuery = useLiFiWalletBalancesQuery(walletAddress, queriesEnabled)
  const chainsQuery = useLiFiChainsQuery(queriesEnabled)
  const items = useMemo<LiFiWalletTokenItem[]>(() => {
    const tokensResponse = tokensQuery.data
    const balancesByChain = balancesQuery.data
    const chains = chainsQuery.data
    if (!tokensResponse || !balancesByChain || !chains) {
      return []
    }

    const acceptedByChain = buildAcceptedTokenMap(tokensResponse)
    const chainMap = buildChainMap(chains)
    const nextItems: LiFiWalletTokenItem[] = []

    for (const [chainIdKey, walletTokens] of Object.entries(balancesByChain)) {
      const chainId = Number(chainIdKey) as ChainId
      const acceptedTokens = acceptedByChain.get(chainId)

      if (!acceptedTokens) {
        continue
      }

      const chain = chainMap.get(chainId)
      const networkName = chain?.name ?? `Chain ${chainId}`
      const networkIcon = chain?.logoURI

      for (const token of walletTokens) {
        if (!acceptedTokens.has(token.address.toLowerCase())) {
          continue
        }

        const usdValue = toUsdValue(token)
        if (!Number.isFinite(usdValue) || usdValue <= 0) {
          continue
        }

        nextItems.push({
          id: `${chainId}:${token.address}`,
          chainId,
          address: token.address,
          decimals: Number(token.decimals),
          symbol: token.symbol,
          network: networkName,
          icon: token.logoURI ?? '/images/deposit/transfer/usdc_dark.png',
          chainIcon: networkIcon,
          chainConfig: chain?.metamask,
          balance: formatTokenAmount(token),
          balanceRaw: normalizeAmount(token),
          usd: formatNumber(usdValue, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          usdValue,
          disabled: usdValue < MIN_USD_BALANCE,
        })
      }
    }

    nextItems.sort((a, b) => b.usdValue - a.usdValue)
    return nextItems
  }, [balancesQuery.data, chainsQuery.data, tokensQuery.data])
  const isLoadingTokens = [tokensQuery, balancesQuery, chainsQuery].some(
    query => query.isLoading || (query.isFetching && query.data === undefined),
  )

  async function refetchTokens() {
    await Promise.all([
      tokensQuery.refetch(),
      balancesQuery.refetch(),
      chainsQuery.refetch(),
    ])
  }

  return {
    items,
    isLoadingTokens,
    refetchTokens,
  }
}
