import type { InfiniteData } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { PortfolioUserOpenOrder } from '@/app/[locale]/(platform)/portfolio/_types/PortfolioOpenOrdersTypes'
import type { OddsFormat } from '@/lib/odds-format'
import type { SafeTransactionRequestPayload } from '@/lib/safe/transactions'
import type { Event, Market, Outcome, UserPosition } from '@/types'
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
  resolveResolvedOrderPanelDisplay,
} from '@/app/[locale]/(platform)/event/[slug]/_utils/resolved-order-panel-market'
import { Button } from '@/components/ui/button'
import { useAffiliateOrderMetadata } from '@/hooks/useAffiliateOrderMetadata'
import { useAppKit } from '@/hooks/useAppKit'
import { SAFE_BALANCE_QUERY_KEY, useBalance } from '@/hooks/useBalance'
import { useOutcomeLabel } from '@/hooks/useOutcomeLabel'
import { useSignaturePromptRunner } from '@/hooks/useSignaturePromptRunner'
import { defaultNetwork } from '@/lib/appkit'
import { CLOB_ORDER_TYPE, DEFAULT_ERROR_MESSAGE, getExchangeEip712Domain, ORDER_SIDE, ORDER_TYPE, OUTCOME_INDEX } from '@/lib/constants'
import { resolveEventPagePath } from '@/lib/events-routing'
import { formatCentsLabel, formatCurrency, formatSharesLabel, toCents } from '@/lib/formatters'
import {
  applyPositionDeltasToUserPositions,
  buildOptimisticOpenOrder,
  prependOpenOrderToInfiniteData,
  updateQueryDataWhere,
} from '@/lib/optimistic-trading'
import {
  calculateMarketFill,
  normalizeBookLevels,
} from '@/lib/order-panel-utils'
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
import { useNotifications } from '@/stores/useNotifications'
import { useAmountAsNumber, useIsLimitOrder, useNoPrice, useOrder, useYesPrice } from '@/stores/useOrder'
import { useUser } from '@/stores/useUser'

