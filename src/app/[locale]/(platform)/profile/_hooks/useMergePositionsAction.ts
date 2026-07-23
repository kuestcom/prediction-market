import type { InfiniteData, QueryClient } from '@tanstack/react-query'
import type { SharesByCondition } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useUserShareBalances'
import type { MergeableMarket } from '@/app/[locale]/(platform)/profile/_components/MergePositionsDialog'
import type { PublicPosition } from '@/app/[locale]/(platform)/profile/_components/PublicPositionItem'
import type { ViemRpcUrls } from '@/lib/viem-network'
import type { User } from '@/types'
import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useSignTypedData } from 'wagmi'
import { fetchLockedSharesByCondition, fetchOnchainSharesByCondition, isActiveUserPositionsQueryKeyForAddress } from '@/app/[locale]/(platform)/profile/_utils/PublicPositionsUtils'
import { DEPOSIT_WALLET_BALANCE_QUERY_KEY } from '@/hooks/useBalance'
import { useSignaturePromptRunner } from '@/hooks/useSignaturePromptRunner'
import { DEFAULT_CONDITION_PARTITION } from '@/lib/constants'
import { UMA_NEG_RISK_ADAPTER_ADDRESS, ZERO_BYTES32 } from '@/lib/contracts'
import { toMicro } from '@/lib/formatters'
import { applyConditionReductionsToPublicPositions, applyShareDeltas, updateQueryDataWhere } from '@/lib/optimistic-trading'
import { isTradingAuthRequiredError } from '@/lib/trading-auth/errors'
import { normalizeAddress } from '@/lib/wallet'
import { buildMergePositionCall } from '@/lib/wallet/transactions'
import { useNotifications } from '@/stores/useNotifications'

const MAX_MERGE_POSITION_CALLS_PER_BATCH = 25

interface PreparedMerge {
  conditionId: string
  mergeAmount: number
  isNegRisk: boolean
}

function isSplitFallbackError(error: unknown): error is Error & { successfulItems: PreparedMerge[] } {
  return error instanceof Error
    && error.name === 'DepositWalletCallItemsSplitFallbackError'
    && Array.isArray((error as Error & { successfulItems?: unknown }).successfulItems)
}

interface UseMergePositionsActionOptions {
  mergeableMarkets: MergeableMarket[]
  hasMergeableMarkets: boolean
  user: User | null
  ensureTradingReady: () => boolean
  openTradeRequirements: (options?: {
    forceTradingAuth?: boolean
    onTradingReady?: () => void
  }) => void
  queryClient: QueryClient
  viemRpcUrls: ViemRpcUrls
  onSuccess?: () => void
}

