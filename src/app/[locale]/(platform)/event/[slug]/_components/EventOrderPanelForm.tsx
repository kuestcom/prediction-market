import type { SafeTransactionRequestPayload } from '@/lib/safe/transactions'
import type { Event } from '@/types'
import { useAppKitAccount } from '@reown/appkit/react'
import { useQueryClient } from '@tanstack/react-query'
import { CheckIcon, TriangleAlertIcon } from 'lucide-react'
import { useExtracted, useLocale } from 'next-intl'
import Form from 'next/form'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { hashTypedData } from 'viem'
import { useSignMessage, useSignTypedData } from 'wagmi'
import { getSafeNonceAction, submitSafeTransactionAction } from '@/app/[locale]/(platform)/_actions/approve-tokens'
import { useTradingOnboarding } from '@/app/[locale]/(platform)/_providers/TradingOnboardingProvider'
import { useOrderBookSummaries } from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderBook'
import EventOrderPanelBuySellTabs from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelBuySellTabs'
import EventOrderPanelEarnings from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelEarnings'
import EventOrderPanelInput from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelInput'
import EventOrderPanelLimitControls from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelLimitControls'
import EventOrderPanelMarketInfo from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelMarketInfo'
import EventOrderPanelMobileMarketInfo from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelMobileMarketInfo'
import EventOrderPanelOutcomeButton from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelOutcomeButton'
import EventOrderPanelSubmitButton from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelSubmitButton'
import EventOrderPanelUserShares from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelUserShares'
import { handleOrderCancelledFeedback, handleOrderErrorFeedback, handleOrderSuccessFeedback, handleValidationError } from '@/app/[locale]/(platform)/event/[slug]/_components/feedback'
import { useEventOrderPanelOpenOrders } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventOrderPanelOpenOrders'
import { useEventOrderPanelPositions } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventOrderPanelPositions'
import { buildUserOpenOrdersQueryKey } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useUserOpenOrdersQuery'
import { useUserShareBalances } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useUserShareBalances'
import {
  calculateMarketFill,
  normalizeBookLevels,
} from '@/app/[locale]/(platform)/event/[slug]/_utils/EventOrderPanelUtils'
import { Button } from '@/components/ui/button'
import { useAffiliateOrderMetadata } from '@/hooks/useAffiliateOrderMetadata'
import { useAppKit } from '@/hooks/useAppKit'
import { SAFE_BALANCE_QUERY_KEY, useBalance } from '@/hooks/useBalance'
import { useOutcomeLabel } from '@/hooks/useOutcomeLabel'
import { useSignaturePromptRunner } from '@/hooks/useSignaturePromptRunner'
import { defaultNetwork } from '@/lib/appkit'
import { CLOB_ORDER_TYPE, DEFAULT_ERROR_MESSAGE, getExchangeEip712Domain, ORDER_SIDE, ORDER_TYPE, OUTCOME_INDEX } from '@/lib/constants'
import { formatCentsLabel, formatCurrency, formatSharesLabel, toCents } from '@/lib/formatters'
import { buildOrderPayload, submitOrder } from '@/lib/orders'
import { signOrderPayload } from '@/lib/orders/signing'
import { MIN_LIMIT_ORDER_SHARES, validateOrder } from '@/lib/orders/validation'
import {
  aggregateSafeTransactions,
  buildRedeemPositionTransaction,
  getSafeTxTypedData,
  packSafeSignature,
} from '@/lib/safe/transactions'
import { isTradingAuthRequiredError } from '@/lib/trading-auth/errors'
import { cn } from '@/lib/utils'
import { isUserRejectedRequestError, normalizeAddress } from '@/lib/wallet'
import { useAmountAsNumber, useIsLimitOrder, useIsSingleMarket, useNoPrice, useOrder, useYesPrice } from '@/stores/useOrder'
import { useUser } from '@/stores/useUser'

interface EventOrderPanelFormProps {
  isMobile: boolean
  event: Event
}

function resolveWinningOutcomeIndex(market: Event['markets'][number] | null | undefined) {
  if (!market) {
    return null
  }

  const explicitWinner = market.outcomes?.find(outcome => outcome.is_winning_outcome)
  if (explicitWinner && (explicitWinner.outcome_index === OUTCOME_INDEX.YES || explicitWinner.outcome_index === OUTCOME_INDEX.NO)) {
    return explicitWinner.outcome_index
  }

  const payoutNumerators = market.condition?.payout_numerators
  if (!Array.isArray(payoutNumerators) || payoutNumerators.length === 0) {
    return null
  }

  const numericNumerators = payoutNumerators.map(value => Number(value))
  const finiteNumerators = numericNumerators.filter(value => Number.isFinite(value))
  if (finiteNumerators.length === 0) {
    return null
  }

  const maxValue = Math.max(...finiteNumerators)
  if (!(maxValue > 0)) {
    return null
  }

  const winnerIndex = numericNumerators.findIndex(value => value === maxValue)
  if (winnerIndex === OUTCOME_INDEX.YES || winnerIndex === OUTCOME_INDEX.NO) {
    return winnerIndex
  }

  return null
}

function resolveIndexSetFromOutcomeIndex(outcomeIndex: number | undefined) {
  if (outcomeIndex === OUTCOME_INDEX.YES) {
    return 1
  }
  if (outcomeIndex === OUTCOME_INDEX.NO) {
    return 2
  }
  return null
}