interface EventOrderPanelFormProps {
  isMobile: boolean
  event: Event
  initialMarket?: Market | null
  initialOutcome?: Outcome | null
  desktopMarketInfo?: ReactNode
  mobileMarketInfo?: ReactNode
  primaryOutcomeIndex?: number | null
  oddsFormat?: OddsFormat
  outcomeButtonStyleVariant?: 'default' | 'sports3d'
  optimisticallyClaimedConditionIds?: Record<string, true>
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

function markConditionAsClaimedInPositions<T extends {
  market?: { condition_id?: string | null } | null
  redeemable?: boolean
}>(positions: T[] | undefined, conditionId: string): T[] | undefined {
  if (!Array.isArray(positions) || !conditionId) {
    return positions
  }

  let hasChanges = false
  const next = positions.map((position) => {
    if (!position || position.market?.condition_id !== conditionId || position.redeemable === false) {
      return position
    }

    hasChanges = true
    return {
      ...position,
      redeemable: false,
    }
  })

  return hasChanges ? next : positions
}

function resolveValidCustomExpirationTimestamp(params: {
  limitExpirationOption: string
  limitExpirationTimestamp: number | null | undefined
  nowSeconds: number
}) {
  const { limitExpirationOption, limitExpirationTimestamp, nowSeconds } = params

  if (limitExpirationOption !== 'custom') {
    return null
  }

  if (
    !limitExpirationTimestamp
    || !Number.isFinite(limitExpirationTimestamp)
    || limitExpirationTimestamp <= 0
  ) {
    return null
  }

  return limitExpirationTimestamp > nowSeconds
    ? limitExpirationTimestamp
    : null
}

function resolveEndOfDayTimestamp() {
  const now = new Date(Date.now())
  now.setHours(23, 59, 59, 0)
  return Math.floor(now.getTime() / 1000)
}

function normalizeMarketPrice(market: Market | null | undefined) {
  if (!market) {
    return null
  }

  const value = Number.isFinite(market.price)
    ? market.price
    : Number.isFinite(market.probability)
      ? Number(market.probability) / 100
      : null

  if (value == null) {
    return null
  }

  return Math.max(0, Math.min(1, value))
}

function resolveMarketOutcome(
  market: Market | null | undefined,
  outcomeIndex: typeof OUTCOME_INDEX.YES | typeof OUTCOME_INDEX.NO,
) {
  if (!market) {
    return null
  }

  return market.outcomes.find(outcome => outcome.outcome_index === outcomeIndex)
    ?? market.outcomes[outcomeIndex]
    ?? null
}

function resolveFallbackOutcomePrice(
  market: Market | null | undefined,
  outcome: Outcome | null | undefined,
) {
  if (outcome && Number.isFinite(outcome.buy_price)) {
    return Math.max(0, Math.min(1, Number(outcome.buy_price)))
  }

  const marketPrice = normalizeMarketPrice(market)
  if (marketPrice == null) {
    return null
  }

  return outcome?.outcome_index === OUTCOME_INDEX.NO
    ? Math.max(0, Math.min(1, 1 - marketPrice))
    : marketPrice
}

export default function EventOrderPanelForm({
  event,
  isMobile,
  initialMarket = null,
  initialOutcome = null,
  desktopMarketInfo,
  mobileMarketInfo,
  primaryOutcomeIndex = null,
  oddsFormat = 'price',
  outcomeButtonStyleVariant = 'default',
  optimisticallyClaimedConditionIds = {},
}: EventOrderPanelFormProps) {
  const { open } = useAppKit()
  const { isConnected } = useAppKitAccount()
  const { signTypedDataAsync } = useSignTypedData()
  const { signMessageAsync } = useSignMessage()
  const { runWithSignaturePrompt } = useSignaturePromptRunner()
  const t = useExtracted()
  const locale = useLocale()
  const normalizeOutcomeLabel = useOutcomeLabel()
  const user = useUser()
  const addLocalOrderFillNotification = useNotifications(state => state.addLocalOrderFillNotification)
  const state = useOrder()
  const setUserShares = useOrder(store => store.setUserShares)
  const queryClient = useQueryClient()
  const liveYesPrice = useYesPrice()
  const liveNoPrice = useNoPrice()
  const hasMatchingStoreEvent = state.event?.id === event.id
  const hasMatchingStoreMarket = Boolean(
    state.market
    && event.markets.some(market => market.condition_id === state.market?.condition_id),
  )
  const activeEvent: Event = hasMatchingStoreEvent && state.event ? state.event : event
  const activeMarket = hasMatchingStoreMarket ? state.market : initialMarket
  const fallbackOutcome = useMemo(() => {
    if (initialOutcome) {
      return initialOutcome
    }
    return activeMarket?.outcomes[0] ?? null
  }, [activeMarket, initialOutcome])
  const hasMatchingStoreOutcome = Boolean(
    state.outcome
    && activeMarket
    && state.outcome.condition_id === activeMarket.condition_id,
  )
  const activeOutcome = hasMatchingStoreOutcome ? state.outcome : fallbackOutcome
  const isSingleMarket = activeEvent.total_markets_count === 1
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
  const [claimedConditionIds, setClaimedConditionIds] = useState<Record<string, true>>({})
  const [hasMounted, setHasMounted] = useState(false)
  const limitSharesInputRef = useRef<HTMLInputElement | null>(null)
  const limitSharesNumber = Number.parseFloat(state.limitShares) || 0
  const { balance, isLoadingBalance } = useBalance()
  const yesOutcome = useMemo(
    () => resolveMarketOutcome(activeMarket, OUTCOME_INDEX.YES),
    [activeMarket],
  )
  const noOutcome = useMemo(
    () => resolveMarketOutcome(activeMarket, OUTCOME_INDEX.NO),
    [activeMarket],
  )
  const yesPrice = liveYesPrice ?? resolveFallbackOutcomePrice(activeMarket, yesOutcome)
  const noPrice = liveNoPrice ?? resolveFallbackOutcomePrice(activeMarket, noOutcome)
  const outcomeTokenId = activeOutcome?.token_id ? String(activeOutcome.token_id) : null
  const shouldLoadOrderBookSummary = Boolean(
    outcomeTokenId
    && (state.type === ORDER_TYPE.MARKET
      || (state.type === ORDER_TYPE.LIMIT && Number.parseFloat(state.limitPrice || '0') > 0)),
  )
  const orderBookSummaryQuery = useOrderBookSummaries(
    outcomeTokenId ? [outcomeTokenId] : [],
    { enabled: shouldLoadOrderBookSummary },
  )
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
    conditionId: activeMarket?.condition_id,
  })
  const eventOpenOrdersQueryKey = useMemo(
    () => buildUserOpenOrdersQueryKey(user?.id, event.slug),
    [event.slug, user?.id],
  )
  const isNegRiskEnabled = Boolean(event.enable_neg_risk)
  const isNegRiskMarket = typeof activeMarket?.neg_risk === 'boolean'
    ? activeMarket.neg_risk
    : Boolean(event.enable_neg_risk || event.neg_risk)
  const isResolvedMarket = Boolean(activeMarket?.is_resolved || activeMarket?.condition?.resolved)
  const resolvedDisplay = useMemo(
    () => resolveResolvedOrderPanelDisplay({
      event,
      selectedMarket: activeMarket,
    }),
    [activeMarket, event],
  )
  const resolvedOutcomeIndex = resolvedDisplay.resolvedOutcomeIndex
  const resolvedOutcomeLabel = resolvedDisplay.outcomeLabel
    ? (normalizeOutcomeLabel(resolvedDisplay.outcomeLabel) || resolvedDisplay.outcomeLabel)
    : resolvedOutcomeIndex === OUTCOME_INDEX.YES
      ? t('Yes')
      : resolvedOutcomeIndex === OUTCOME_INDEX.NO
        ? t('No')
        : null
  const shouldShowResolvedSportsSubtitle = Boolean(
    activeMarket?.sports_market_type
    || resolvedDisplay.market?.sports_market_type
    || resolvedDisplay.marketTitle,
  )
  const resolvedMarketTitle = resolvedDisplay.marketTitle
    ?? (
      shouldShowResolvedSportsSubtitle
        ? resolvedDisplay.market?.sports_group_item_title?.trim()
        || resolvedDisplay.market?.short_title?.trim()
        || resolvedDisplay.market?.title?.trim()
        || null
        : null
    )
  const resolvedYesOutcomeText = resolvedDisplay.market?.outcomes.find(
    outcome => outcome.outcome_index === OUTCOME_INDEX.YES,
  )?.outcome_text
  ?? activeMarket?.outcomes.find(outcome => outcome.outcome_index === OUTCOME_INDEX.YES)?.outcome_text
  const resolvedNoOutcomeText = resolvedDisplay.market?.outcomes.find(
    outcome => outcome.outcome_index === OUTCOME_INDEX.NO,
  )?.outcome_text
  ?? activeMarket?.outcomes.find(outcome => outcome.outcome_index === OUTCOME_INDEX.NO)?.outcome_text
  const resolvedYesOutcomeLabel = (resolvedYesOutcomeText ? normalizeOutcomeLabel(resolvedYesOutcomeText) : '')
    || resolvedYesOutcomeText
    || t('Yes')
  const resolvedNoOutcomeLabel = (resolvedNoOutcomeText ? normalizeOutcomeLabel(resolvedNoOutcomeText) : '')
    || resolvedNoOutcomeText
    || t('No')
  const orderDomain = useMemo(() => getExchangeEip712Domain(isNegRiskEnabled), [isNegRiskEnabled])
  const [showLimitMinimumWarning, setShowLimitMinimumWarning] = useState(false)
  const { positionsQuery, aggregatedPositionShares } = useEventOrderPanelPositions({
    makerAddress,
    conditionId: activeMarket?.condition_id,
  })

  useEffect(() => {
    setHasMounted(true)
  }, [])

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

  const conditionTokenShares = activeMarket ? state.userShares[activeMarket.condition_id] : undefined
  const conditionPositionShares = activeMarket ? aggregatedPositionShares?.[activeMarket.condition_id] : undefined
  const yesTokenShares = conditionTokenShares?.[OUTCOME_INDEX.YES] ?? 0
  const noTokenShares = conditionTokenShares?.[OUTCOME_INDEX.NO] ?? 0
  const yesPositionShares = conditionPositionShares?.[OUTCOME_INDEX.YES] ?? 0
  const noPositionShares = conditionPositionShares?.[OUTCOME_INDEX.NO] ?? 0
  const lockedYesShares = activeMarket ? openSellSharesByCondition[activeMarket.condition_id]?.[OUTCOME_INDEX.YES] ?? 0 : 0
  const lockedNoShares = activeMarket ? openSellSharesByCondition[activeMarket.condition_id]?.[OUTCOME_INDEX.NO] ?? 0 : 0
  const availableYesTokenShares = Math.max(0, yesTokenShares - lockedYesShares)
  const availableNoTokenShares = Math.max(0, noTokenShares - lockedNoShares)
  const availableYesPositionShares = Math.max(0, yesPositionShares - lockedYesShares)
  const availableNoPositionShares = Math.max(0, noPositionShares - lockedNoShares)
  const mergeableYesShares = Math.max(availableYesTokenShares, availableYesPositionShares)
  const mergeableNoShares = Math.max(availableNoTokenShares, availableNoPositionShares)
  const availableMergeShares = Math.max(0, Math.min(mergeableYesShares, mergeableNoShares))
  const availableSplitBalance = Math.max(0, balance.raw)
  const outcomeIndex = activeOutcome?.outcome_index as typeof OUTCOME_INDEX.YES | typeof OUTCOME_INDEX.NO | undefined
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
  const selectedShareLabel = normalizeOutcomeLabel(activeOutcome?.outcome_text)
    ?? (outcomeIndex === OUTCOME_INDEX.NO
      ? t('No')
      : outcomeIndex === OUTCOME_INDEX.YES
        ? t('Yes')
        : undefined)
  const claimablePositionsForMarket = useMemo(() => {
    if (!isResolvedMarket || !activeMarket?.condition_id) {
      return []
    }

    const positions = positionsQuery.data ?? []
    return positions.filter((position) => {
      if (!position.redeemable || position.market?.condition_id !== activeMarket?.condition_id) {
        return false
      }
      const shares = typeof position.total_shares === 'number' ? position.total_shares : 0
      return shares > 0
    })
  }, [activeMarket?.condition_id, isResolvedMarket, positionsQuery.data])
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
    activeMarket?.condition_id
    && (
      claimedConditionIds[activeMarket.condition_id]
      || optimisticallyClaimedConditionIds[activeMarket.condition_id]
    ),
  )
  const hasClaimableWinnings = Boolean(activeMarket?.condition_id)
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
  const outcomeFallbackBuyPriceCents = typeof activeOutcome?.buy_price === 'number'
    ? Number((activeOutcome.buy_price * 100).toFixed(1))
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
  const isInteractiveWalletReady = hasMounted && isConnected
  const shouldShowDepositCta = isInteractiveWalletReady
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
    setClaimedConditionIds({})
  }, [event.id])

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
    const nowSeconds = Math.floor(Date.now() / 1000)
    const validCustomExpirationTimestamp = resolveValidCustomExpirationTimestamp({
      limitExpirationOption: state.limitExpirationOption,
      limitExpirationTimestamp: state.limitExpirationTimestamp,
      nowSeconds,
    })
    const endOfDayTimestamp = resolveEndOfDayTimestamp()

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
      market: activeMarket,
      outcome: activeOutcome,
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

    if (!activeMarket || !activeOutcome || !user || !userAddress || !makerAddress) {
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
      outcome: activeOutcome,
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
    const submittedSide = state.side
    const submittedIsLimitOrder = state.type === ORDER_TYPE.LIMIT
    const submittedAmountInput = state.amount
    const submittedSellSharesLabel = submittedSide === ORDER_SIDE.SELL
      ? (submittedIsLimitOrder ? state.limitShares : state.amount)
      : undefined
    const submittedBuyPriceCents = submittedSide === ORDER_SIDE.BUY
      ? (submittedIsLimitOrder
          ? (Number.parseFloat(state.limitPrice || '0') || 0)
          : (marketBuyFill?.avgPriceCents ?? currentBuyPriceCents ?? marketLimitPriceCents))
      : undefined
    const submittedBuySharesValue = submittedSide === ORDER_SIDE.BUY
      ? (submittedIsLimitOrder
          ? (Number.parseFloat(state.limitShares || '0') || 0)
          : (marketBuyFill?.filledShares ?? (
              submittedBuyPriceCents && submittedBuyPriceCents > 0
                ? amountNumber / (submittedBuyPriceCents / 100)
                : 0
            )))
      : 0
    const submittedBuySharesLabel = submittedSide === ORDER_SIDE.BUY && submittedBuySharesValue > 0
      ? formatSharesLabel(submittedBuySharesValue, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        })
      : undefined
    const submittedBuyAmountValue = submittedSide === ORDER_SIDE.BUY
      ? (submittedIsLimitOrder
          ? ((Number.parseFloat(state.limitPrice || '0') || 0) * (Number.parseFloat(state.limitShares || '0') || 0)) / 100
          : (marketBuyFill?.totalCost ?? amountNumber))
      : 0
    const submittedSellAmountValue = submittedSide === ORDER_SIDE.SELL ? sellAmountValue : 0
    const submittedAvgSellPriceLabel = avgSellPriceLabel
    const submittedOutcomeText = normalizeOutcomeLabel(activeOutcome.outcome_text) ?? activeOutcome.outcome_text
    const submittedEventTitle = event.title
    const submittedMarketImage = activeMarket.icon_url
    const submittedMarketTitle = activeMarket.short_title || activeMarket.title
    const submittedOutcomeIndex = activeOutcome.outcome_index
    const submittedLastMouseEvent = state.lastMouseEvent

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
        conditionId: activeMarket.condition_id,
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

      if (user?.settings?.notifications?.inapp_order_fills) {
        const isSell = submittedSide === ORDER_SIDE.SELL
        const buyAmountLabel = formatCurrency(submittedBuyAmountValue)
        const priceLabel = formatCentsLabel(submittedBuyPriceCents, { fallback: '—' })
        const displayShares = submittedSellSharesLabel && submittedSellSharesLabel.trim().length > 0
          ? submittedSellSharesLabel.trim()
          : submittedAmountInput
        const displayBuyShares = submittedBuySharesLabel?.trim()
        const amountPrefix = submittedIsLimitOrder ? 'Total' : 'Received'
        const eventContextLabel = submittedMarketTitle
          ? `${submittedEventTitle} • ${submittedMarketTitle}`
          : submittedEventTitle

        addLocalOrderFillNotification({
          action: isSell ? 'sell' : 'buy',
          title: isSell
            ? `Sell ${displayShares} shares on ${submittedOutcomeText}`
            : displayBuyShares
              ? `Buy ${displayBuyShares} shares on ${submittedOutcomeText}`
              : `Buy ${buyAmountLabel} on ${submittedOutcomeText}`,
          description: isSell
            ? `${eventContextLabel} • ${amountPrefix} ${formatCurrency(submittedSellAmountValue)} @ ${submittedAvgSellPriceLabel}`
            : `${eventContextLabel} • Total ${buyAmountLabel} @ ${priceLabel}`,
          eventPath: resolveEventPagePath(event),
          marketIconUrl: submittedMarketImage,
        })
      }

      handleOrderSuccessFeedback({
        side: submittedSide,
        amountInput: submittedAmountInput,
        buyAmountValue: submittedBuyAmountValue,
        buySharesLabel: submittedBuySharesLabel,
        sellSharesLabel: submittedSellSharesLabel,
        isLimitOrder: submittedIsLimitOrder,
        outcomeText: submittedOutcomeText,
        eventTitle: submittedEventTitle,
        marketImage: submittedMarketImage,
        marketTitle: submittedMarketTitle,
        sellAmountValue: submittedSellAmountValue,
        avgSellPrice: submittedAvgSellPriceLabel,
        buyPrice: submittedBuyPriceCents,
        queryClient,
        outcomeIndex: submittedOutcomeIndex as typeof OUTCOME_INDEX.YES | typeof OUTCOME_INDEX.NO,
        lastMouseEvent: submittedLastMouseEvent,
      })

      const optimisticPositionDelta = submittedIsLimitOrder
        ? null
        : {
            conditionId: activeMarket.condition_id,
            outcomeIndex: submittedOutcomeIndex as typeof OUTCOME_INDEX.YES | typeof OUTCOME_INDEX.NO,
            sharesDelta: submittedSide === ORDER_SIDE.BUY ? submittedBuySharesValue : -sellOrderSnapshot.shares,
            avgPrice: submittedSide === ORDER_SIDE.BUY
              ? ((submittedBuyPriceCents ?? 0) / 100)
              : undefined,
            currentPrice: submittedSide === ORDER_SIDE.BUY
              ? ((submittedBuyPriceCents ?? 0) / 100)
              : (avgSellPriceCentsValue ? avgSellPriceCentsValue / 100 : undefined),
            title: activeMarket.short_title || activeMarket.title,
            slug: activeMarket.slug,
            eventSlug: event.slug,
            iconUrl: activeMarket.icon_url,
            outcomeText: activeOutcome.outcome_text,
            isActive: true,
            isResolved: false,
          }

      if (optimisticPositionDelta && optimisticPositionDelta.sharesDelta !== 0) {
        updateQueryDataWhere<UserPosition[]>(
          queryClient,
          ['order-panel-user-positions', makerAddress, activeMarket.condition_id],
          currentQueryKey =>
            currentQueryKey[1] === makerAddress
            && currentQueryKey[2] === activeMarket.condition_id,
          current => applyPositionDeltasToUserPositions(current, [optimisticPositionDelta]),
        )

        updateQueryDataWhere<UserPosition[]>(
          queryClient,
          ['user-market-positions'],
          currentQueryKey =>
            currentQueryKey[1] === makerAddress
            && currentQueryKey[2] === activeMarket.condition_id
            && currentQueryKey[3] === 'active',
          current => applyPositionDeltasToUserPositions(current, [optimisticPositionDelta]),
        )

        updateQueryDataWhere<UserPosition[]>(
          queryClient,
          ['event-user-positions'],
          currentQueryKey =>
            currentQueryKey[1] === makerAddress
            && currentQueryKey[2] === event.id,
          current => applyPositionDeltasToUserPositions(current, [optimisticPositionDelta]),
        )

        updateQueryDataWhere<UserPosition[]>(
          queryClient,
          ['user-event-positions'],
          currentQueryKey =>
            currentQueryKey[1] === makerAddress
            && currentQueryKey[2] === 'active',
          current => applyPositionDeltasToUserPositions(current, [optimisticPositionDelta]),
        )
      }

      if (submittedIsLimitOrder && activeMarket.condition_id && user?.id) {
        const limitPriceValue = (Number.parseFloat(state.limitPrice || '0') || 0) / 100
        const limitSharesValue = Number.parseFloat(state.limitShares || '0') || 0
        const totalValue = limitPriceValue * limitSharesValue
        const orderId = result?.orderId ?? payload.salt.toString()
        const optimisticOrder = buildOptimisticOpenOrder({
          id: orderId,
          side: submittedSide === ORDER_SIDE.BUY ? 'buy' : 'sell',
          type: state.limitExpirationEnabled ? CLOB_ORDER_TYPE.GTD : CLOB_ORDER_TYPE.GTC,
          price: limitPriceValue,
          shares: limitSharesValue,
          totalValue,
          expiration: state.limitExpirationEnabled ? Number(payload.expiration) : null,
          outcomeIndex: submittedOutcomeIndex as typeof OUTCOME_INDEX.YES | typeof OUTCOME_INDEX.NO,
          outcomeText: submittedOutcomeText,
          conditionId: activeMarket.condition_id,
          marketTitle: activeMarket.short_title || activeMarket.title,
          marketSlug: activeMarket.slug,
          eventSlug: event.slug,
          eventTitle: event.title,
          iconUrl: activeMarket.icon_url,
        })

        queryClient.setQueryData<InfiniteData<{ data: PortfolioUserOpenOrder[], next_cursor: string }>>(openOrdersQueryKey, current =>
          prependOpenOrderToInfiniteData(current, optimisticOrder))
        queryClient.setQueryData<InfiniteData<{ data: PortfolioUserOpenOrder[], next_cursor: string }>>(eventOpenOrdersQueryKey, current =>
          prependOpenOrderToInfiniteData(current, optimisticOrder))

        updateQueryDataWhere<InfiniteData<{ data: PortfolioUserOpenOrder[], next_cursor: string }>>(
          queryClient,
          ['public-open-orders', makerAddress],
          currentQueryKey => currentQueryKey[1] === makerAddress,
          current => prependOpenOrderToInfiniteData(current, optimisticOrder),
        )
      }

      if (submittedIsLimitOrder && activeMarket.condition_id && user?.id) {
        setTimeout(() => {
          void queryClient.invalidateQueries({ queryKey: openOrdersQueryKey })
          void queryClient.invalidateQueries({ queryKey: eventOpenOrdersQueryKey })
          void queryClient.invalidateQueries({ queryKey: ['orderbook-summary'] })
        }, 15_000)
        setTimeout(() => {
          void queryClient.invalidateQueries({ queryKey: openOrdersQueryKey })
          void queryClient.invalidateQueries({ queryKey: eventOpenOrdersQueryKey })
          void queryClient.invalidateQueries({ queryKey: ['orderbook-summary'] })
        }, 60_000)
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

    const conditionId = activeMarket?.condition_id

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
      setClaimedConditionIds((current) => {
        if (current[conditionId]) {
          return current
        }

        return {
          ...current,
          [conditionId]: true,
        }
      })

      queryClient.setQueriesData({ queryKey: ['order-panel-user-positions'] }, current =>
        markConditionAsClaimedInPositions(current as any[] | undefined, conditionId))
      queryClient.setQueriesData({ queryKey: ['user-market-positions'] }, current =>
        markConditionAsClaimedInPositions(current as any[] | undefined, conditionId))
      queryClient.setQueriesData({ queryKey: ['event-user-positions'] }, current =>
        markConditionAsClaimedInPositions(current as any[] | undefined, conditionId))
      queryClient.setQueriesData({ queryKey: ['user-event-positions'] }, current =>
        markConditionAsClaimedInPositions(current as any[] | undefined, conditionId))
      queryClient.setQueriesData({ queryKey: ['sports-card-user-positions'] }, current =>
        markConditionAsClaimedInPositions(current as any[] | undefined, conditionId))

      void queryClient.invalidateQueries({ queryKey: [SAFE_BALANCE_QUERY_KEY] })
      setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: ['order-panel-user-positions'] })
        void queryClient.invalidateQueries({ queryKey: ['user-market-positions'] })
        void queryClient.invalidateQueries({ queryKey: ['event-user-positions'] })
        void queryClient.invalidateQueries({ queryKey: ['user-event-positions'] })
        void queryClient.invalidateQueries({ queryKey: ['user-conditional-shares'] })
        void queryClient.invalidateQueries({ queryKey: ['portfolio-value'] })
        void queryClient.invalidateQueries({ queryKey: [SAFE_BALANCE_QUERY_KEY] })
      }, 4_000)
      setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: ['order-panel-user-positions'] })
        void queryClient.invalidateQueries({ queryKey: ['user-market-positions'] })
        void queryClient.invalidateQueries({ queryKey: ['event-user-positions'] })
        void queryClient.invalidateQueries({ queryKey: ['user-event-positions'] })
        void queryClient.invalidateQueries({ queryKey: ['user-conditional-shares'] })
        void queryClient.invalidateQueries({ queryKey: ['portfolio-value'] })
        void queryClient.invalidateQueries({ queryKey: [SAFE_BALANCE_QUERY_KEY] })
      }, 12_000)
    }
    catch (error) {
      console.error('Failed to submit claim.', error)
      toast.error(t('We could not submit your claim. Please try again.'))
    }
    finally {
      setIsClaimSubmitting(false)
    }
  }

  const normalizedPrimaryOutcomeIndex
    = primaryOutcomeIndex === OUTCOME_INDEX.NO || primaryOutcomeIndex === OUTCOME_INDEX.YES
      ? primaryOutcomeIndex
      : OUTCOME_INDEX.YES
  const normalizedSecondaryOutcomeIndex
    = normalizedPrimaryOutcomeIndex === OUTCOME_INDEX.YES
      ? OUTCOME_INDEX.NO
      : OUTCOME_INDEX.YES
  const primaryOutcome = activeMarket?.outcomes.find(
    outcome => outcome.outcome_index === normalizedPrimaryOutcomeIndex,
  ) ?? activeMarket?.outcomes[normalizedPrimaryOutcomeIndex]
  const secondaryOutcome = activeMarket?.outcomes.find(
    outcome => outcome.outcome_index === normalizedSecondaryOutcomeIndex,
  ) ?? activeMarket?.outcomes[normalizedSecondaryOutcomeIndex]
  const primaryPrice = normalizedPrimaryOutcomeIndex === OUTCOME_INDEX.NO ? noPrice : yesPrice
  const secondaryPrice = normalizedSecondaryOutcomeIndex === OUTCOME_INDEX.NO ? noPrice : yesPrice
  function handleTypeChange(nextType: typeof state.type) {
    state.setType(nextType)
    if (nextType !== ORDER_TYPE.LIMIT) {
      return
    }
    const outcomeIndex = activeOutcome?.outcome_index
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
      {!isResolvedMarket && !isMobile && (
        desktopMarketInfo ?? (!isSingleMarket ? <EventOrderPanelMarketInfo market={activeMarket} /> : null)
      )}
      {!isResolvedMarket && isMobile && (
        mobileMarketInfo
        ?? (
          <EventOrderPanelMobileMarketInfo
            event={event}
            market={activeMarket}
            isSingleMarket={isSingleMarket}
            balanceText={formattedBalanceText}
            isBalanceLoading={isLoadingBalance}
          />
        )
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
              {((!isSingleMarket || shouldShowResolvedSportsSubtitle) && resolvedMarketTitle) && (
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
                eventId={event.id}
                eventSlug={event.slug}
                isNegRiskMarket={isNegRiskMarket}
                conditionId={activeMarket?.condition_id}
                marketSlug={activeMarket?.slug}
                eventPath={resolveEventPagePath(event)}
                marketTitle={activeMarket?.title || activeMarket?.short_title}
                marketIconUrl={activeMarket?.icon_url}
                onSideChange={state.setSide}
                onTypeChange={handleTypeChange}
                onAmountReset={() => state.setAmount('')}
                onFocusInput={focusInput}
              />

              <div className="mb-2 flex gap-2">
                <EventOrderPanelOutcomeButton
                  variant="yes"
                  price={primaryPrice}
                  label={normalizeOutcomeLabel(primaryOutcome?.outcome_text) ?? t('Yes')}
                  isSelected={activeOutcome?.outcome_index === normalizedPrimaryOutcomeIndex}
                  oddsFormat={oddsFormat}
                  styleVariant={outcomeButtonStyleVariant}
                  onSelect={() => {
                    if (!activeMarket || !primaryOutcome) {
                      return
                    }
                    if (!state.market) {
                      state.setMarket(activeMarket)
                    }
                    state.setOutcome(primaryOutcome)
                    focusInput()
                  }}
                />
                <EventOrderPanelOutcomeButton
                  variant="no"
                  price={secondaryPrice}
                  label={normalizeOutcomeLabel(secondaryOutcome?.outcome_text) ?? t('No')}
                  isSelected={activeOutcome?.outcome_index === normalizedSecondaryOutcomeIndex}
                  oddsFormat={oddsFormat}
                  styleVariant={outcomeButtonStyleVariant}
                  onSelect={() => {
                    if (!activeMarket || !secondaryOutcome) {
                      return
                    }
                    if (!state.market) {
                      state.setMarket(activeMarket)
                    }
                    state.setOutcome(secondaryOutcome)
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
                type={!isInteractiveWalletReady || shouldShowDepositCta ? 'button' : 'submit'}
                isLoading={state.isLoading}
                isDisabled={state.isLoading}
                onClick={(event) => {
                  if (!isInteractiveWalletReady) {
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
                  if (!isInteractiveWalletReady) {
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