export function useMergePositionsAction({
  mergeableMarkets,
  hasMergeableMarkets,
  user,
  ensureTradingReady,
  openTradeRequirements,
  queryClient,
  viemRpcUrls,
  onSuccess,
}: UseMergePositionsActionOptions) {
  const [isMergeProcessing, setIsMergeProcessing] = useState(false)
  const [mergeBatchCount, setMergeBatchCount] = useState(0)
  const handleMergeAllRef = useRef<() => void>(() => {})
  const addLocalOrderFillNotification = useNotifications(state => state.addLocalOrderFillNotification)
  const { runWithSignaturePrompt } = useSignaturePromptRunner()
  const { signTypedDataAsync } = useSignTypedData()

  const retryMergeAfterTradingSetup = useCallback(() => {
    void handleMergeAllRef.current()
  }, [])

  const applySuccessfulMerges = useCallback((successfulMerges: PreparedMerge[]) => {
    if (successfulMerges.length === 0) {
      return
    }

    const normalizedDepositWallet = normalizeAddress(user?.deposit_wallet_address)
    const publicPositionReductions = successfulMerges.map(entry => ({
      conditionId: entry.conditionId,
      sharesDelta: -entry.mergeAmount,
    }))
    const shareDeltas = successfulMerges.flatMap(entry => ([
      {
        conditionId: entry.conditionId,
        outcomeIndex: 0 as const,
        sharesDelta: -entry.mergeAmount,
      },
      {
        conditionId: entry.conditionId,
        outcomeIndex: 1 as const,
        sharesDelta: -entry.mergeAmount,
      },
    ]))

    updateQueryDataWhere<InfiniteData<PublicPosition[]>>(
      queryClient,
      ['user-positions'],
      currentQueryKey => isActiveUserPositionsQueryKeyForAddress(currentQueryKey, normalizedDepositWallet),
      current => current
        ? {
            ...current,
            pages: current.pages.map(page =>
              applyConditionReductionsToPublicPositions(page, publicPositionReductions) ?? page,
            ),
          }
        : current,
    )

    updateQueryDataWhere<SharesByCondition>(
      queryClient,
      ['user-conditional-shares'],
      () => true,
      current => applyShareDeltas(current, shareDeltas),
    )
  }, [queryClient, user?.deposit_wallet_address])

  const invalidateMergeQueries = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['user-positions'] })
    void queryClient.invalidateQueries({ queryKey: [DEPOSIT_WALLET_BALANCE_QUERY_KEY] })
    void queryClient.invalidateQueries({ queryKey: ['user-conditional-shares'] })
  }, [queryClient])

  const handleMergeAll = useCallback(async () => {
    if (!hasMergeableMarkets) {
      toast.info('No mergeable positions available right now.')
      setMergeBatchCount(0)
      return
    }

    if (!ensureTradingReady()) {
      setMergeBatchCount(0)
      return
    }

    if (!user?.deposit_wallet_address || !user?.address) {
      toast.error('Set up your Deposit Wallet before merging shares.')
      setMergeBatchCount(0)
      return
    }

    try {
      setIsMergeProcessing(true)

      const [availabilityByCondition, onchainSharesByCondition] = await Promise.all([
        fetchLockedSharesByCondition(mergeableMarkets),
        fetchOnchainSharesByCondition(mergeableMarkets, user.deposit_wallet_address as `0x${string}`, viemRpcUrls),
      ])

      const preparedMerges = mergeableMarkets
        .filter(market =>
          market.mergeAmount > 0
          && market.conditionId
          && Array.isArray(market.outcomeAssets)
          && market.outcomeAssets.length === 2,
        )
        .map((market) => {
          const conditionId = market.conditionId as string
          const onchainShares = onchainSharesByCondition[conditionId]
          if (!onchainShares) {
            return null
          }

          const [firstOutcome, secondOutcome] = market.outcomeAssets
          const locked = availabilityByCondition[conditionId]?.lockedShares ?? {}
          const availableFirst = Math.max(
            0,
            (onchainShares[firstOutcome] ?? 0) - (locked[firstOutcome] ?? 0),
          )
          const availableSecond = Math.max(
            0,
            (onchainShares[secondOutcome] ?? 0) - (locked[secondOutcome] ?? 0),
          )
          const safeMergeAmount = Math.min(market.mergeAmount, availableFirst, availableSecond)
          const normalizedMergeAmount = Math.floor(safeMergeAmount * 100 + 1e-8) / 100

          if (!Number.isFinite(normalizedMergeAmount) || normalizedMergeAmount <= 0) {
            return null
          }

          return {
            conditionId,
            mergeAmount: normalizedMergeAmount,
            isNegRisk: market.isNegRisk,
          }
        })
        .filter((entry): entry is PreparedMerge => Boolean(entry))

      if (preparedMerges.length === 0) {
        toast.info('No eligible pairs to merge.')
        setMergeBatchCount(0)
        return
      }

      setMergeBatchCount(0)

      const { signAndSubmitDepositWalletCallItemsWithSplitFallback } = await import('@/lib/wallet/client')
      const response = await runWithSignaturePrompt(() => signAndSubmitDepositWalletCallItemsWithSplitFallback({
        user,
        items: preparedMerges,
        getCall: entry =>
          buildMergePositionCall({
            conditionId: entry.conditionId as `0x${string}`,
            partition: [...DEFAULT_CONDITION_PARTITION],
            amount: toMicro(entry.mergeAmount),
            parentCollectionId: ZERO_BYTES32,
            contract: entry.isNegRisk ? UMA_NEG_RISK_ADAPTER_ADDRESS : undefined,
          }),
        metadata: 'merge_position',
        signTypedDataAsync,
        maxChunkSize: MAX_MERGE_POSITION_CALLS_PER_BATCH,
        onProgress: progress => setMergeBatchCount(progress.successfulItems.length + progress.failedItems.length),
      }))

      if (response?.error) {
        if (isTradingAuthRequiredError(response.error)) {
          openTradeRequirements({
            forceTradingAuth: true,
            onTradingReady: retryMergeAfterTradingSetup,
          })
        }
        else {
          toast.error(response.error)
        }
        return
      }

      if (user?.settings?.notifications?.inapp_order_fills && response?.txHash) {
        addLocalOrderFillNotification({
          action: 'merge',
          txHash: response.txHash,
          title: 'Merge shares',
          description: response.successfulItems.length > 1
            ? 'Request submitted for multiple markets.'
            : 'Request submitted.',
        })
      }

      applySuccessfulMerges(response.successfulItems)

      if (response.partialFailure) {
        const failureError = response.failure?.error
        if (failureError && isTradingAuthRequiredError(failureError)) {
          toast.info('Enable trading to continue merging the remaining positions.')
          openTradeRequirements({
            forceTradingAuth: true,
            onTradingReady: retryMergeAfterTradingSetup,
          })
        }
        else {
          toast.error('Some positions could not be merged. Please try again.')
        }
      }
      else {
        onSuccess?.()
      }

      setTimeout(() => {
        invalidateMergeQueries()
      }, 4_000)

      setTimeout(() => {
        invalidateMergeQueries()
      }, 12_000)
    }
    catch (error) {
      if (isSplitFallbackError(error)) {
        applySuccessfulMerges(error.successfulItems)
        invalidateMergeQueries()
      }
      console.error('Failed to submit merge operation.', error)
      toast.error('We could not submit your merge request. Please try again.')
    }
    finally {
      setIsMergeProcessing(false)
      setMergeBatchCount(0)
    }
  }, [
    ensureTradingReady,
    hasMergeableMarkets,
    mergeableMarkets,
    onSuccess,
    openTradeRequirements,
    runWithSignaturePrompt,
    signTypedDataAsync,
    addLocalOrderFillNotification,
    applySuccessfulMerges,
    invalidateMergeQueries,
    retryMergeAfterTradingSetup,
    user,
    viemRpcUrls,
  ])

  handleMergeAllRef.current = handleMergeAll

  return {
    isMergeProcessing,
    mergeBatchCount,
    handleMergeAll,
  }
}
