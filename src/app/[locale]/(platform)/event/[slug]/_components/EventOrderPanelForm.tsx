import type { InfiniteData } from '@tanstack/react-query'
import type {
  ConditionSharesMap,
  EventOrderPanelFormProps,
  ResolveDisplayOutcomeLabel,
} from '@/app/[locale]/(platform)/event/[slug]/_types/EventOrderPanelTypes'
import type { PortfolioUserOpenOrder } from '@/app/[locale]/(platform)/portfolio/_types/PortfolioOpenOrdersTypes'
import type { ArbitrageQuote } from '@/lib/arbitrage-quote'
import type { Event, Market, Outcome, UserPosition } from '@/types'
import { useAppKitAccount } from '@reown/appkit/react'
import { useQueryClient } from '@tanstack/react-query'
import { useExtracted, useLocale } from 'next-intl'
import Form from 'next/form'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import { useAccount, useConfig, useSignTypedData } from 'wagmi'
import { getConnections, signTypedData as signTypedDataAction, switchChain } from 'wagmi/actions'
import { useTradingOnboarding } from '@/app/[locale]/(platform)/_providers/TradingOnboardingProvider'
import { useOrderBookSummaries } from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderBook'
import EventOrderPanelArbitrage from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelArbitrage'
import EventOrderPanelBuySellTabs from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelBuySellTabs'
import EventOrderPanelMarketInfo from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelMarketInfo'
import EventOrderPanelMobileMarketInfo
  from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelMobileMarketInfo'
import EventOrderPanelOrderInput from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelOrderInput'
import EventOrderPanelOutcomeSelector
  from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelOutcomeSelector'
import EventOrderPanelResolvedMarketDisplay
  from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelResolvedMarketDisplay'
import EventOrderPanelSlippageOverlay
  from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelSlippageOverlay'
import EventTradeToast from '@/app/[locale]/(platform)/event/[slug]/_components/EventTradeToast'
import {
  handleOrderCancelledFeedback,
  handleOrderErrorFeedback,
  handleOrderSuccessFeedback,
  handleValidationError,
} from '@/app/[locale]/(platform)/event/[slug]/_components/feedback'
import { useEventOrderPanelOpenOrders } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventOrderPanelOpenOrders'
import { useEventOrderPanelPositions } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventOrderPanelPositions'
import { buildUserOpenOrdersQueryKey } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useUserOpenOrdersQuery'
import { useUserShareBalances } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useUserShareBalances'
import { useXTrackerTweetCount } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useXTrackerTweetCount'
import {
  inferResolvedTweetMarketOutcome,
  isTweetMarketsEvent,
} from '@/app/[locale]/(platform)/event/[slug]/_utils/eventTweetMarkets'
import {
  resolveResolvedOrderPanelDisplay,
} from '@/app/[locale]/(platform)/event/[slug]/_utils/resolved-order-panel-market'
import { useAffiliateOrderMetadata } from '@/hooks/useAffiliateOrderMetadata'
import { useAppKit } from '@/hooks/useAppKit'
import { useArbitrageConfig } from '@/hooks/useArbitrageConfig'
import { DEPOSIT_WALLET_BALANCE_QUERY_KEY, useBalance } from '@/hooks/useBalance'
import { useCurrentTimestamp } from '@/hooks/useCurrentTimestamp'
import { useHasHydrated } from '@/hooks/useHasHydrated'
import { useOutcomeLabel } from '@/hooks/useOutcomeLabel'
import { useSignaturePromptRunner } from '@/hooks/useSignaturePromptRunner'
import { useSiteIdentity } from '@/hooks/useSiteIdentity'
import { addressToBuilderCode } from '@/lib/builder-code'
import { CLOB_ORDER_TYPE, getExchangeEip712Domain, ORDER_SIDE, ORDER_TYPE, OUTCOME_INDEX } from '@/lib/constants'
import { resolveEventPagePath } from '@/lib/events-routing'
import { formatCentsLabel, formatCentsValueLabel, formatCurrency, formatDollarValueLabel, formatSharesLabel, toCents } from '@/lib/formatters'
import { resolveFallbackOutcomeUnitPrice, resolveMarketOutcome } from '@/lib/market-pricing'
import {
  isCurrentNegRiskAdapterAddress,
  resolveNegRiskAdapterAddressFromMetadata,
} from '@/lib/neg-risk-adapter'
import { DEFAULT_CHAIN_ID } from '@/lib/network'
import {
  applyPositionDeltasToUserPositions,
  buildOptimisticOpenOrder,
  prependOpenOrderToInfiniteData,
  updateQueryDataWhere,
} from '@/lib/optimistic-trading'
import { calculateMarketFill, normalizeBookLevels } from '@/lib/order-panel-utils'
import { buildOrderPayload, submitOrder } from '@/lib/orders'
import { resolveOrderExpirationTimestamp } from '@/lib/orders/expiration'
import { signOrderPayload } from '@/lib/orders/signing'
import {
  MIN_LIMIT_ORDER_SHARES,
  MIN_MARKET_BUY_AMOUNT,
  validateOrder,
} from '@/lib/orders/validation'
import { selectPolymarketConnection } from '@/lib/polymarket-connection'
import {
  POLYMARKET_MIN_MARKETABLE_BUY_AMOUNT,
  PolymarketAuthenticationError,
  preparePolymarketOrder,
} from '@/lib/polymarket-orders-client'
import { isTradingAuthRequiredError } from '@/lib/trading-auth/errors'
import { invalidateTradingClaimQueries, scheduleOrderBookRefresh } from '@/lib/trading-cache'
import { cn, triggerConfetti } from '@/lib/utils'
import { isUserRejectedRequestError, normalizeAddress } from '@/lib/wallet'
import { signAndSubmitDepositWalletCalls } from '@/lib/wallet/client'
import { buildNegRiskRedeemPositionCall, buildRedeemPositionCall } from '@/lib/wallet/transactions'
import { useNotifications } from '@/stores/useNotifications'
import { useAmountAsNumber, useIsLimitOrder, useNoPrice, useOrder, useYesPrice } from '@/stores/useOrder'
import { usePolymarketWallet } from '@/stores/usePolymarketWallet'
import { useUser } from '@/stores/useUser'

type SetUserShares = ReturnType<typeof useOrder.getState>['setUserShares']
const ORDER_PANEL_MODE_COOKIE = 'kuest_order_panel_mode'
const ORDER_PANEL_MODE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365
const ORDER_PANEL_MODE_CHANGE_EVENT = 'kuest:order-panel-mode-change'

function readOrderPanelModeCookie() {
  if (typeof document === 'undefined') {
    return null
  }

  const value = document.cookie
    .split('; ')
    .find(cookie => cookie.startsWith(`${ORDER_PANEL_MODE_COOKIE}=`))
    ?.split('=')[1]
  return value === 'arbitrage' ? 'arbitrage' : value === 'trade' ? 'trade' : null
}

