import type { InfiniteData, QueryClient } from '@tanstack/react-query'
import type { SharesByCondition } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useUserShareBalances'
import type { MergeableMarket } from '@/app/[locale]/(platform)/profile/_components/MergePositionsDialog'
import type { PublicPosition } from '@/app/[locale]/(platform)/profile/_components/PublicPositionItem'
import type { ConditionShares } from '@/app/[locale]/(platform)/profile/_types/PublicPositionsTypes'
import type { User } from '@/types'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { useSignTypedData } from 'wagmi'
import { fetchLockedSharesByCondition } from '@/app/[locale]/(platform)/profile/_utils/PublicPositionsUtils'
import { DEPOSIT_WALLET_BALANCE_QUERY_KEY } from '@/hooks/useBalance'
import { useSignaturePromptRunner } from '@/hooks/useSignaturePromptRunner'
import { DEFAULT_CONDITION_PARTITION } from '@/lib/constants'
import { UMA_NEG_RISK_ADAPTER_ADDRESS, ZERO_COLLECTION_ID } from '@/lib/contracts'
import { toMicro } from '@/lib/formatters'
import { applyConditionReductionsToPublicPositions, applyShareDeltas, updateQueryDataWhere } from '@/lib/optimistic-trading'
import { isTradingAuthRequiredError } from '@/lib/trading-auth/errors'
import { normalizeAddress } from '@/lib/wallet'
import { signAndSubmitDepositWalletCalls } from '@/lib/wallet/client'
import { buildMergePositionCall } from '@/lib/wallet/transactions'
import { useNotifications } from '@/stores/useNotifications'

interface UseMergePositionsActionOptions {
  mergeableMarkets: MergeableMarket[]
  positionsByCondition: Record<string, ConditionShares>
  hasMergeableMarkets: boolean
  user: User | null
  ensureTradingReady: () => boolean
  openTradeRequirements: (options?: { forceTradingAuth?: boolean }) => void
  queryClient: QueryClient
  onSuccess?: () => void
}

export function useMergePositionsAction({
  mergeableMarkets,
  positionsByCondition,
  hasMergeableMarkets,
  user,
  ensureTradingReady,
  openTradeRequirements,
  queryClient,
  onSuccess,
}: UseMergePositionsActionOptions) {
  const [isMergeProcessing, setIsMergeProcessing] = useState(false)
  const [mergeBatchCount, setMergeBatchCount] = useState(0)
  const addLocalOrderFillNotification = useNotifications(state => state.addLocalOrderFillNotification)
  const { runWithSignaturePrompt } = useSignaturePromptRunner()
  const { signTypedDataAsync } = useSignTypedData()

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

      const availabilityByCondition = await fetchLockedSharesByCondition(mergeableMarkets)

      const preparedMerges = mergeableMarkets
        .filter(market =>
          market.mergeAmount > 0
          && market.conditionId
          && Array.isArray(market.outcomeAssets)
          && market.outcomeAssets.length === 2,
        )
        .map((market) => {
          const conditionId = market.conditionId as string
          const positionShares = positionsByCondition[conditionId]
          if (!positionShares) {
            return null
          }

          const [firstOutcome, secondOutcome] = market.outcomeAssets
          const locked = availabilityByCondition[conditionId]?.lockedShares ?? {}
          const availableFirst = Math.max(
            0,
            (positionShares[firstOutcome] ?? 0) - (locked[firstOutcome] ?? 0),
          )
          const availableSecond = Math.max(
            0,
            (positionShares[secondOutcome] ?? 0) - (locked[secondOutcome] ?? 0),
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
        .filter((entry): entry is { conditionId: string, mergeAmount: number, isNegRisk: boolean } => Boolean(entry))

      if (preparedMerges.length === 0) {
        toast.info('No eligible pairs to merge.')
        setMergeBatchCount(0)
        return
      }

      const calls = preparedMerges.map(entry =>
        buildMergePositionCall({
          conditionId: entry.conditionId as `0x${string}`,
          partition: [...DEFAULT_CONDITION_PARTITION],
          amount: toMicro(entry.mergeAmount),
          parentCollectionId: ZERO_COLLECTION_ID,
          contract: entry.isNegRisk ? UMA_NEG_RISK_ADAPTER_ADDRESS : undefined,
        }),
      )

      setMergeBatchCount(preparedMerges.length)

      const response = await runWithSignaturePrompt(() => signAndSubmitDepositWalletCalls({
        user,
        calls,
        metadata: 'merge_position',
        signTypedDataAsync,
      }))

      if (response?.error) {
        if (isTradingAuthRequiredError(response.error)) {
          openTradeRequirements({ forceTradingAuth: true })
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
          description: preparedMerges.length > 1
            ? 'Request submitted for multiple markets.'
            : 'Request submitted.',
        })
      }

      onSuccess?.()

      const normalizedProxyWallet = normalizeAddress(user.deposit_wallet_address)
      const publicPositionReductions = preparedMerges.map(entry => ({
        conditionId: entry.conditionId,
        sharesDelta: -entry.mergeAmount,
      }))
      const shareDeltas = preparedMerges.flatMap(entry => ([
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
        (currentQueryKey) => {
          if (currentQueryKey[2] !== 'active') {
            return false
          }

          return !normalizedProxyWallet || !currentQueryKey[1]
            ? false
            : String(currentQueryKey[1]).toLowerCase() === normalizedProxyWallet.toLowerCase()
        },
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

      setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: ['user-positions'] })
        void queryClient.invalidateQueries({ queryKey: [DEPOSIT_WALLET_BALANCE_QUERY_KEY] })
        void queryClient.invalidateQueries({ queryKey: ['user-conditional-shares'] })
      }, 4_000)

      setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: ['user-positions'] })
        void queryClient.invalidateQueries({ queryKey: [DEPOSIT_WALLET_BALANCE_QUERY_KEY] })
        void queryClient.invalidateQueries({ queryKey: ['user-conditional-shares'] })
      }, 12_000)
    }
    catch (error) {
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
    positionsByCondition,
    queryClient,
    runWithSignaturePrompt,
    signTypedDataAsync,
    addLocalOrderFillNotification,
    user,
  ])

  return {
    isMergeProcessing,
    mergeBatchCount,
    handleMergeAll,
  }
}
