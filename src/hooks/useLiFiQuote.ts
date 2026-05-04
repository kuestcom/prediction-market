import type { LiFiWalletTokenItem } from '@/hooks/useLiFiWalletTokens'
import { useQuery } from '@tanstack/react-query'
import { parseUnits } from 'viem'
import { sanitizeLiFiAmount } from '@/lib/lifi-amount'

const LIFI_QUOTE_QUERY_KEY = 'lifi-quote'

interface UseLiFiQuoteParams {
  fromToken?: LiFiWalletTokenItem | null
  amountValue: string
  fromAddress?: string | null
  toAddress?: string | null
  refreshIndex?: number
}

export function useLiFiQuote({
  fromToken,
  amountValue,
  fromAddress,
  toAddress,
  refreshIndex = 0,
}: UseLiFiQuoteParams) {
  const tokenDecimals = fromToken?.decimals ?? 18
  const sanitizedAmount = sanitizeLiFiAmount(amountValue, tokenDecimals)
  const hasAddresses = Boolean(fromAddress && toAddress && fromToken)
  const hasValidAmount = (() => {
    if (!fromToken || !sanitizedAmount) {
      return false
    }
    try {
      return parseUnits(sanitizedAmount, fromToken.decimals) > 0n
    }
    catch {
      return false
    }
  })()
  const canQuote = hasAddresses && hasValidAmount

  const query = useQuery({
    queryKey: [LIFI_QUOTE_QUERY_KEY, fromToken?.id, amountValue, fromAddress, toAddress, refreshIndex],
    enabled: canQuote,
    staleTime: 15_000,
    queryFn: async () => {
      if (!fromAddress || !toAddress || !fromToken) {
        return null
      }

      try {
        const response = await fetch('/api/lifi/quote', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            fromChainId: fromToken.chainId,
            fromTokenAddress: fromToken.address,
            fromTokenDecimals: fromToken.decimals,
            fromAddress,
            toAddress,
            amount: sanitizedAmount,
          }),
        })

        if (!response.ok) {
          return null
        }

        const data = await response.json()
        const quote = data?.quote

        const toTokenDecimals = Number(quote?.action?.toToken?.decimals ?? 6)
        const toAmountRaw = Number.parseFloat(quote?.estimate?.toAmount ?? '0')
        const toAmount = toAmountRaw / 10 ** toTokenDecimals
        const toAmountDisplay = Number.isFinite(toAmount)
          ? toAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })
          : null

        const gasUsd = quote?.estimate?.gasCosts?.reduce((sum: number, gas: { amountUSD?: string }) => {
          const usd = Number.parseFloat(gas.amountUSD ?? '0')
          return Number.isFinite(usd) ? sum + usd : sum
        }, 0) ?? 0
        const gasUsdDisplay = Number.isFinite(gasUsd)
          ? gasUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : null

        return {
          toAmountDisplay,
          gasUsdDisplay,
        }
      }
      catch {
        return null
      }
    },
  })

  return {
    quote: query.data,
    isLoadingQuote: query.isLoading || (query.isFetching && query.data === undefined),
    refetchQuote: query.refetch,
  }
}
