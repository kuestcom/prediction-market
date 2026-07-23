import type { TokensExtendedResponse, WalletTokenExtended } from '@lifi/sdk'
import { useMemo } from 'react'
import { formatUnits } from 'viem'
import { useLiFiTokensQuery, useLiFiWalletBalancesQuery } from '@/hooks/useLiFiData'
import { formatNumber } from '@/lib/formatters'

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

interface UseLiFiWalletUsdBalanceOptions {
  enabled?: boolean
}

export function useLiFiWalletUsdBalance(walletAddress?: string | null, options: UseLiFiWalletUsdBalanceOptions = {}) {
  const isEnabled = Boolean(options.enabled ?? true)
  const hasAddress = Boolean(walletAddress)
  const queriesEnabled = isEnabled && hasAddress
  const tokensQuery = useLiFiTokensQuery(queriesEnabled)
  const balancesQuery = useLiFiWalletBalancesQuery(walletAddress, queriesEnabled)
  const acceptedByChain = useMemo(
    () => tokensQuery.data ? buildAcceptedTokenMap(tokensQuery.data) : new Map<number, Set<string>>(),
    [tokensQuery.data],
  )
  const usdBalance = useMemo(() => {
    const balancesByChain = balancesQuery.data
    if (!balancesByChain) {
      return 0
    }

    let totalUsd = 0
    for (const [chainIdKey, walletTokens] of Object.entries(balancesByChain)) {
      const acceptedTokens = acceptedByChain.get(Number(chainIdKey))
      if (!acceptedTokens) {
        continue
      }

      for (const token of walletTokens) {
        if (acceptedTokens.has(token.address.toLowerCase())) {
          totalUsd += toUsdValue(token)
        }
      }
    }

    return Number.isFinite(totalUsd) ? totalUsd : 0
  }, [acceptedByChain, balancesQuery.data])
  const formattedUsdBalance = formatNumber(usdBalance, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const isLoadingUsdBalance = [tokensQuery, balancesQuery].some(
    query => query.isLoading || (query.isFetching && query.data === undefined),
  )

  return {
    usdBalance,
    formattedUsdBalance,
    isLoadingUsdBalance,
    refetchUsdBalance: balancesQuery.refetch,
  }
}