export default function EventOrderPanelForm({ event, isMobile }: EventOrderPanelFormProps) {
  const { open } = useAppKit()
  const { isConnected } = useAppKitAccount()
  const { signTypedDataAsync } = useSignTypedData()
  const { signMessageAsync } = useSignMessage()
  const { runWithSignaturePrompt } = useSignaturePromptRunner()
  const t = useExtracted()
  const locale = useLocale()
  const normalizeOutcomeLabel = useOutcomeLabel()
  const user = useUser()
  const state = useOrder()
  const setUserShares = useOrder(store => store.setUserShares)
  const queryClient = useQueryClient()
  const yesPrice = useYesPrice()
  const noPrice = useNoPrice()
  const isSingleMarket = useIsSingleMarket()
  const amountNumber = useAmountAsNumber()
  const isLimitOrder = useIsLimitOrder()
  const shouldShowEarnings = amountNumber > 0
  const [showMarketMinimumWarning, setShowMarketMinimumWarning] = useState(false)
  const [showInsufficientSharesWarning, setShowInsufficientSharesWarning] = useState(false)
  const [showInsufficientBalanceWarning, setShowInsufficientBalanceWarning] = useState(false)
  const [showAmountTooLowWarning, setShowAmountTooLowWarning] = useState(false)
  const [showNoLiquidityWarning, setShowNoLiquidityWarning] = useState(false)
  const [shouldShakeInput, setShouldShakeInput] = useState(false)
  const [shouldShakeLimitShares, setShouldShakeLimitShares] = useState(false)
  const [isClaimSubmitting, setIsClaimSubmitting] = useState(false)
  const [claimedConditionId, setClaimedConditionId] = useState<string | null>(null)
  const limitSharesInputRef = useRef<HTMLInputElement | null>(null)
  const limitSharesNumber = Number.parseFloat(state.limitShares) || 0
  const { balance, isLoadingBalance } = useBalance()
  const outcomeTokenId = state.outcome?.token_id ? String(state.outcome.token_id) : null
  const shouldLoadOrderBookSummary = Boolean(
    outcomeTokenId
    && (state.type === ORDER_TYPE.MARKET
      || (state.type === ORDER_TYPE.LIMIT && Number.parseFloat(state.limitPrice || '0') > 0)),
  )
  const orderBookSummaryQuery = useOrderBookSummaries(
    outcomeTokenId ? [outcomeTokenId] : [],
    { enabled: shouldLoadOrderBookSummary },
  )
  const validCustomExpirationTimestamp = useMemo(() => {
    const nowSeconds = Math.floor(Date.now() / 1000)

    if (state.limitExpirationOption !== 'custom') {
      return null
    }

    if (
      !state.limitExpirationTimestamp
      || !Number.isFinite(state.limitExpirationTimestamp)
      || state.limitExpirationTimestamp <= 0
    ) {
      return null
    }

    return state.limitExpirationTimestamp > nowSeconds
      ? state.limitExpirationTimestamp
      : null
  }, [state.limitExpirationOption, state.limitExpirationTimestamp])
  const affiliateMetadata = useAffiliateOrderMetadata()
  const { ensureTradingReady, openTradeRequirements, startDepositFlow } = useTradingOnboarding()
  const hasDeployedProxyWallet = Boolean(user?.proxy_wallet_address && user?.proxy_wallet_status === 'deployed')
  const proxyWalletAddress = hasDeployedProxyWallet ? normalizeAddress(user?.proxy_wallet_address) : null
  const userAddress = normalizeAddress(user?.address)
  const makerAddress = proxyWalletAddress ?? userAddress ?? null
  const signatureType = proxyWalletAddress ? 2 : 0
  const { sharesByCondition } = useUserShareBalances({ event, ownerAddress: makerAddress })
  const { openOrdersQueryKey, openSellSharesByCondition } = useEventOrderPanelOpenOrders({
    userId: user?.id,
    eventSlug: event.slug,
    conditionId: state.market?.condition_id,
  })
  const eventOpenOrdersQueryKey = useMemo(
    () => buildUserOpenOrdersQueryKey(user?.id, event.slug),
    [event.slug, user?.id],
  )
  const isNegRiskEnabled = Boolean(event.enable_neg_risk)
  const isNegRiskMarket = typeof state.market?.neg_risk === 'boolean'
    ? state.market.neg_risk
    : Boolean(event.enable_neg_risk || event.neg_risk)
  const isResolvedMarket = Boolean(state.market?.is_resolved || state.market?.condition?.resolved)
  const resolvedOutcomeIndex = useMemo(
    () => resolveWinningOutcomeIndex(state.market),
    [state.market],
  )
  const resolvedOutcomeText = state.market?.outcomes.find(
    outcome => outcome.outcome_index === resolvedOutcomeIndex,
  )?.outcome_text
  const resolvedYesOutcomeText = state.market?.outcomes.find(
    outcome => outcome.outcome_index === OUTCOME_INDEX.YES,
  )?.outcome_text
  const resolvedNoOutcomeText = state.market?.outcomes.find(
    outcome => outcome.outcome_index === OUTCOME_INDEX.NO,
  )?.outcome_text
  const resolvedYesOutcomeLabel = (resolvedYesOutcomeText ? normalizeOutcomeLabel(resolvedYesOutcomeText) : '')
    || resolvedYesOutcomeText
    || t('Yes')
  const resolvedNoOutcomeLabel = (resolvedNoOutcomeText ? normalizeOutcomeLabel(resolvedNoOutcomeText) : '')
    || resolvedNoOutcomeText
    || t('No')
  const normalizedResolvedOutcomeLabel = resolvedOutcomeText
    ? normalizeOutcomeLabel(resolvedOutcomeText)
    : ''
  const resolvedOutcomeLabel = resolvedOutcomeIndex === OUTCOME_INDEX.NO
    ? (normalizedResolvedOutcomeLabel || resolvedOutcomeText || t('No'))
    : resolvedOutcomeIndex === OUTCOME_INDEX.YES
      ? (normalizedResolvedOutcomeLabel || resolvedOutcomeText || t('Yes'))
      : t('Resolved')
  const resolvedMarketTitle = state.market?.short_title || state.market?.title
  const orderDomain = useMemo(() => getExchangeEip712Domain(isNegRiskEnabled), [isNegRiskEnabled])
  const endOfDayTimestamp = useMemo(() => {
    const now = new Date()
    now.setHours(23, 59, 59, 0)
    return Math.floor(now.getTime() / 1000)
  }, [])
  const [showLimitMinimumWarning, setShowLimitMinimumWarning] = useState(false)
  const { positionsQuery, aggregatedPositionShares } = useEventOrderPanelPositions({
    makerAddress,
    conditionId: state.market?.condition_id,
  })

  const normalizedOrderBook = useMemo(() => {
    const summary = outcomeTokenId ? orderBookSummaryQuery.data?.[outcomeTokenId] : undefined
    return {
      bids: normalizeBookLevels(summary?.bids, 'bid'),
      asks: normalizeBookLevels(summary?.asks, 'ask'),
    }
  }, [orderBookSummaryQuery.data, outcomeTokenId])
  const limitMatchingShares = useMemo(() => {
    if (!isLimitOrder) {
      return null
    }

    const limitPriceValue = Number.parseFloat(state.limitPrice || '0') || 0
    const limitSharesValue = Number.parseFloat(state.limitShares || '0') || 0
    if (limitPriceValue <= 0 || limitSharesValue <= 0) {
      return null
    }

    const levels = state.side === ORDER_SIDE.BUY ? normalizedOrderBook.asks : normalizedOrderBook.bids
    if (!levels.length) {
      return null
    }

    const availableShares = levels.reduce((total, level) => {
      if (state.side === ORDER_SIDE.BUY ? level.priceCents <= limitPriceValue : level.priceCents >= limitPriceValue) {
        return total + level.size
      }
      return total
    }, 0)
    const matchingShares = Math.min(limitSharesValue, availableShares)
    return matchingShares > 0 ? Number(matchingShares.toFixed(4)) : null
  }, [
    isLimitOrder,
    normalizedOrderBook.asks,
    normalizedOrderBook.bids,
    state.limitPrice,
    state.limitShares,
    state.side,
  ])

  const availableBalanceForOrders = Math.max(0, balance.raw)
  const formattedBalanceText = Number.isFinite(balance.raw)
    ? balance.raw.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0.00'

  const mergedSharesByCondition = useMemo(() => {
    const merged: Record<string, Record<typeof OUTCOME_INDEX.YES | typeof OUTCOME_INDEX.NO, number>> = {}
    const keys = new Set([
      ...Object.keys(sharesByCondition),
      ...Object.keys(aggregatedPositionShares ?? {}),
    ])

    keys.forEach((conditionId) => {
      merged[conditionId] = {
        [OUTCOME_INDEX.YES]: Math.max(
          sharesByCondition[conditionId]?.[OUTCOME_INDEX.YES] ?? 0,
          aggregatedPositionShares?.[conditionId]?.[OUTCOME_INDEX.YES] ?? 0,
        ),
        [OUTCOME_INDEX.NO]: Math.max(
          sharesByCondition[conditionId]?.[OUTCOME_INDEX.NO] ?? 0,
          aggregatedPositionShares?.[conditionId]?.[OUTCOME_INDEX.NO] ?? 0,
        ),
      }
    })

    return merged
  }, [aggregatedPositionShares, sharesByCondition])

  useEffect(() => {
    if (!makerAddress) {
      setUserShares({}, { replace: true })
      setShowMarketMinimumWarning(false)
      return
    }

    if (!Object.keys(mergedSharesByCondition).length) {
      setUserShares({}, { replace: true })
      return
    }

    setUserShares(mergedSharesByCondition, { replace: true })
  }, [makerAddress, mergedSharesByCondition, setUserShares])

  const conditionTokenShares = state.market ? state.userShares[state.market.condition_id] : undefined
  const conditionPositionShares = state.market ? aggregatedPositionShares?.[state.market.condition_id] : undefined
  const yesTokenShares = conditionTokenShares?.[OUTCOME_INDEX.YES] ?? 0
  const noTokenShares = conditionTokenShares?.[OUTCOME_INDEX.NO] ?? 0
  const yesPositionShares = conditionPositionShares?.[OUTCOME_INDEX.YES] ?? 0
  const noPositionShares = conditionPositionShares?.[OUTCOME_INDEX.NO] ?? 0
  const lockedYesShares = state.market ? openSellSharesByCondition[state.market.condition_id]?.[OUTCOME_INDEX.YES] ?? 0 : 0
  const lockedNoShares = state.market ? openSellSharesByCondition[state.market.condition_id]?.[OUTCOME_INDEX.NO] ?? 0 : 0
  const availableYesTokenShares = Math.max(0, yesTokenShares - lockedYesShares)
  const availableNoTokenShares = Math.max(0, noTokenShares - lockedNoShares)
  const availableYesPositionShares = Math.max(0, yesPositionShares - lockedYesShares)
  const availableNoPositionShares = Math.max(0, noPositionShares - lockedNoShares)
  const mergeableYesShares = Math.max(availableYesTokenShares, availableYesPositionShares)
  const mergeableNoShares = Math.max(availableNoTokenShares, availableNoPositionShares)
  const availableMergeShares = Math.max(0, Math.min(mergeableYesShares, mergeableNoShares))
  const availableSplitBalance = Math.max(0, balance.raw)
  const outcomeIndex = state.outcome?.outcome_index as typeof OUTCOME_INDEX.YES | typeof OUTCOME_INDEX.NO | undefined
  const selectedTokenShares = outcomeIndex === undefined
    ? 0
    : outcomeIndex === OUTCOME_INDEX.YES
      ? availableYesTokenShares
      : availableNoTokenShares
  const selectedPositionShares = outcomeIndex === undefined
    ? 0
    : outcomeIndex === OUTCOME_INDEX.YES
      ? availableYesPositionShares
      : availableNoPositionShares
  const selectedShares = state.side === ORDER_SIDE.SELL
    ? (isLimitOrder ? selectedTokenShares : selectedPositionShares)
    : selectedTokenShares
  const selectedShareLabel = normalizeOutcomeLabel(state.outcome?.outcome_text)
    ?? (outcomeIndex === OUTCOME_INDEX.NO
      ? t('No')
      : outcomeIndex === OUTCOME_INDEX.YES
        ? t('Yes')
        : undefined)
  const claimablePositionsForMarket = useMemo(() => {
    if (!isResolvedMarket || !state.market?.condition_id) {
      return []
    }

    const positions = positionsQuery.data ?? []
    return positions.filter((position) => {
      if (!position.redeemable || position.market?.condition_id !== state.market?.condition_id) {
        return false
      }
      const shares = typeof position.total_shares === 'number' ? position.total_shares : 0
      return shares > 0
    })
  }, [isResolvedMarket, positionsQuery.data, state.market?.condition_id])
  const claimableShares = useMemo(
    () =>
      claimablePositionsForMarket.reduce((sum, position) => {
        const shares = typeof position.total_shares === 'number' ? position.total_shares : 0
        return shares > 0 ? sum + shares : sum
      }, 0),
    [claimablePositionsForMarket],
  )
  const claimIndexSets = useMemo(() => {
    const indexSetCollection = new Set<number>()
    claimablePositionsForMarket.forEach((position) => {
      const indexSet = resolveIndexSetFromOutcomeIndex(position.outcome_index)
      if (indexSet) {
        indexSetCollection.add(indexSet)
      }
    })

    if (indexSetCollection.size === 0) {
      const fallbackIndexSet = resolveIndexSetFromOutcomeIndex(resolvedOutcomeIndex ?? undefined)
      if (fallbackIndexSet) {
        indexSetCollection.add(fallbackIndexSet)
      }
    }

    return Array.from(indexSetCollection).sort((a, b) => a - b)
  }, [claimablePositionsForMarket, resolvedOutcomeIndex])
  const hasSubmittedClaimForMarket = Boolean(
    state.market?.condition_id
    && claimedConditionId === state.market.condition_id,
  )
  const hasClaimableWinnings = Boolean(state.market?.condition_id)
    && claimableShares > 0
    && claimIndexSets.length > 0
    && !hasSubmittedClaimForMarket
  const claimOutcomeLabel = useMemo(() => {
    const positionOutcomeText = claimablePositionsForMarket.find(position => position.outcome_text)?.outcome_text
    const normalizedOutcome = positionOutcomeText ? normalizeOutcomeLabel(positionOutcomeText) : ''
    return normalizedOutcome || positionOutcomeText || resolvedOutcomeLabel
  }, [claimablePositionsForMarket, normalizeOutcomeLabel, resolvedOutcomeLabel])
  const yesPositionLabel = useMemo(
    () =>
      formatSharesLabel(yesPositionShares, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [yesPositionShares],
  )
  const noPositionLabel = useMemo(
    () =>
      formatSharesLabel(noPositionShares, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [noPositionShares],
  )
  const hasYesAndNoPosition = yesPositionShares > 0 && noPositionShares > 0
  const claimPositionLabel = useMemo(() => {
    if (hasYesAndNoPosition) {
      return `${yesPositionLabel} ${resolvedYesOutcomeLabel} / ${noPositionLabel} ${resolvedNoOutcomeLabel}`
    }

    if (yesPositionShares > 0) {
      return `${yesPositionLabel} ${resolvedYesOutcomeLabel}`
    }

    if (noPositionShares > 0) {
      return `${noPositionLabel} ${resolvedNoOutcomeLabel}`
    }

    const sharesLabel = formatSharesLabel(claimableShares, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    return `${sharesLabel} ${claimOutcomeLabel}`
  }, [
    claimOutcomeLabel,
    claimableShares,
    hasYesAndNoPosition,
    noPositionLabel,
    noPositionShares,
    resolvedNoOutcomeLabel,
    resolvedYesOutcomeLabel,
    yesPositionLabel,
    yesPositionShares,
  ])
  const claimValuePerShareLabel = useMemo(() => {
    const yesValuePerShare = resolvedOutcomeIndex === OUTCOME_INDEX.YES ? formatCurrency(1) : formatCurrency(0)
    const noValuePerShare = resolvedOutcomeIndex === OUTCOME_INDEX.NO ? formatCurrency(1) : formatCurrency(0)

    if (hasYesAndNoPosition) {
      return `${yesValuePerShare} / ${noValuePerShare}`
    }

    if (yesPositionShares > 0) {
      return yesValuePerShare
    }

    if (noPositionShares > 0) {
      return noValuePerShare
    }

    return formatCurrency(1)
  }, [hasYesAndNoPosition, noPositionShares, resolvedOutcomeIndex, yesPositionShares])
  const claimTotalLabel = useMemo(() => formatCurrency(claimableShares), [claimableShares])

  const marketSellFill = useMemo(() => {
    if (state.side !== ORDER_SIDE.SELL || isLimitOrder) {
      return null
    }

    return calculateMarketFill(
      ORDER_SIDE.SELL,
      amountNumber,
      normalizedOrderBook.bids,
      normalizedOrderBook.asks,
    )
  }, [amountNumber, isLimitOrder, normalizedOrderBook.asks, normalizedOrderBook.bids, state.side])

  const marketBuyFill = useMemo(() => {
    if (state.side !== ORDER_SIDE.BUY || isLimitOrder) {
      return null
    }

    return calculateMarketFill(
      ORDER_SIDE.BUY,
      amountNumber,
      normalizedOrderBook.bids,
      normalizedOrderBook.asks,
    )
  }, [amountNumber, isLimitOrder, normalizedOrderBook.asks, normalizedOrderBook.bids, state.side])

  const sellOrderSnapshot = useMemo(() => {
    if (state.side !== ORDER_SIDE.SELL) {
      return { shares: 0, priceCents: 0, totalValue: 0 }
    }

    const isLimit = state.type === ORDER_TYPE.LIMIT
    const sharesInput = isLimit
      ? Number.parseFloat(state.limitShares || '0') || 0
      : Number.parseFloat(state.amount || '0') || 0

    const limitPrice = isLimit
      ? Number.parseFloat(state.limitPrice || '0') || 0
      : null

    if (isLimit) {
      const totalValue = sharesInput > 0 && limitPrice && limitPrice > 0 ? (sharesInput * limitPrice) / 100 : 0
      return {
        shares: sharesInput,
        priceCents: limitPrice ?? 0,
        totalValue,
      }
    }

    const fill = marketSellFill
    const effectivePriceCents = fill?.avgPriceCents ?? null
    const filledShares = fill?.filledShares ?? sharesInput
    const totalValue = fill?.totalCost ?? 0

    return {
      shares: filledShares,
      priceCents: effectivePriceCents ?? Number.NaN,
      totalValue,
    }
  }, [marketSellFill, state.amount, state.limitPrice, state.limitShares, state.side, state.type])

  const sellAmountValue = state.side === ORDER_SIDE.SELL ? sellOrderSnapshot.totalValue : 0

  const avgSellPriceDollars = Number.isFinite(sellOrderSnapshot.priceCents)
    ? sellOrderSnapshot.priceCents / 100
    : null
  const avgSellPriceLabel = formatCentsLabel(avgSellPriceDollars, { fallback: '—' })
  const outcomeFallbackBuyPriceCents = typeof state.outcome?.buy_price === 'number'
    ? Number((state.outcome.buy_price * 100).toFixed(1))
    : null
  const currentBuyPriceCents = (() => {
    if (isLimitOrder && state.side === ORDER_SIDE.BUY) {
      return Number.parseFloat(state.limitPrice || '0') || 0
    }

    if (!isLimitOrder && state.side === ORDER_SIDE.BUY) {
      return marketBuyFill?.avgPriceCents ?? null
    }

    return outcomeFallbackBuyPriceCents
  })()

  const effectiveMarketBuyCost = state.side === ORDER_SIDE.BUY && state.type === ORDER_TYPE.MARKET
    ? (marketBuyFill?.totalCost ?? amountNumber)
    : 0
  const shouldShowDepositCta = isConnected
    && state.side === ORDER_SIDE.BUY
    && state.type === ORDER_TYPE.MARKET
    && Math.max(effectiveMarketBuyCost, amountNumber) > balance.raw

  const buyPayoutSummary = useMemo(() => {
    if (state.side !== ORDER_SIDE.BUY) {
      return {
        payout: 0,
        cost: 0,
        profit: 0,
        changePct: 0,
        multiplier: 0,
      }
    }

    if (isLimitOrder) {
      const price = Number.parseFloat(state.limitPrice || '0') / 100
      const shares = Number.parseFloat(state.limitShares || '0') || 0
      const cost = price > 0 ? shares * price : 0
      const payout = shares
      const profit = payout - cost
      const changePct = cost > 0 ? (profit / cost) * 100 : 0
      const multiplier = cost > 0 ? payout / cost : 0
      return { payout, cost, profit, changePct, multiplier }
    }

    const avgPrice = marketBuyFill?.avgPriceCents != null ? marketBuyFill.avgPriceCents / 100 : (currentBuyPriceCents ?? 0) / 100
    const cost = marketBuyFill?.totalCost ?? amountNumber
    const payout = marketBuyFill?.filledShares && marketBuyFill.filledShares > 0
      ? marketBuyFill.filledShares
      : (avgPrice > 0 ? amountNumber / avgPrice : 0)
    const profit = payout - cost
    const changePct = cost > 0 ? (profit / cost) * 100 : 0
    const multiplier = cost > 0 ? payout / cost : 0

    return { payout, cost, profit, changePct, multiplier }
  }, [amountNumber, currentBuyPriceCents, isLimitOrder, marketBuyFill, state.limitPrice, state.limitShares, state.side])

  const avgBuyPriceDollars = typeof currentBuyPriceCents === 'number' && Number.isFinite(currentBuyPriceCents)
    ? currentBuyPriceCents / 100
    : null
  const avgBuyPriceLabel = formatCentsLabel(avgBuyPriceDollars, { fallback: '—' })
  const avgBuyPriceCentsValue = typeof currentBuyPriceCents === 'number' && Number.isFinite(currentBuyPriceCents)
    ? currentBuyPriceCents
    : null
  const avgSellPriceCentsValue = Number.isFinite(sellOrderSnapshot.priceCents) && sellOrderSnapshot.priceCents > 0
    ? sellOrderSnapshot.priceCents
    : null
  const sellAmountLabel = formatCurrency(sellAmountValue)
  useEffect(() => {
    if (!isLimitOrder || limitSharesNumber >= MIN_LIMIT_ORDER_SHARES) {
      setShowLimitMinimumWarning(false)
    }
  }, [isLimitOrder, limitSharesNumber])

  useEffect(() => {
    setClaimedConditionId(null)
  }, [state.market?.condition_id])

  useEffect(() => {
    setShowInsufficientSharesWarning(false)
    setShowInsufficientBalanceWarning(false)
    setShowAmountTooLowWarning(false)
    setShowNoLiquidityWarning(false)
    setShouldShakeInput(false)
    setShouldShakeLimitShares(false)
  }, [state.amount, state.side, selectedShares])

  useEffect(() => {
    const filledShares = state.side === ORDER_SIDE.BUY
      ? (marketBuyFill?.filledShares ?? 0)
      : (marketSellFill?.filledShares ?? 0)

    if (isLimitOrder || amountNumber <= 0 || filledShares > 0) {
      setShowNoLiquidityWarning(false)
    }
  }, [
    amountNumber,
    isLimitOrder,
    marketBuyFill?.filledShares,
    marketSellFill?.filledShares,
    state.side,
  ])

  useEffect(() => {
    if (
      isLimitOrder
      || state.side !== ORDER_SIDE.BUY
      || amountNumber >= 1
      || amountNumber <= 0
    ) {
      setShowMarketMinimumWarning(false)
    }
  }, [amountNumber, isLimitOrder, state.side])

  function focusInput() {
    state.inputRef?.current?.focus()
  }

  function triggerLimitSharesShake() {
    setShouldShakeLimitShares(true)
    limitSharesInputRef.current?.focus()
    setTimeout(() => setShouldShakeLimitShares(false), 320)
  }

  function triggerInputShake() {
    setShouldShakeInput(true)
    state.inputRef?.current?.focus()
    setTimeout(() => setShouldShakeInput(false), 320)
  }

  async function onSubmit() {
    if (!ensureTradingReady()) {
      return
    }

    if (
      !isLimitOrder
      && amountNumber > 0
      && (
        (state.side === ORDER_SIDE.SELL && (marketSellFill?.filledShares ?? 0) <= 0)
        || (state.side === ORDER_SIDE.BUY && (marketBuyFill?.filledShares ?? 0) <= 0)
      )
    ) {
      setShowLimitMinimumWarning(false)
      setShowMarketMinimumWarning(false)
      setShowInsufficientSharesWarning(false)
      setShowInsufficientBalanceWarning(false)
      setShowAmountTooLowWarning(false)
      setShowNoLiquidityWarning(true)
      triggerInputShake()
      return
    }

    const validation = validateOrder({
      isLoading: state.isLoading,
      isConnected,
      user,
      market: state.market,
      outcome: state.outcome,
      amountNumber,
      side: state.side,
      isLimitOrder,
      limitPrice: state.limitPrice,
      limitShares: state.limitShares,
      availableBalance: availableBalanceForOrders,
      availableShares: selectedShares,
      limitExpirationEnabled: state.limitExpirationEnabled,
      limitExpirationOption: state.limitExpirationOption,
      limitExpirationTimestamp: validCustomExpirationTimestamp,
    })

    if (!validation.ok) {
      switch (validation.reason) {
        case 'LIMIT_SHARES_TOO_LOW': {
          setShowLimitMinimumWarning(true)
          triggerLimitSharesShake()
          return
        }
        case 'MARKET_MIN_AMOUNT': {
          setShowMarketMinimumWarning(true)
          return
        }
        case 'INVALID_AMOUNT':
        case 'INVALID_LIMIT_SHARES': {
          setShowAmountTooLowWarning(true)
          if (isLimitOrder) {
            triggerLimitSharesShake()
          }
          else {
            triggerInputShake()
          }
          return
        }
        case 'INSUFFICIENT_SHARES': {
          setShowInsufficientSharesWarning(true)
          if (isLimitOrder) {
            triggerLimitSharesShake()
          }
          else {
            triggerInputShake()
          }
          return
        }
        case 'INSUFFICIENT_BALANCE': {
          setShowInsufficientBalanceWarning(true)
          if (isLimitOrder) {
            triggerLimitSharesShake()
          }
          else {
            triggerInputShake()
          }
          return
        }
        default:
          setShowLimitMinimumWarning(false)
          setShowMarketMinimumWarning(false)
          setShowInsufficientSharesWarning(false)
          setShowInsufficientBalanceWarning(false)
          setShowAmountTooLowWarning(false)
          setShouldShakeInput(false)
          setShouldShakeLimitShares(false)
      }
      handleValidationError(validation.reason, {
        openWalletModal: open,
        shareLabel: selectedShareLabel,
      })
      return
    }
    setShowLimitMinimumWarning(false)
    setShowInsufficientSharesWarning(false)
    setShowInsufficientBalanceWarning(false)
    setShowAmountTooLowWarning(false)
    setShowNoLiquidityWarning(false)
    setShouldShakeInput(false)
    setShouldShakeLimitShares(false)

    if (!state.market || !state.outcome || !user || !userAddress || !makerAddress) {
      return
    }

    const customExpirationTimestamp = state.limitExpirationOption === 'custom'
      ? validCustomExpirationTimestamp
      : null

    const effectiveAmountForOrder = (() => {
      if (state.type === ORDER_TYPE.MARKET) {
        if (state.side === ORDER_SIDE.SELL) {
          const requestedShares = Number.parseFloat(state.amount || '0') || 0
          return requestedShares.toString()
        }

        return (state.amount || amountNumber.toString())
      }

      if (state.side === ORDER_SIDE.SELL) {
        return state.limitShares
      }

      return state.amount
    })()

    const marketLimitPriceCents = (() => {
      if (state.side === ORDER_SIDE.SELL) {
        const value = marketSellFill?.limitPriceCents ?? sellOrderSnapshot.priceCents
        return Number.isFinite(value) && value > 0 ? value : undefined
      }

      const value = marketBuyFill?.limitPriceCents
        ?? currentBuyPriceCents
        ?? outcomeFallbackBuyPriceCents

      return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
    })()

    const payload = buildOrderPayload({
      userAddress,
      makerAddress,
      signatureType,
      outcome: state.outcome,
      side: state.side,
      orderType: state.type,
      amount: effectiveAmountForOrder,
      limitPrice: state.limitPrice,
      limitShares: state.limitShares,
      marketPriceCents: marketLimitPriceCents,
      expirationTimestamp: state.limitExpirationEnabled
        ? (customExpirationTimestamp ?? endOfDayTimestamp)
        : undefined,
      feeRateBps: affiliateMetadata.tradeFeeBps,
    })

    let signature: string
    try {
      signature = await runWithSignaturePrompt(() => signOrderPayload({
        payload,
        domain: orderDomain,
        signTypedDataAsync,
      }))
    }
    catch (error) {
      if (isUserRejectedRequestError(error)) {
        handleOrderCancelledFeedback()
        return
      }

      handleOrderErrorFeedback(t('Trade failed'), t('We could not sign your order. Please try again.'))
      return
    }

    state.setIsLoading(true)
    try {
      const result = await submitOrder({
        order: payload,
        signature,
        orderType: state.type,
        clobOrderType: state.type === ORDER_TYPE.LIMIT && state.limitExpirationEnabled
          ? CLOB_ORDER_TYPE.GTD
          : undefined,
        conditionId: state.market.condition_id,
        slug: event.slug,
      })

      if (result?.error) {
        if (isTradingAuthRequiredError(result.error)) {
          openTradeRequirements({ forceTradingAuth: true })
          return
        }
        handleOrderErrorFeedback(t('Trade failed'), result.error)
        return
      }

      const sellSharesLabel = state.side === ORDER_SIDE.SELL
        ? (state.type === ORDER_TYPE.LIMIT ? state.limitShares : state.amount)
        : undefined
      const displayBuyPriceCents = state.side === ORDER_SIDE.BUY
        ? (marketBuyFill?.avgPriceCents ?? currentBuyPriceCents ?? marketLimitPriceCents)
        : undefined

      handleOrderSuccessFeedback({
        side: state.side,
        amountInput: state.amount,
        sellSharesLabel,
        isLimitOrder: state.type === ORDER_TYPE.LIMIT,
        outcomeText: normalizeOutcomeLabel(state.outcome.outcome_text) ?? state.outcome.outcome_text,
        eventTitle: event.title,
        marketImage: state.market?.icon_url,
        marketTitle: state.market?.short_title || state.market?.title,
        sellAmountValue,
        avgSellPrice: avgSellPriceLabel,
        buyPrice: displayBuyPriceCents,
        queryClient,
        outcomeIndex: state.outcome.outcome_index,
        lastMouseEvent: state.lastMouseEvent,
      })

      if (state.market?.condition_id && user?.id) {
        void queryClient.invalidateQueries({ queryKey: openOrdersQueryKey })
        void queryClient.invalidateQueries({ queryKey: eventOpenOrdersQueryKey })
        void queryClient.invalidateQueries({ queryKey: ['orderbook-summary'] })
        setTimeout(() => {
          void queryClient.invalidateQueries({ queryKey: openOrdersQueryKey })
          void queryClient.invalidateQueries({ queryKey: eventOpenOrdersQueryKey })
          void queryClient.invalidateQueries({ queryKey: ['orderbook-summary'] })
        }, 10_000)
      }

      void queryClient.invalidateQueries({ queryKey: [SAFE_BALANCE_QUERY_KEY] })

      setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: [SAFE_BALANCE_QUERY_KEY] })
        void queryClient.refetchQueries({ queryKey: ['event-activity'] })
        void queryClient.refetchQueries({ queryKey: ['event-holders'] })
      }, 3000)
    }
    catch {
      handleOrderErrorFeedback(t('Trade failed'), t('An unexpected error occurred. Please try again.'))
    }
    finally {
      state.setIsLoading(false)
    }
  }

  async function handleClaimWinnings() {
    if (isClaimSubmitting) {
      return
    }

    const conditionId = state.market?.condition_id

    if (!conditionId || claimIndexSets.length === 0 || claimableShares <= 0) {
      toast.info(t('No claimable winnings available for this market.'))
      return
    }

    if (!ensureTradingReady()) {
      return
    }

    if (!user?.proxy_wallet_address || !user?.address) {
      toast.error(t('Deploy your proxy wallet before claiming.'))
      return
    }

    setIsClaimSubmitting(true)

    try {
      const nonceResult = await getSafeNonceAction()
      if (nonceResult.error || !nonceResult.nonce) {
        if (isTradingAuthRequiredError(nonceResult.error)) {
          openTradeRequirements({ forceTradingAuth: true })
        }
        else {
          toast.error(nonceResult.error ?? DEFAULT_ERROR_MESSAGE)
        }
        return
      }

      const transaction = buildRedeemPositionTransaction({
        conditionId: conditionId as `0x${string}`,
        indexSets: claimIndexSets,
      })
      const aggregated = aggregateSafeTransactions([transaction])
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

      const signature = await runWithSignaturePrompt(() => signMessageAsync({
        message: { raw: structHash },
      }))

      const payload: SafeTransactionRequestPayload = {
        type: 'SAFE',
        from: user.address,
        to: aggregated.to,
        proxyWallet: user.proxy_wallet_address,
        data: aggregated.data,
        nonce: nonceResult.nonce,
        signature: packSafeSignature(signature as `0x${string}`),
        signatureParams,
        metadata: 'redeem_positions',
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

      toast.success(t('Claim submitted'), {
        description: t('We sent your claim transaction.'),
      })
      setClaimedConditionId(conditionId)

      void queryClient.invalidateQueries({ queryKey: ['order-panel-user-positions'] })
      void queryClient.invalidateQueries({ queryKey: ['user-market-positions'] })
      void queryClient.invalidateQueries({ queryKey: ['event-user-positions'] })
      void queryClient.invalidateQueries({ queryKey: ['user-event-positions'] })
      void queryClient.invalidateQueries({ queryKey: ['user-conditional-shares'] })
      void queryClient.invalidateQueries({ queryKey: ['portfolio-value'] })
      void queryClient.invalidateQueries({ queryKey: [SAFE_BALANCE_QUERY_KEY] })
    }
    catch (error) {
      console.error('Failed to submit claim.', error)
      toast.error(t('We could not submit your claim. Please try again.'))
    }
    finally {
      setIsClaimSubmitting(false)
    }
  }

  const yesOutcome = state.market?.outcomes[OUTCOME_INDEX.YES]
  const noOutcome = state.market?.outcomes[OUTCOME_INDEX.NO]
  function handleTypeChange(nextType: typeof state.type) {
    state.setType(nextType)
    if (nextType !== ORDER_TYPE.LIMIT) {
      return
    }
    const outcomeIndex = state.outcome?.outcome_index
    const nextPrice = outcomeIndex === OUTCOME_INDEX.NO ? noPrice : yesPrice
    if (nextPrice === null || nextPrice === undefined) {
      return
    }
    const cents = toCents(nextPrice)
    if (cents === null) {
      return
    }
    state.setLimitPrice(cents.toFixed(1))
  }

  return (
    <Form
      action={onSubmit}
      id="event-order-form"
      className={cn({
        'rounded-xl border lg:w-85': !isMobile,
      }, 'w-full p-4 lg:shadow-xl/5')}
    >
      {!isResolvedMarket && !isMobile && !isSingleMarket && <EventOrderPanelMarketInfo market={state.market} />}
      {!isResolvedMarket && isMobile && (
        <EventOrderPanelMobileMarketInfo
          event={event}
          market={state.market}
          isSingleMarket={isSingleMarket}
          balanceText={formattedBalanceText}
          isBalanceLoading={isLoadingBalance}
        />
      )}
      {isResolvedMarket
        ? (
            <div className="flex flex-col items-center gap-3 px-2 py-4 text-center">
              <div className="flex size-10 items-center justify-center rounded-full bg-primary">
                <CheckIcon className="size-7 text-background" strokeWidth={3} />
              </div>
              <div className="text-lg font-bold text-primary">
                {t('Outcome:')}
                {' '}
                {resolvedOutcomeLabel}
              </div>
              {!isSingleMarket && resolvedMarketTitle && (
                <div className="text-sm text-muted-foreground">{resolvedMarketTitle}</div>
              )}
              {hasClaimableWinnings && (
                <div className="mt-2 w-full space-y-3 text-left">
                  <div className="w-full border-t border-border" />
                  <p className="text-center text-base font-semibold text-foreground">{t('Your Earnings')}</p>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">{t('Position')}</span>
                      <span className="text-right font-medium text-foreground">{claimPositionLabel}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">{t('Value per share')}</span>
                      <span className="text-right font-medium text-foreground">{claimValuePerShareLabel}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">{t('Total')}</span>
                      <span className="text-right font-medium text-foreground">{claimTotalLabel}</span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    className="h-10 w-full"
                    onClick={handleClaimWinnings}
                    disabled={isClaimSubmitting || positionsQuery.isLoading}
                  >
                    {isClaimSubmitting ? t('Submitting...') : t('Claim winnings')}
                  </Button>
                </div>
              )}
            </div>
          )
        : (
            <>
              <EventOrderPanelBuySellTabs
                side={state.side}
                type={state.type}
                availableMergeShares={availableMergeShares}
                availableSplitBalance={availableSplitBalance}
                isNegRiskMarket={isNegRiskMarket}
                conditionId={state.market?.condition_id}
                marketTitle={state.market?.title || state.market?.short_title}
                marketIconUrl={state.market?.icon_url}
                onSideChange={state.setSide}
                onTypeChange={handleTypeChange}
                onAmountReset={() => state.setAmount('')}
                onFocusInput={focusInput}
              />

              <div className="mb-2 flex gap-2">
                <EventOrderPanelOutcomeButton
                  variant="yes"
                  price={yesPrice}
                  label={normalizeOutcomeLabel(yesOutcome?.outcome_text) ?? t('Yes')}
                  isSelected={state.outcome?.outcome_index === OUTCOME_INDEX.YES}
                  onSelect={() => {
                    if (!state.market || !yesOutcome) {
                      return
                    }
                    state.setOutcome(yesOutcome)
                    focusInput()
                  }}
                />
                <EventOrderPanelOutcomeButton
                  variant="no"
                  price={noPrice}
                  label={normalizeOutcomeLabel(noOutcome?.outcome_text) ?? t('No')}
                  isSelected={state.outcome?.outcome_index === OUTCOME_INDEX.NO}
                  onSelect={() => {
                    if (!state.market || !noOutcome) {
                      return
                    }
                    state.setOutcome(noOutcome)
                    focusInput()
                  }}
                />
              </div>

              {isLimitOrder
                ? (
                    <div className="mb-4">
                      {state.side === ORDER_SIDE.SELL && (
                        <EventOrderPanelUserShares
                          yesShares={availableYesTokenShares}
                          noShares={availableNoTokenShares}
                          activeOutcome={outcomeIndex}
                        />
                      )}
                      <EventOrderPanelLimitControls
                        side={state.side}
                        limitPrice={state.limitPrice}
                        limitShares={state.limitShares}
                        limitExpirationEnabled={state.limitExpirationEnabled}
                        limitExpirationOption={state.limitExpirationOption}
                        limitExpirationTimestamp={state.limitExpirationTimestamp}
                        isLimitOrder={isLimitOrder}
                        matchingShares={limitMatchingShares}
                        availableShares={selectedShares}
                        showLimitMinimumWarning={showLimitMinimumWarning}
                        shouldShakeShares={shouldShakeLimitShares}
                        limitSharesRef={limitSharesInputRef}
                        onLimitPriceChange={state.setLimitPrice}
                        onLimitSharesChange={state.setLimitShares}
                        onLimitExpirationEnabledChange={state.setLimitExpirationEnabled}
                        onLimitExpirationOptionChange={state.setLimitExpirationOption}
                        onLimitExpirationTimestampChange={state.setLimitExpirationTimestamp}
                        onAmountUpdateFromLimit={state.setAmount}
                      />
                    </div>
                  )
                : (
                    <>
                      {state.side === ORDER_SIDE.SELL
                        ? (
                            <EventOrderPanelUserShares
                              yesShares={availableYesPositionShares}
                              noShares={availableNoPositionShares}
                              activeOutcome={outcomeIndex}
                            />
                          )
                        : <div className="mb-4"></div>}
                      <EventOrderPanelInput
                        isMobile={isMobile}
                        side={state.side}
                        amount={state.amount}
                        amountNumber={amountNumber}
                        availableShares={selectedShares}
                        balance={balance}
                        isBalanceLoading={isLoadingBalance}
                        inputRef={state.inputRef}
                        onAmountChange={state.setAmount}
                        shouldShake={shouldShakeInput}
                      />
                      <div
                        className={cn(
                          'overflow-hidden transition-all duration-500 ease-in-out',
                          shouldShowEarnings
                            ? 'max-h-96 translate-y-0 opacity-100'
                            : 'pointer-events-none max-h-0 -translate-y-2 opacity-0',
                        )}
                        aria-hidden={!shouldShowEarnings}
                      >
                        <EventOrderPanelEarnings
                          isMobile={isMobile}
                          side={state.side}
                          sellAmountLabel={sellAmountLabel}
                          avgSellPriceLabel={avgSellPriceLabel}
                          avgBuyPriceLabel={avgBuyPriceLabel}
                          avgSellPriceCents={avgSellPriceCentsValue}
                          avgBuyPriceCents={avgBuyPriceCentsValue}
                          buyPayout={buyPayoutSummary.payout}
                          buyProfit={buyPayoutSummary.profit}
                          buyChangePct={buyPayoutSummary.changePct}
                          buyMultiplier={buyPayoutSummary.multiplier}
                        />
                      </div>
                      {showMarketMinimumWarning && (
                        <div
                          className={`
                            mt-3 flex animate-order-shake items-center justify-center gap-2 pb-1 text-sm font-semibold
                            text-orange-500
                          `}
                        >
                          <TriangleAlertIcon className="size-4" />
                          {t('Market buys must be at least $1')}
                        </div>
                      )}
                      {showNoLiquidityWarning && (
                        <div
                          className={`
                            mt-3 flex animate-order-shake items-center justify-center gap-2 pb-1 text-sm font-semibold
                            text-orange-500
                          `}
                        >
                          <TriangleAlertIcon className="size-4" />
                          {t('No liquidity for this market order')}
                        </div>
                      )}
                    </>
                  )}

              {(showInsufficientSharesWarning || showInsufficientBalanceWarning || showAmountTooLowWarning) && (
                <div
                  className={`
                    mt-2 mb-3 flex animate-order-shake items-center justify-center gap-2 text-sm font-semibold
                    text-orange-500
                  `}
                >
                  <TriangleAlertIcon className="size-4" />
                  {showAmountTooLowWarning
                    ? t('Amount too low')
                    : showInsufficientBalanceWarning
                      ? t('Insufficient USDC balance')
                      : t('Insufficient shares for this order')}
                </div>
              )}

              <EventOrderPanelSubmitButton
                type={!isConnected || shouldShowDepositCta ? 'button' : 'submit'}
                isLoading={state.isLoading}
                isDisabled={state.isLoading}
                onClick={(event) => {
                  if (!isConnected) {
                    void open()
                    return
                  }
                  if (shouldShowDepositCta) {
                    focusInput()
                    startDepositFlow()
                    return
                  }
                  state.setLastMouseEvent(event)
                }}
                label={(() => {
                  if (!isConnected) {
                    return t('Trade')
                  }
                  if (shouldShowDepositCta) {
                    return t('Deposit')
                  }
                  const outcomeLabel = selectedShareLabel
                  if (outcomeLabel) {
                    const verb = state.side === ORDER_SIDE.SELL ? t('Sell') : t('Buy')
                    return `${verb} ${outcomeLabel}`
                  }
                  return t('Trade')
                })()}
              />
            </>
          )}
    </Form>
  )
}
