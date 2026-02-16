import type { QueryClient } from '@tanstack/react-query'
import type { MergeableMarket } from '@/app/[locale]/(platform)/[username]/_components/MergePositionsDialog'
import type { ConditionShares } from '@/app/[locale]/(platform)/[username]/_types/PublicPositionsTypes'
import type { SafeTransactionRequestPayload } from '@/lib/safe/transactions'
import type { User } from '@/types'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { hashTypedData } from 'viem'
import { fetchLockedSharesByCondition } from '@/app/[locale]/(platform)/[username]/_utils/PublicPositionsUtils'
import { getSafeNonceAction, submitSafeTransactionAction } from '@/app/[locale]/(platform)/_actions/approve-tokens'
import { SAFE_BALANCE_QUERY_KEY } from '@/hooks/useBalance'
import { defaultNetwork } from '@/lib/appkit'
import { DEFAULT_CONDITION_PARTITION, DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { ZERO_COLLECTION_ID } from '@/lib/contracts'
import { toMicro } from '@/lib/formatters'
import { aggregateSafeTransactions, buildMergePositionTransaction, getSafeTxTypedData, packSafeSignature } from '@/lib/safe/transactions'
import { isTradingAuthRequiredError } from '@/lib/trading-auth/errors'
import { useNotifications } from '@/stores/useNotifications'

interface UseMergePositionsActionOptions {
  mergeableMarkets: MergeableMarket[]
  positionsByCondition: Record<string, ConditionShares>
  hasMergeableMarkets: boolean
  user: User | null
  ensureTradingReady: () => boolean
  openTradeRequirements: (options?: { forceTradingAuth?: boolean }) => void
  queryClient: QueryClient
  signMessageAsync: (args: { message: { raw: `0x${string}` } }) => Promise<`0x${string}`>
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
  signMessageAsync,
  onSuccess,
}: UseMergePositionsActionOptions) {
  const [isMergeProcessing, setIsMergeProcessing] = useState(false)
  const [mergeBatchCount, setMergeBatchCount] = useState(0)
  const addLocalOrderFillNotification = useNotifications(state => state.addLocalOrderFillNotification)

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

    if (!user?.proxy_wallet_address || !user?.address) {
      toast.error('Deploy your proxy wallet before merging shares.')
      setMergeBatchCount(0)
      return
    }

    try {
      setIsMergeProcessing(true)

      const [lockedSharesByCondition, nonceResult] = await Promise.all([
        fetchLockedSharesByCondition(mergeableMarkets),
        getSafeNonceAction(),
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
          const positionShares = positionsByCondition[conditionId]
          if (!positionShares) {
            return null
          }

          const [firstOutcome, secondOutcome] = market.outcomeAssets
          const locked = lockedSharesByCondition[conditionId] ?? {}
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
          }
        })
        .filter((entry): entry is { conditionId: string, mergeAmount: number } => Boolean(entry))

      if (preparedMerges.length === 0) {
        toast.info('No eligible pairs to merge.')
        setMergeBatchCount(0)
        return
      }

      const transactions = preparedMerges.map(entry =>
        buildMergePositionTransaction({
          conditionId: entry.conditionId as `0x${string}`,
          partition: [...DEFAULT_CONDITION_PARTITION],
          amount: toMicro(entry.mergeAmount),
          parentCollectionId: ZERO_COLLECTION_ID,
        }),
      )

      setMergeBatchCount(preparedMerges.length)

      if (nonceResult.error || !nonceResult.nonce) {
        if (isTradingAuthRequiredError(nonceResult.error)) {
          openTradeRequirements({ forceTradingAuth: true })
        }
        else {
          toast.error(nonceResult.error ?? DEFAULT_ERROR_MESSAGE)
        }
        return
      }

      const aggregated = aggregateSafeTransactions(transactions)
      const typedData = getSafeTxTypedData({
        chainId: defaultNetwork.id,
        safeAddress: user.proxy_wallet_address as `0x${string}`,
        transaction: aggregated,
        nonce: nonceResult.nonce,
      })

      const { signatureParams, ...safeTypedData } = typedData
      const structHash = hashTypedData({
        domain: safeTypedData.domain,
        types: safeTypedData.types,
        primaryType: safeTypedData.primaryType,
        message: safeTypedData.message,
      }) as `0x${string}`

      const signature = await signMessageAsync({
        message: { raw: structHash },
      })

      const payload: SafeTransactionRequestPayload = {
        type: 'SAFE',
        from: user.address,
        to: aggregated.to,
        proxyWallet: user.proxy_wallet_address,
        data: aggregated.data,
        nonce: nonceResult.nonce,
        signature: packSafeSignature(signature as `0x${string}`),
        signatureParams,
        metadata: 'merge_position',
      }

      const response = await submitSafeTransactionAction(payload)

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

      void queryClient.invalidateQueries({ queryKey: ['user-positions'] })
      void queryClient.invalidateQueries({ queryKey: [SAFE_BALANCE_QUERY_KEY] })
      void queryClient.invalidateQueries({ queryKey: ['user-conditional-shares'] })
      void queryClient.refetchQueries({ queryKey: ['user-conditional-shares'], type: 'active' })

      setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: ['user-positions'] })
        void queryClient.invalidateQueries({ queryKey: [SAFE_BALANCE_QUERY_KEY] })
        void queryClient.invalidateQueries({ queryKey: ['user-conditional-shares'] })
      }, 3000)
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
    signMessageAsync,
    addLocalOrderFillNotification,
    user?.address,
    user?.proxy_wallet_address,
    user?.settings?.notifications?.inapp_order_fills,
  ])

  return {
    isMergeProcessing,
    mergeBatchCount,
    handleMergeAll,
  }
}