function persistOrderPanelModeCookie(mode: 'trade' | 'arbitrage') {
  if (typeof document === 'undefined') {
    return
  }

  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${ORDER_PANEL_MODE_COOKIE}=${mode}; Path=/; Max-Age=${ORDER_PANEL_MODE_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secure}`
  window.dispatchEvent(new Event(ORDER_PANEL_MODE_CHANGE_EVENT))
}

function subscribeOrderPanelMode(callback: () => void) {
  window.addEventListener(ORDER_PANEL_MODE_CHANGE_EVENT, callback)
  return () => window.removeEventListener(ORDER_PANEL_MODE_CHANGE_EVENT, callback)
}

function getOrderPanelModeSnapshot() {
  return readOrderPanelModeCookie() ?? 'trade'
}

function getOrderPanelModeServerSnapshot() {
  return 'trade' as const
}

function getArbitrageSubmissionErrorMessage(error: unknown) {
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>
    const status = typeof record.status === 'number' ? record.status : null
    if (status === 403 || (status != null && status >= 500)) {
      return undefined
    }
  }
  if (error instanceof Error && error.message) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>
    if (typeof record.errorMsg === 'string') {
      return record.errorMsg
    }
    if (typeof record.error === 'string') {
      return record.error
    }
  }
  return undefined
}

const PRICE_SLIPPAGE_WARNING_THRESHOLD = 0.10

interface MarketOrderSlippageWarning {
  side: typeof ORDER_SIDE.BUY | typeof ORDER_SIDE.SELL
  avgPriceCents: number
  filledShares: number
  totalValue: number
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

function mergeUserSharesByCondition(
  sharesByCondition: ConditionSharesMap,
  aggregatedPositionShares: ConditionSharesMap | null | undefined,
) {
  const merged: ConditionSharesMap = {}
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
}

function writeMergedUserSharesToOrderStore({
  makerAddress,
  mergedSharesByCondition,
  setUserShares,
}: {
  makerAddress: string | null
  mergedSharesByCondition: ConditionSharesMap
  setUserShares: SetUserShares
}) {
  if (!makerAddress) {
    setUserShares({}, { replace: true })
    return
  }

  if (!Object.keys(mergedSharesByCondition).length) {
    setUserShares({}, { replace: true })
    return
  }

  setUserShares(mergedSharesByCondition, { replace: true })
}

function useUserSharesStoreSync({
  makerAddress,
  sharesByCondition,
  aggregatedPositionShares,
}: {
  makerAddress: string | null
  sharesByCondition: ConditionSharesMap
  aggregatedPositionShares: ConditionSharesMap | null | undefined
}) {
  const setUserShares = useOrder(store => store.setUserShares)
  const mergedSharesByCondition = useMemo(
    () => mergeUserSharesByCondition(sharesByCondition, aggregatedPositionShares),
    [aggregatedPositionShares, sharesByCondition],
  )

  useEffect(function syncMergedUserSharesToStore() {
    writeMergedUserSharesToOrderStore({
      makerAddress,
      mergedSharesByCondition,
      setUserShares,
    })
  }, [makerAddress, mergedSharesByCondition, setUserShares])
}

function useResolvedMarketDisplay({
  event,
  activeMarket,
  currentTimestamp,
  resolveDisplayOutcomeLabel,
}: {
  event: Event
  activeMarket: Market | null | undefined
  currentTimestamp: number | null
  resolveDisplayOutcomeLabel: (
    outcomeIndex: number | null | undefined,
    outcomeText: string | null | undefined,
    fallbackLabel: string,
  ) => string
}) {
  const t = useExtracted()
  const isResolvedMarket = Boolean(activeMarket?.is_resolved || activeMarket?.condition?.resolved)
  const isTweetMarketEvent = useMemo(
    () => isTweetMarketsEvent(event),
    [event],
  )
  const xtrackerTweetCountQuery = useXTrackerTweetCount(event, isTweetMarketEvent)
  const resolvedDisplay = useMemo(
    () => resolveResolvedOrderPanelDisplay({
      event,
      selectedMarket: activeMarket,
    }),
    [activeMarket, event],
  )
  const isTweetMarketFinal = useMemo(() => {
    if (currentTimestamp == null) {
      return false
    }

    const trackingEndMs = xtrackerTweetCountQuery.data?.trackingEndMs
    if (typeof trackingEndMs === 'number' && Number.isFinite(trackingEndMs)) {
      return currentTimestamp >= trackingEndMs
    }

    if (!event.end_date) {
      return false
    }

    const parsedEndMs = Date.parse(event.end_date)
    return Number.isFinite(parsedEndMs) && currentTimestamp >= parsedEndMs
  }, [currentTimestamp, event.end_date, xtrackerTweetCountQuery.data?.trackingEndMs])
  const inferredTweetResolvedOutcomeIndex = useMemo(() => {
    if (!isTweetMarketEvent || !activeMarket || !isResolvedMarket) {
      return null
    }

    return inferResolvedTweetMarketOutcome(
      activeMarket,
      xtrackerTweetCountQuery.data?.totalCount ?? null,
      isTweetMarketFinal,
    )
  }, [
    activeMarket,
    isResolvedMarket,
    isTweetMarketEvent,
    isTweetMarketFinal,
    xtrackerTweetCountQuery.data?.totalCount,
  ])
  const resolvedOutcomeIndex = inferredTweetResolvedOutcomeIndex ?? resolvedDisplay.resolvedOutcomeIndex
  const resolvedOutcomeLabel = useMemo(() => {
    if (inferredTweetResolvedOutcomeIndex != null) {
      return resolveDisplayOutcomeLabel(
        inferredTweetResolvedOutcomeIndex,
        null,
        inferredTweetResolvedOutcomeIndex === OUTCOME_INDEX.YES ? t('Yes') : t('No'),
      )
    }

    if (resolvedDisplay.outcomeLabel) {
      return resolveDisplayOutcomeLabel(
        resolvedOutcomeIndex,
        resolvedDisplay.outcomeLabel,
        resolvedDisplay.outcomeLabel,
      )
    }

    if (resolvedOutcomeIndex === OUTCOME_INDEX.YES) {
      return resolveDisplayOutcomeLabel(OUTCOME_INDEX.YES, null, t('Yes'))
    }

    if (resolvedOutcomeIndex === OUTCOME_INDEX.NO) {
      return resolveDisplayOutcomeLabel(OUTCOME_INDEX.NO, null, t('No'))
    }

    return null
  }, [
    inferredTweetResolvedOutcomeIndex,
    resolvedDisplay.outcomeLabel,
    resolvedOutcomeIndex,
    resolveDisplayOutcomeLabel,
    t,
  ])
  const shouldShowResolvedSportsSubtitle = Boolean(
    activeMarket?.sports_market_type
    || resolvedDisplay.market?.sports_market_type
    || resolvedDisplay.marketTitle,
  )
  const resolvedMarketTitle = useMemo(() => {
    if (isTweetMarketEvent) {
      return activeMarket?.short_title?.trim()
        || activeMarket?.title?.trim()
        || resolvedDisplay.marketTitle
        || null
    }

    if (resolvedDisplay.marketTitle) {
      return resolvedDisplay.marketTitle
    }

    if (!shouldShowResolvedSportsSubtitle) {
      return null
    }

    return resolvedDisplay.market?.sports_group_item_title?.trim()
      || resolvedDisplay.market?.short_title?.trim()
      || resolvedDisplay.market?.title?.trim()
      || null
  }, [
    activeMarket?.short_title,
    activeMarket?.title,
    isTweetMarketEvent,
    resolvedDisplay.market?.short_title,
    resolvedDisplay.market?.sports_group_item_title,
    resolvedDisplay.market?.title,
    resolvedDisplay.marketTitle,
    shouldShowResolvedSportsSubtitle,
  ])
  const resolvedYesOutcomeText = resolvedDisplay.market?.outcomes.find(
    outcome => outcome.outcome_index === OUTCOME_INDEX.YES,
  )?.outcome_text
  ?? activeMarket?.outcomes.find(outcome => outcome.outcome_index === OUTCOME_INDEX.YES)?.outcome_text
  const resolvedNoOutcomeText = resolvedDisplay.market?.outcomes.find(
    outcome => outcome.outcome_index === OUTCOME_INDEX.NO,
  )?.outcome_text
  ?? activeMarket?.outcomes.find(outcome => outcome.outcome_index === OUTCOME_INDEX.NO)?.outcome_text
  const resolvedYesOutcomeLabel = resolveDisplayOutcomeLabel(OUTCOME_INDEX.YES, resolvedYesOutcomeText, t('Yes'))
  const resolvedNoOutcomeLabel = resolveDisplayOutcomeLabel(OUTCOME_INDEX.NO, resolvedNoOutcomeText, t('No'))

  return {
    isResolvedMarket,
    resolvedOutcomeIndex,
    resolvedOutcomeLabel,
    shouldShowResolvedSportsSubtitle,
    resolvedMarketTitle,
    resolvedYesOutcomeLabel,
    resolvedNoOutcomeLabel,
  }
}

function useOrderBookComputations({
  outcomeTokenId,
  orderBookSummaryData,
  side,
  type,
  amount,
  limitPrice,
  limitShares,
  isLimitOrder,
  amountNumber,
  outcomeFallbackBuyPriceCents,
}: {
  outcomeTokenId: string | null
  orderBookSummaryData: ReturnType<typeof useOrderBookSummaries>['data']
  side: typeof ORDER_SIDE.BUY | typeof ORDER_SIDE.SELL
  type: typeof ORDER_TYPE.MARKET | typeof ORDER_TYPE.LIMIT
  amount: string
  limitPrice: string
  limitShares: string
  isLimitOrder: boolean
  amountNumber: number
  outcomeFallbackBuyPriceCents: number | null
}) {
  const normalizedOrderBook = useMemo(() => {
    const summary = outcomeTokenId ? orderBookSummaryData?.[outcomeTokenId] : undefined
    return {
      bids: normalizeBookLevels(summary?.bids, 'bid'),
      asks: normalizeBookLevels(summary?.asks, 'ask'),
    }
  }, [orderBookSummaryData, outcomeTokenId])
  const limitMatchingShares = useMemo(() => {
    if (!isLimitOrder) {
      return null
    }

    const limitPriceValue = Number.parseFloat(limitPrice || '0') || 0
    const limitSharesValue = Number.parseFloat(limitShares || '0') || 0
    if (limitPriceValue <= 0 || limitSharesValue <= 0) {
      return null
    }

    const levels = side === ORDER_SIDE.BUY ? normalizedOrderBook.asks : normalizedOrderBook.bids
    if (!levels.length) {
      return null
    }

    const availableShares = levels.reduce((total, level) => {
      if (side === ORDER_SIDE.BUY ? level.priceCents <= limitPriceValue : level.priceCents >= limitPriceValue) {
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
    limitPrice,
    limitShares,
    side,
  ])
  const marketSellFill = useMemo(() => {
    if (side !== ORDER_SIDE.SELL || isLimitOrder) {
      return null
    }

    return calculateMarketFill(
      ORDER_SIDE.SELL,
      amountNumber,
      normalizedOrderBook.bids,
      normalizedOrderBook.asks,
    )
  }, [amountNumber, isLimitOrder, normalizedOrderBook.asks, normalizedOrderBook.bids, side])
  const marketBuyFill = useMemo(() => {
    if (side !== ORDER_SIDE.BUY || isLimitOrder) {
      return null
    }

    return calculateMarketFill(
      ORDER_SIDE.BUY,
      amountNumber,
      normalizedOrderBook.bids,
      normalizedOrderBook.asks,
    )
  }, [amountNumber, isLimitOrder, normalizedOrderBook.asks, normalizedOrderBook.bids, side])
  const bestAskPriceCents = normalizedOrderBook.asks[0]?.priceCents ?? null
  const bestBidPriceCents = normalizedOrderBook.bids[0]?.priceCents ?? null
  const sellOrderSnapshot = useMemo(() => {
    if (side !== ORDER_SIDE.SELL) {
      return { shares: 0, priceCents: 0, totalValue: 0 }
    }

    const isLimit = type === ORDER_TYPE.LIMIT
    const sharesInput = isLimit
      ? Number.parseFloat(limitShares || '0') || 0
      : Number.parseFloat(amount || '0') || 0

    const limitPriceNumber = isLimit
      ? Number.parseFloat(limitPrice || '0') || 0
      : null

    if (isLimit) {
      const totalValue = sharesInput > 0 && limitPriceNumber && limitPriceNumber > 0 ? (sharesInput * limitPriceNumber) / 100 : 0
      return {
        shares: sharesInput,
        priceCents: limitPriceNumber ?? 0,
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
  }, [marketSellFill, amount, limitPrice, limitShares, side, type])
  const currentBuyPriceCents = (() => {
    if (isLimitOrder && side === ORDER_SIDE.BUY) {
      return Number.parseFloat(limitPrice || '0') || 0
    }

    if (!isLimitOrder && side === ORDER_SIDE.BUY) {
      return marketBuyFill?.avgPriceCents ?? null
    }

    return outcomeFallbackBuyPriceCents
  })()
  const buyPayoutSummary = useMemo(() => {
    if (side !== ORDER_SIDE.BUY) {
      return {
        payout: 0,
        cost: 0,
        profit: 0,
        changePct: 0,
        multiplier: 0,
      }
    }

    if (isLimitOrder) {
      const price = Number.parseFloat(limitPrice || '0') / 100
      const shares = Number.parseFloat(limitShares || '0') || 0
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
  }, [amountNumber, currentBuyPriceCents, isLimitOrder, marketBuyFill, limitPrice, limitShares, side])

  return {
    limitMatchingShares,
    marketSellFill,
    marketBuyFill,
    bestAskPriceCents,
    bestBidPriceCents,
    sellOrderSnapshot,
    currentBuyPriceCents,
    buyPayoutSummary,
  }
}

function resolveMarketOrderSlippageWarning({
  side,
  isLimitOrder,
  showSlippageWarning,
  marketBuyFill,
  marketSellFill,
  bestAskPriceCents,
  bestBidPriceCents,
}: {
  side: typeof ORDER_SIDE.BUY | typeof ORDER_SIDE.SELL
  isLimitOrder: boolean
  showSlippageWarning: boolean
  marketBuyFill: ReturnType<typeof calculateMarketFill> | null
  marketSellFill: ReturnType<typeof calculateMarketFill> | null
  bestAskPriceCents: number | null
  bestBidPriceCents: number | null
}): MarketOrderSlippageWarning | null {
  if (isLimitOrder || !showSlippageWarning) {
    return null
  }

  const fill = side === ORDER_SIDE.BUY ? marketBuyFill : marketSellFill
  const referencePriceCents = side === ORDER_SIDE.BUY ? bestAskPriceCents : bestBidPriceCents

  if (
    !fill
    || fill.avgPriceCents == null
    || fill.avgPriceCents <= 0
    || fill.filledShares <= 0
    || fill.totalCost <= 0
    || referencePriceCents == null
    || referencePriceCents <= 0
  ) {
    return null
  }

  const priceImpact = side === ORDER_SIDE.BUY
    ? (fill.avgPriceCents - referencePriceCents) / referencePriceCents
    : (referencePriceCents - fill.avgPriceCents) / referencePriceCents

  if (priceImpact <= PRICE_SLIPPAGE_WARNING_THRESHOLD) {
    return null
  }

  return {
    side,
    avgPriceCents: fill.avgPriceCents,
    filledShares: fill.filledShares,
    totalValue: fill.totalCost,
  }
}

function useClaimablePositions({
  activeMarket,
  isResolvedMarket,
  positionsQueryData,
  resolvedOutcomeIndex,
  resolvedOutcomeLabel,
  resolvedYesOutcomeLabel,
  resolvedNoOutcomeLabel,
  resolveDisplayOutcomeLabel,
  yesPositionShares,
  noPositionShares,
}: {
  activeMarket: Market | null | undefined
  isResolvedMarket: boolean
  positionsQueryData: UserPosition[] | undefined
  resolvedOutcomeIndex: number | null
  resolvedOutcomeLabel: string | null
  resolvedYesOutcomeLabel: string
  resolvedNoOutcomeLabel: string
  resolveDisplayOutcomeLabel: ResolveDisplayOutcomeLabel
  yesPositionShares: number
  noPositionShares: number
}) {
  const claimablePositionsForMarket = useMemo(() => {
    if (!isResolvedMarket || !activeMarket?.condition_id) {
      return []
    }

    const positions = positionsQueryData ?? []
    return positions.filter((position) => {
      if (!position.redeemable || position.market?.condition_id !== activeMarket?.condition_id) {
        return false
      }
      const shares = typeof position.total_shares === 'number' ? position.total_shares : 0
      return shares > 0
    })
  }, [activeMarket?.condition_id, isResolvedMarket, positionsQueryData])
  const claimableShares = useMemo(
    () =>
      claimablePositionsForMarket.reduce((sum, position) => {
        const shares = typeof position.total_shares === 'number' ? position.total_shares : 0
        return shares > 0 ? sum + shares : sum
      }, 0),
    [claimablePositionsForMarket],
  )
  const claimableNegRiskAmounts = useMemo(() => {
    return claimablePositionsForMarket.reduce(
      (amounts, position) => {
        const shares = typeof position.total_shares === 'number' ? position.total_shares : 0
        if (!(shares > 0)) {
          return amounts
        }

        if (position.outcome_index === OUTCOME_INDEX.YES) {
          amounts.yesShares += shares
        }
        else if (position.outcome_index === OUTCOME_INDEX.NO) {
          amounts.noShares += shares
        }

        return amounts
      },
      { yesShares: 0, noShares: 0 },
    )
  }, [claimablePositionsForMarket])
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
  const claimOutcomeLabel = useMemo(() => {
    const position = claimablePositionsForMarket.find(candidate => candidate.outcome_text || candidate.outcome_index != null)
    return resolveDisplayOutcomeLabel(
      typeof position?.outcome_index === 'number' ? position.outcome_index : resolvedOutcomeIndex,
      position?.outcome_text,
      resolvedOutcomeLabel ?? '',
    )
  }, [claimablePositionsForMarket, resolveDisplayOutcomeLabel, resolvedOutcomeIndex, resolvedOutcomeLabel])
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

  return {
    claimableShares,
    claimableNegRiskAmounts,
    claimIndexSets,
    claimPositionLabel,
    claimValuePerShareLabel,
    claimTotalLabel,
  }
}

function useOrderValidationFeedback() {
  const [showMarketMinimumWarning, setShowMarketMinimumWarning] = useState(false)
  const [showInsufficientSharesWarning, setShowInsufficientSharesWarning] = useState(false)
  const [showInsufficientBalanceWarning, setShowInsufficientBalanceWarning] = useState(false)
  const [showAmountTooLowWarning, setShowAmountTooLowWarning] = useState(false)
  const [showNoLiquidityWarning, setShowNoLiquidityWarning] = useState(false)
  const [showLimitMinimumWarning, setShowLimitMinimumWarning] = useState(false)
  const [shouldShakeInput, setShouldShakeInput] = useState(false)
  const [shouldShakeLimitShares, setShouldShakeLimitShares] = useState(false)

  function clearValidationWarnings() {
    setShowMarketMinimumWarning(false)
    setShowInsufficientSharesWarning(false)
    setShowInsufficientBalanceWarning(false)
    setShowAmountTooLowWarning(false)
    setShowNoLiquidityWarning(false)
  }

  function clearValidationFeedback() {
    clearValidationWarnings()
    setShouldShakeInput(false)
    setShouldShakeLimitShares(false)
  }

  return {
    showMarketMinimumWarning,
    setShowMarketMinimumWarning,
    showInsufficientSharesWarning,
    setShowInsufficientSharesWarning,
    showInsufficientBalanceWarning,
    setShowInsufficientBalanceWarning,
    showAmountTooLowWarning,
    setShowAmountTooLowWarning,
    showNoLiquidityWarning,
    setShowNoLiquidityWarning,
    showLimitMinimumWarning,
    setShowLimitMinimumWarning,
    shouldShakeInput,
    setShouldShakeInput,
    shouldShakeLimitShares,
    setShouldShakeLimitShares,
    clearValidationFeedback,
  }
}

export default function EventOrderPanelForm({
  event,
  isMobile,
  initialMarket = null,
  initialOutcome = null,
  className,
  desktopMarketInfo,
  stickyDesktopTabs = false,
  mobileMarketInfo,
  primaryOutcomeIndex = null,
  oddsFormat = 'price',
  outcomeButtonStyleVariant = 'default',
  outcomeLabelOverrides = {},
  outcomeAccentOverrides = {},
  optimisticallyClaimedConditionIds = {},
}: EventOrderPanelFormProps) {
  const { open } = useAppKit()
  const { isConnected } = useAppKitAccount()
  const { address: activeWalletAddress, connector: activeWalletConnector } = useAccount()
  const wagmiConfig = useConfig()
  const { signTypedDataAsync } = useSignTypedData()
  const { runWithSignaturePrompt } = useSignaturePromptRunner()
  const t = useExtracted()
  const site = useSiteIdentity()
  const arbitrageConfig = useArbitrageConfig()
  const locale = useLocale()
  const currentTimestamp = useCurrentTimestamp({ intervalMs: 60_000 })
  const normalizeOutcomeLabel = useOutcomeLabel()
  const affiliateMetadata = useAffiliateOrderMetadata()
  const builderCode = useMemo(
    () => addressToBuilderCode(affiliateMetadata.referrerAddress),
    [affiliateMetadata.referrerAddress],
  )
  const user = useUser()
  const addLocalOrderFillNotification = useNotifications(state => state.addLocalOrderFillNotification)
  const state = useOrder()
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
  const {
    showMarketMinimumWarning,
    setShowMarketMinimumWarning,
    showInsufficientSharesWarning,
    setShowInsufficientSharesWarning,
    showInsufficientBalanceWarning,
    setShowInsufficientBalanceWarning,
    showAmountTooLowWarning,
    setShowAmountTooLowWarning,
    showNoLiquidityWarning,
    setShowNoLiquidityWarning,
    showLimitMinimumWarning,
    setShowLimitMinimumWarning,
    shouldShakeInput,
    setShouldShakeInput,
    shouldShakeLimitShares,
    setShouldShakeLimitShares,
    clearValidationFeedback,
  } = useOrderValidationFeedback()
  const [isClaimSubmitting, setIsClaimSubmitting] = useState(false)
  const [isArbitrageSubmitting, setIsArbitrageSubmitting] = useState(false)
  const [arbitrageSubmissionStep, setArbitrageSubmissionStep] = useState<0 | 1 | 2 | 3>(0)
  const panelMode = useSyncExternalStore(
    subscribeOrderPanelMode,
    getOrderPanelModeSnapshot,
    getOrderPanelModeServerSnapshot,
  )
  const [slippageWarning, setSlippageWarning] = useState<MarketOrderSlippageWarning | null>(null)
  const [claimedConditionIdsByEvent, setClaimedConditionIdsByEvent] = useState<Record<string, Record<string, true>>>({})
  const hasMounted = useHasHydrated()
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
  const activeLiveYesPrice = hasMatchingStoreMarket ? liveYesPrice : null
  const activeLiveNoPrice = hasMatchingStoreMarket ? liveNoPrice : null
  const yesPrice = activeLiveYesPrice ?? resolveFallbackOutcomeUnitPrice(activeMarket, yesOutcome)
  const noPrice = activeLiveNoPrice ?? resolveFallbackOutcomeUnitPrice(activeMarket, noOutcome)
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
  const { ensureTradingReady, openTradeRequirements, promptAutoRedeem, startDepositFlow } = useTradingOnboarding()
  const hasDeployedDepositWallet = Boolean(user?.deposit_wallet_address && user?.deposit_wallet_status === 'deployed')
  const depositWalletAddress = hasDeployedDepositWallet ? normalizeAddress(user?.deposit_wallet_address) : null
  const userAddress = normalizeAddress(user?.address)
  const makerAddress = depositWalletAddress
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
  const isNegRiskMarket = typeof activeMarket?.neg_risk === 'boolean'
    ? activeMarket.neg_risk
    : Boolean(event.enable_neg_risk || event.neg_risk)
  const negRiskAdapterAddress = useMemo(
    () => resolveNegRiskAdapterAddressFromMetadata(activeMarket?.metadata, activeMarket?.condition?.oracle),
    [activeMarket?.condition?.oracle, activeMarket?.metadata],
  )

  const resolveDisplayOutcomeLabel = useCallback((
    outcomeIndex: number | null | undefined,
    outcomeText: string | null | undefined,
    fallbackLabel: string,
  ) => {
    const override = outcomeIndex == null
      ? ''
      : (outcomeLabelOverrides[outcomeIndex]?.trim() ?? '')
    if (override) {
      return override
    }

    const normalized = outcomeText ? normalizeOutcomeLabel(outcomeText) : ''
    return normalized || outcomeText || fallbackLabel
  }, [normalizeOutcomeLabel, outcomeLabelOverrides])
  const {
    isResolvedMarket,
    resolvedOutcomeIndex,
    resolvedOutcomeLabel,
    shouldShowResolvedSportsSubtitle,
    resolvedMarketTitle,
    resolvedYesOutcomeLabel,
    resolvedNoOutcomeLabel,
  } = useResolvedMarketDisplay({
    event,
    activeMarket,
    currentTimestamp,
    resolveDisplayOutcomeLabel,
  })
  const isPausedMarket = Boolean(activeMarket && activeMarket.accepting_orders === false && !isResolvedMarket)
  const isTradingDisabled = isResolvedMarket || isPausedMarket
  const orderDomain = useMemo(() => getExchangeEip712Domain(isNegRiskMarket), [isNegRiskMarket])
  const { positionsQuery, aggregatedPositionShares } = useEventOrderPanelPositions({
    makerAddress,
    conditionId: activeMarket?.condition_id,
  })

  const claimedConditionIds = claimedConditionIdsByEvent[event.id] ?? {}

  const availableBalanceForOrders = Math.max(0, balance.raw)
  const formattedBalanceText = Number.isFinite(balance.raw)
    ? balance.raw.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0.00'

  useUserSharesStoreSync({
    makerAddress,
    sharesByCondition,
    aggregatedPositionShares,
  })

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
  const availableMergeShares = Math.max(0, Math.min(availableYesTokenShares, availableNoTokenShares))
  const availableSplitBalance = Math.max(0, balance.raw)
  const outcomeIndex = activeOutcome?.outcome_index as typeof OUTCOME_INDEX.YES | typeof OUTCOME_INDEX.NO | undefined
  const selectedShares = outcomeIndex === undefined
    ? 0
    : outcomeIndex === OUTCOME_INDEX.YES
      ? availableYesTokenShares
      : availableNoTokenShares
  const selectedShareLabel = outcomeIndex === undefined
    ? undefined
    : resolveDisplayOutcomeLabel(
        outcomeIndex,
        activeOutcome?.outcome_text,
        outcomeIndex === OUTCOME_INDEX.NO ? t('No') : t('Yes'),
      )
  const {
    claimableShares,
    claimableNegRiskAmounts,
    claimIndexSets,
    claimPositionLabel,
    claimValuePerShareLabel,
    claimTotalLabel,
  } = useClaimablePositions({
    activeMarket,
    isResolvedMarket,
    positionsQueryData: positionsQuery.data,
    resolvedOutcomeIndex,
    resolvedOutcomeLabel,
    resolvedYesOutcomeLabel,
    resolvedNoOutcomeLabel,
    resolveDisplayOutcomeLabel,
    yesPositionShares,
    noPositionShares,
  })
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
  const selectedSubmitAccent = outcomeIndex === OUTCOME_INDEX.YES || outcomeIndex === OUTCOME_INDEX.NO
    ? (outcomeAccentOverrides[outcomeIndex] ?? null)
    : null
  const showArbitrage = Boolean(
    arbitrageConfig.data?.enabled
    && event.is_polymarket_mirror
    && activeMarket?.polymarket_condition_id
    && activeMarket.outcomes.filter(outcome => outcome.polymarket_token_id).length >= 2,
  )

  const resolvedPanelMode = showArbitrage ? panelMode : 'trade'

  useEffect(() => {
    document.documentElement.dataset.orderPanelMode = resolvedPanelMode
    window.dispatchEvent(new Event(ORDER_PANEL_MODE_CHANGE_EVENT))

    return () => {
      if (document.documentElement.dataset.orderPanelMode === resolvedPanelMode) {
        delete document.documentElement.dataset.orderPanelMode
        window.dispatchEvent(new Event(ORDER_PANEL_MODE_CHANGE_EVENT))
      }
    }
  }, [resolvedPanelMode])

  const outcomeFallbackBuyPriceCents = typeof activeOutcome?.buy_price === 'number'
    ? Number((activeOutcome.buy_price * 100).toFixed(1))
    : null

  const {
    limitMatchingShares,
    marketSellFill,
    marketBuyFill,
    bestAskPriceCents,
    bestBidPriceCents,
    sellOrderSnapshot,
    currentBuyPriceCents,
    buyPayoutSummary,
  } = useOrderBookComputations({
    outcomeTokenId,
    orderBookSummaryData: orderBookSummaryQuery.data,
    side: state.side,
    type: state.type,
    amount: state.amount,
    limitPrice: state.limitPrice,
    limitShares: state.limitShares,
    isLimitOrder,
    amountNumber,
    outcomeFallbackBuyPriceCents,
  })

  const sellAmountValue = state.side === ORDER_SIDE.SELL ? sellOrderSnapshot.totalValue : 0

  const avgSellPriceDollars = Number.isFinite(sellOrderSnapshot.priceCents)
    ? sellOrderSnapshot.priceCents / 100
    : null
  const avgSellPriceLabel = formatCentsLabel(avgSellPriceDollars, { fallback: '—' })

  const effectiveMarketBuyCost = state.side === ORDER_SIDE.BUY && state.type === ORDER_TYPE.MARKET
    ? (marketBuyFill?.totalCost ?? amountNumber)
    : 0
  const isInteractiveWalletReady = hasMounted && isConnected
  const shouldShowDepositCta = isInteractiveWalletReady
    && state.side === ORDER_SIDE.BUY
    && state.type === ORDER_TYPE.MARKET
    && Math.max(effectiveMarketBuyCost, amountNumber) > availableBalanceForOrders

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
  const sellAmountLabel = formatDollarValueLabel(sellAmountValue, { fallback: '0¢' })
  const feeBaseAmount = state.side === ORDER_SIDE.SELL
    ? sellAmountValue
    : effectiveMarketBuyCost > 0
      ? effectiveMarketBuyCost
      : amountNumber
  const showSlippageWarning = Boolean(user?.settings?.trading?.show_slippage_warning)

  const filledSharesForCurrentSide = state.side === ORDER_SIDE.BUY
    ? (marketBuyFill?.filledShares ?? 0)
    : (marketSellFill?.filledShares ?? 0)
  const shouldShowResolvedNoLiquidityWarning = showNoLiquidityWarning
    && !isLimitOrder
    && amountNumber > 0
    && filledSharesForCurrentSide <= 0
  const shouldShowResolvedMarketMinimumWarning = showMarketMinimumWarning
    && !isLimitOrder
    && state.side === ORDER_SIDE.BUY
    && amountNumber > 0
    && amountNumber < 1
  const shouldShowLimitMinimumWarning = showLimitMinimumWarning
    && isLimitOrder
    && limitSharesNumber < MIN_LIMIT_ORDER_SHARES

  function focusInput() {
    state.inputRef?.current?.focus()
  }

  function clearSlippageWarning() {
    setSlippageWarning(null)
  }

  function handleSideChange(nextSide: typeof state.side) {
    clearValidationFeedback()
    clearSlippageWarning()
    state.setSide(nextSide)
  }

  function handleAmountReset() {
    clearValidationFeedback()
    clearSlippageWarning()
    state.setAmount('')
  }

  function handleAmountChange(nextAmount: string) {
    clearValidationFeedback()
    clearSlippageWarning()
    state.setAmount(nextAmount)
  }

  function handleLimitPriceChange(nextLimitPrice: string) {
    clearValidationFeedback()
    clearSlippageWarning()
    state.setLimitPrice(nextLimitPrice)
  }

  function handleLimitSharesChange(nextLimitShares: string) {
    clearValidationFeedback()
    clearSlippageWarning()
    state.setLimitShares(nextLimitShares)
  }

  function triggerLimitSharesShake() {
    setShouldShakeLimitShares(true)
    limitSharesInputRef.current?.focus()
    setTimeout(setShouldShakeLimitShares, 320, false)
  }

  function triggerInputShake() {
    setShouldShakeInput(true)
    state.inputRef?.current?.focus()
    setTimeout(setShouldShakeInput, 320, false)
  }

  async function submitOrderFlow(options: { confirmedSlippageWarning?: boolean } = {}) {
    if (options.confirmedSlippageWarning) {
      clearSlippageWarning()
    }

    const orderExpirationTimestamp = resolveOrderExpirationTimestamp({
      limitExpirationOption: state.limitExpirationOption,
      limitExpirationTimestamp: state.limitExpirationTimestamp,
      nowMs: Date.now(),
    })
    const hasExpirationLimit = state.limitExpirationOption !== 'never'

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
      limitExpirationOption: state.limitExpirationOption,
      limitExpirationTimestamp: orderExpirationTimestamp,
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

    if (isNegRiskMarket && !isCurrentNegRiskAdapterAddress(negRiskAdapterAddress)) {
      handleOrderErrorFeedback(t('Trade unavailable'), t('This action is currently unavailable for this market.'))
      return
    }

    const nextSlippageWarning = resolveMarketOrderSlippageWarning({
      side: state.side,
      isLimitOrder,
      showSlippageWarning,
      marketBuyFill,
      marketSellFill,
      bestAskPriceCents,
      bestBidPriceCents,
    })

    if (nextSlippageWarning && !options.confirmedSlippageWarning) {
      setSlippageWarning(nextSlippageWarning)
      return
    }

    clearSlippageWarning()

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
      makerAddress,
      outcome: activeOutcome,
      side: state.side,
      orderType: state.type,
      amount: effectiveAmountForOrder,
      limitPrice: state.limitPrice,
      limitShares: state.limitShares,
      marketPriceCents: marketLimitPriceCents,
      builder: builderCode,
      expirationTimestamp: orderExpirationTimestamp ?? undefined,
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
    const submittedOutcomeText = resolveDisplayOutcomeLabel(
      activeOutcome.outcome_index,
      activeOutcome.outcome_text,
      activeOutcome.outcome_text,
    )
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
        clobOrderType: state.type === ORDER_TYPE.LIMIT && hasExpirationLimit
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

      scheduleOrderBookRefresh(queryClient)

      if (user?.settings?.notifications?.inapp_order_fills) {
        const isSell = submittedSide === ORDER_SIDE.SELL
        const buyAmountLabel = formatDollarValueLabel(submittedBuyAmountValue, { fallback: '0¢' })
        const sellAmountNotificationLabel = formatDollarValueLabel(submittedSellAmountValue, { fallback: '0¢' })
        const priceLabel = formatCentsValueLabel(submittedBuyPriceCents, { fallback: '—' })
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
            ? `${eventContextLabel} • ${amountPrefix} ${sellAmountNotificationLabel} @ ${submittedAvgSellPriceLabel}`
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
          type: hasExpirationLimit ? CLOB_ORDER_TYPE.GTD : CLOB_ORDER_TYPE.GTC,
          price: limitPriceValue,
          shares: limitSharesValue,
          totalValue,
          expiration: hasExpirationLimit ? Number(payload.expiration) : null,
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

      void queryClient.invalidateQueries({ queryKey: [DEPOSIT_WALLET_BALANCE_QUERY_KEY] })

      setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: [DEPOSIT_WALLET_BALANCE_QUERY_KEY] })
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

  async function onSubmit() {
    await submitOrderFlow()
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

    if (!user?.deposit_wallet_address || !user?.address) {
      toast.error(t('Set up your Deposit Wallet before claiming.'))
      return
    }

    if (isNegRiskMarket && !isCurrentNegRiskAdapterAddress(negRiskAdapterAddress)) {
      toast.error(t('This action is currently unavailable for this market.'))
      return
    }

    setIsClaimSubmitting(true)

    try {
      const call = isNegRiskMarket
        ? buildNegRiskRedeemPositionCall({
            conditionId: conditionId as `0x${string}`,
            yesAmount: claimableNegRiskAmounts.yesShares,
            noAmount: claimableNegRiskAmounts.noShares,
            contract: negRiskAdapterAddress ?? undefined,
          })
        : buildRedeemPositionCall({
            conditionId: conditionId as `0x${string}`,
            indexSets: claimIndexSets,
          })
      const response = await runWithSignaturePrompt(() => signAndSubmitDepositWalletCalls({
        user,
        calls: [call],
        metadata: 'redeem_positions',
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

      toast.success(t('Claim submitted'), {
        description: t('We sent your claim transaction.'),
      })
      promptAutoRedeem()
      setClaimedConditionIdsByEvent((current) => {
        const currentEventClaims = current[event.id] ?? {}
        if (currentEventClaims[conditionId]) {
          return current
        }

        return {
          ...current,
          [event.id]: {
            ...currentEventClaims,
            [conditionId]: true,
          },
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

      void queryClient.invalidateQueries({ queryKey: [DEPOSIT_WALLET_BALANCE_QUERY_KEY] })
      setTimeout(() => {
        invalidateTradingClaimQueries(queryClient)
      }, 4_000)
      setTimeout(() => {
        invalidateTradingClaimQueries(queryClient)
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
  const submitButtonLabel = useMemo(() => {
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
  }, [isInteractiveWalletReady, selectedShareLabel, shouldShowDepositCta, state.side, t])

  function handleTypeChange(nextType: typeof state.type) {
    clearValidationFeedback()
    clearSlippageWarning()
    setShowLimitMinimumWarning(false)
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

  function handleOutcomeSelect(nextOutcome: Outcome | null | undefined) {
    if (!activeMarket || !nextOutcome) {
      return
    }

    clearValidationFeedback()
    clearSlippageWarning()

    if (!state.market) {
      state.setMarket(activeMarket)
    }

    state.setOutcome(nextOutcome)
    focusInput()
  }

  const shouldStickDesktopTabs = !isMobile && stickyDesktopTabs

  async function handleArbitrageSubmit(quote: ArbitrageQuote, polymarketMinimumOrderSize: number) {
    if (!ensureTradingReady() || !activeMarket || !makerAddress || !userAddress) {
      return
    }
    if (!(quote.totalCost > 0) || !(quote.shares > 0)) {
      toast.error(t('Enter a valid amount.'))
      return
    }
    const kuestPrincipal = quote.segments.reduce(
      (total, segment) => total + segment.shares * segment.kuestPrice,
      0,
    )
    if (
      quote.shares < Math.max(MIN_LIMIT_ORDER_SHARES, polymarketMinimumOrderSize)
      || kuestPrincipal < MIN_MARKET_BUY_AMOUNT
      || (quote.polymarketOrder?.maximumCost ?? 0) < POLYMARKET_MIN_MARKETABLE_BUY_AMOUNT
    ) {
      toast.error(t('The matched amount is below the minimum order size.'))
      return
    }
    const polymarketWallet = usePolymarketWallet.getState()
    const polymarketOwner = normalizeAddress(polymarketWallet.ownerAddress)
    const polymarketFunder = normalizeAddress(polymarketWallet.funderAddress)
    const polymarketConnectorId = polymarketWallet.connectorId
    const polymarketConnectorUid = polymarketWallet.connectorUid
    const normalizedActiveWalletAddress = normalizeAddress(activeWalletAddress)
    if (
      !activeWalletConnector
      || !normalizedActiveWalletAddress
      || normalizedActiveWalletAddress.toLowerCase() !== userAddress.toLowerCase()
    ) {
      toast.error(t('Wallet connection is not ready. Please try again.'))
      void open()
      return
    }
    const siteConnection = selectPolymarketConnection(getConnections(wagmiConfig), {
      ownerAddress: userAddress,
      connectorId: activeWalletConnector.id,
      connectorUid: activeWalletConnector.uid,
    })
    const kuestOutcomeIndex = quote.kuestOutcome === 'YES' ? OUTCOME_INDEX.YES : OUTCOME_INDEX.NO
    const kuestOutcome = activeMarket.outcomes.find(outcome => outcome.outcome_index === kuestOutcomeIndex)
    const polymarketOutcomeIndex = quote.polymarketOutcome === 'YES' ? OUTCOME_INDEX.YES : OUTCOME_INDEX.NO
    const polymarketOutcome = activeMarket.outcomes.find(
      outcome => outcome.outcome_index === polymarketOutcomeIndex,
    )
    const lastSegment = quote.segments.at(-1)
    const polymarketOrder = quote.polymarketOrder
    if (
      !polymarketOwner
      || !polymarketFunder
      || !polymarketConnectorId
      || !polymarketConnectorUid
      || !siteConnection
      || !kuestOutcome
      || !polymarketOutcome
      || !lastSegment
      || !polymarketOrder
    ) {
      toast.error(t('The arbitrage order could not be prepared.'))
      return
    }
    const kuestMaximumCost = lastSegment.kuestPrice * quote.shares

    setIsArbitrageSubmitting(true)
    setArbitrageSubmissionStep(1)
    try {
      const siteConnectionChainId = await siteConnection.connector.getChainId()
      if (siteConnectionChainId !== DEFAULT_CHAIN_ID) {
        await switchChain(wagmiConfig, {
          chainId: DEFAULT_CHAIN_ID,
          connector: siteConnection.connector,
        })
      }

      const kuestOrder = buildOrderPayload({
        makerAddress,
        outcome: kuestOutcome,
        side: ORDER_SIDE.BUY,
        orderType: ORDER_TYPE.MARKET,
        amount: kuestMaximumCost.toString(),
        limitPrice: '',
        limitShares: '',
        marketPriceCents: lastSegment.kuestPrice * 100,
        marketMinimumShares: quote.shares,
        builder: builderCode,
      })
      const kuestSignature = await runWithSignaturePrompt(
        () => signOrderPayload({
          payload: kuestOrder,
          domain: orderDomain,
          signTypedDataAsync: parameters => signTypedDataAction(wagmiConfig, {
            ...parameters,
            account: userAddress,
            connector: siteConnection.connector,
          }),
        }),
        { title: t('Sign {siteName} order · 1/2', { siteName: site.name }) },
      )

      setArbitrageSubmissionStep(2)
      const preparedPolymarketOrder = await runWithSignaturePrompt(
        () => preparePolymarketOrder({
          wagmiConfig,
          ownerAddress: polymarketOwner,
          funderAddress: polymarketFunder,
          signatureType: polymarketWallet.signatureType,
          connectorId: polymarketConnectorId,
          connectorUid: polymarketConnectorUid,
          tokenId: quote.polymarketTokenId,
          price: polymarketOrder.price,
          shares: polymarketOrder.shares,
          tickSize: polymarketOrder.tickSize,
        }),
        { title: t('Sign Polymarket order · 2/2') },
      )

      setArbitrageSubmissionStep(3)
      const [kuestResult, polymarketResult] = await Promise.allSettled([
        submitOrder({
          order: kuestOrder,
          signature: kuestSignature,
          orderType: ORDER_TYPE.MARKET,
          clobOrderType: CLOB_ORDER_TYPE.FOK,
          conditionId: activeMarket.condition_id,
          slug: event.slug,
        }),
        preparedPolymarketOrder.post(),
      ])
      const kuestError = kuestResult.status === 'rejected'
        ? kuestResult.reason
        : kuestResult.value?.error
      const polymarketError = polymarketResult.status === 'rejected'
        ? polymarketResult.reason
        : polymarketResult.value?.success === false
          ? polymarketResult.value?.errorMsg || 'Polymarket rejected the order.'
          : null

      scheduleOrderBookRefresh(queryClient)
      void queryClient.invalidateQueries({ queryKey: ['polymarket-order-books'] })
      if (!kuestError) {
        invalidateTradingClaimQueries(queryClient)
      }
      if (kuestError || polymarketError) {
        console.error('Arbitrage submission completed with an unmatched leg.', { kuestError, polymarketError })
        const errorDescription = getArbitrageSubmissionErrorMessage(kuestError || polymarketError)
        if (kuestError && polymarketError) {
          toast.error(t('Both orders failed. No trade was completed.'), { description: errorDescription })
        }
        else if (kuestError) {
          toast.error(t('The {siteName} order failed. Check Polymarket before trying again.', {
            siteName: site.name,
          }), { description: errorDescription })
        }
        else {
          toast.error(t('The Polymarket order failed. Check {siteName} before trying again.', {
            siteName: site.name,
          }), { description: errorDescription })
        }
        return
      }

      const sharesLabel = formatSharesLabel(quote.shares, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      })
      toast.success(t('Arbitrage matched! {shares} shares per side', { shares: sharesLabel }), {
        description: (
          <EventTradeToast
            title={event.title}
            marketImage={activeMarket.icon_url}
            marketTitle={activeMarket.short_title || activeMarket.title}
          >
            <div className="grid gap-0.5">
              <div>
                <span className="font-semibold text-primary">{site.name}</span>
                {' · '}
                {sharesLabel}
                {' '}
                {kuestOutcome.outcome_text}
              </div>
              <div>
                <span className="font-semibold text-[#2E5CFF]">Polymarket</span>
                {' · '}
                {sharesLabel}
                {' '}
                {polymarketOutcome.outcome_text}
              </div>
            </div>
          </EventTradeToast>
        ),
      })
      triggerConfetti('primary')
    }
    catch (error) {
      console.error('Failed to sign arbitrage orders.', error)
      if (isUserRejectedRequestError(error)) {
        toast.info(t('Order signing was cancelled.'))
      }
      else if (error instanceof PolymarketAuthenticationError) {
        toast.error(t('Polymarket authentication failed. Please sign again and try once more.'))
      }
      else {
        toast.error(t('We could not prepare both orders. Please try again.'))
      }
    }
    finally {
      setArbitrageSubmissionStep(0)
      setIsArbitrageSubmitting(false)
    }
  }

  function handlePanelModeChange(nextMode: 'trade' | 'arbitrage') {
    persistOrderPanelModeCookie(nextMode)
  }

  return (
    <Form
      action={onSubmit}
      id="event-order-form"
      className={cn(
        {
          'rounded-xl border lg:w-85': !isMobile,
        },
        'relative grid w-full grid-cols-[minmax(0,1fr)] lg:shadow-xl/5',
        stickyDesktopTabs ? 'overflow-visible' : 'overflow-hidden',
        className,
      )}
    >
      <div className="col-start-1 row-start-1 min-w-0 p-4">
        {!isTradingDisabled && !isMobile && (
          desktopMarketInfo ?? (!isSingleMarket ? <EventOrderPanelMarketInfo market={activeMarket} /> : null)
        )}
        {!isTradingDisabled && isMobile && (
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
        {isTradingDisabled
          ? (
              <EventOrderPanelResolvedMarketDisplay
                variant={isPausedMarket ? 'paused' : 'resolved'}
                resolvedOutcomeLabel={resolvedOutcomeLabel}
                isSingleMarket={isSingleMarket}
                shouldShowResolvedSportsSubtitle={shouldShowResolvedSportsSubtitle}
                resolvedMarketTitle={resolvedMarketTitle}
                hasClaimableWinnings={hasClaimableWinnings}
                claimPositionLabel={claimPositionLabel}
                claimValuePerShareLabel={claimValuePerShareLabel}
                claimTotalLabel={claimTotalLabel}
                isClaimSubmitting={isClaimSubmitting}
                isPositionsLoading={positionsQuery.isLoading}
                onClaimWinnings={handleClaimWinnings}
              />
            )
          : (
              <>
                <EventOrderPanelBuySellTabs
                  className={cn(
                    shouldStickDesktopTabs && 'sticky top-0 z-10 bg-card',
                  )}
                  edgeToEdge={shouldStickDesktopTabs}
                  mode={resolvedPanelMode}
                  showArbitrage={showArbitrage}
                  side={state.side}
                  type={state.type}
                  availableMergeShares={availableMergeShares}
                  availableSplitBalance={availableSplitBalance}
                  eventId={event.id}
                  eventSlug={event.slug}
                  isNegRiskMarket={isNegRiskMarket}
                  negRiskAdapterAddress={negRiskAdapterAddress}
                  conditionId={activeMarket?.condition_id}
                  marketSlug={activeMarket?.slug}
                  eventPath={resolveEventPagePath(event)}
                  marketTitle={activeMarket?.title || activeMarket?.short_title}
                  marketIconUrl={activeMarket?.icon_url}
                  onSideChange={handleSideChange}
                  onTypeChange={handleTypeChange}
                  onModeChange={handlePanelModeChange}
                  onAmountReset={handleAmountReset}
                  onFocusInput={focusInput}
                />

                {resolvedPanelMode === 'arbitrage' && activeMarket
                  ? (
                      <EventOrderPanelArbitrage
                        market={activeMarket}
                        multiWalletEnabled={arbitrageConfig.data?.multiWalletEnabled === true}
                        siteWalletReady={Boolean(isInteractiveWalletReady && makerAddress && userAddress)}
                        kuestBalance={availableBalanceForOrders}
                        kuestFeeBps={affiliateMetadata.builderTakerFeeBps}
                        isSubmitting={isArbitrageSubmitting}
                        submissionStep={arbitrageSubmissionStep}
                        onRequireSiteWallet={() => {
                          if (!isInteractiveWalletReady) {
                            void open()
                            return
                          }
                          openTradeRequirements({ forceTradingAuth: true })
                        }}
                        onSubmit={(quote, minimumOrderSize) => void handleArbitrageSubmit(quote, minimumOrderSize)}
                      />
                    )
                  : (
                      <>
                        <EventOrderPanelOutcomeSelector
                          primaryPrice={primaryPrice}
                          secondaryPrice={secondaryPrice}
                          primaryLabel={resolveDisplayOutcomeLabel(
                            normalizedPrimaryOutcomeIndex,
                            primaryOutcome?.outcome_text,
                            t('Yes'),
                          )}
                          secondaryLabel={resolveDisplayOutcomeLabel(
                            normalizedSecondaryOutcomeIndex,
                            secondaryOutcome?.outcome_text,
                            t('No'),
                          )}
                          primaryIsSelected={activeOutcome?.outcome_index === normalizedPrimaryOutcomeIndex}
                          secondaryIsSelected={activeOutcome?.outcome_index === normalizedSecondaryOutcomeIndex}
                          oddsFormat={oddsFormat}
                          styleVariant={outcomeButtonStyleVariant}
                          primarySelectedAccent={outcomeAccentOverrides[normalizedPrimaryOutcomeIndex] ?? null}
                          secondarySelectedAccent={outcomeAccentOverrides[normalizedSecondaryOutcomeIndex] ?? null}
                          onSelectPrimary={() => handleOutcomeSelect(primaryOutcome)}
                          onSelectSecondary={() => handleOutcomeSelect(secondaryOutcome)}
                        />

                        <EventOrderPanelOrderInput
                          isMobile={isMobile}
                          side={state.side}
                          isLimitOrder={isLimitOrder}
                          amount={state.amount}
                          amountNumber={amountNumber}
                          availableShares={selectedShares}
                          availableYesTokenShares={availableYesTokenShares}
                          availableNoTokenShares={availableNoTokenShares}
                          availableYesPositionShares={availableYesPositionShares}
                          availableNoPositionShares={availableNoPositionShares}
                          outcomeIndex={outcomeIndex}
                          balance={balance}
                          isBalanceLoading={isLoadingBalance}
                          inputRef={state.inputRef}
                          shouldShakeInput={shouldShakeInput}
                          shouldShowEarnings={shouldShowEarnings}
                          sellAmountLabel={sellAmountLabel}
                          avgSellPriceLabel={avgSellPriceLabel}
                          avgBuyPriceLabel={avgBuyPriceLabel}
                          avgSellPriceCentsValue={avgSellPriceCentsValue}
                          avgBuyPriceCentsValue={avgBuyPriceCentsValue}
                          buyPayoutSummary={buyPayoutSummary}
                          outcomeTokenId={outcomeTokenId}
                          operatorFeeBps={affiliateMetadata.builderTakerFeeBps}
                          feeBaseAmount={feeBaseAmount}
                          shouldShowResolvedMarketMinimumWarning={shouldShowResolvedMarketMinimumWarning}
                          shouldShowResolvedNoLiquidityWarning={shouldShowResolvedNoLiquidityWarning}
                          showInsufficientSharesWarning={showInsufficientSharesWarning}
                          showInsufficientBalanceWarning={showInsufficientBalanceWarning}
                          showAmountTooLowWarning={showAmountTooLowWarning}
                          limitPrice={state.limitPrice}
                          limitShares={state.limitShares}
                          limitExpirationOption={state.limitExpirationOption}
                          limitExpirationTimestamp={state.limitExpirationTimestamp}
                          limitMatchingShares={limitMatchingShares}
                          shouldShowLimitMinimumWarning={shouldShowLimitMinimumWarning}
                          shouldShakeLimitShares={shouldShakeLimitShares}
                          limitSharesRef={limitSharesInputRef}
                          onAmountChange={handleAmountChange}
                          onLimitPriceChange={handleLimitPriceChange}
                          onLimitSharesChange={handleLimitSharesChange}
                          onLimitExpirationOptionChange={state.setLimitExpirationOption}
                          onLimitExpirationTimestampChange={state.setLimitExpirationTimestamp}
                          onAmountUpdateFromLimit={state.setAmount}
                          isInteractiveWalletReady={isInteractiveWalletReady}
                          shouldShowDepositCta={shouldShowDepositCta}
                          isLoading={state.isLoading}
                          selectedSubmitAccent={selectedSubmitAccent}
                          outcomeButtonStyleVariant={outcomeButtonStyleVariant}
                          submitButtonLabel={submitButtonLabel}
                          onSubmitButtonClick={(event) => {
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
                        />
                      </>
                    )}
              </>
            )}
      </div>
      {slippageWarning && (
        <EventOrderPanelSlippageOverlay
          side={slippageWarning.side}
          avgPriceCents={slippageWarning.avgPriceCents}
          filledShares={slippageWarning.filledShares}
          totalValue={slippageWarning.totalValue}
          isSubmitting={state.isLoading}
          onConfirm={() => {
            void submitOrderFlow({ confirmedSlippageWarning: true })
          }}
          onEdit={() => {
            clearSlippageWarning()
            focusInput()
          }}
        />
      )}
    </Form>
  )
}
