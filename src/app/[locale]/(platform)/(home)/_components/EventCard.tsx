'use client'

import type { Market, Outcome } from '@/types'
import type { EventCardProps, SelectedOutcome } from '@/types/EventCardTypes'
import { useAppKitAccount } from '@reown/appkit/react'
import { useQueryClient } from '@tanstack/react-query'
import { use, useMemo, useState } from 'react'
import { useSignTypedData } from 'wagmi'
import EventCardFooter from '@/app/[locale]/(platform)/(home)/_components/EventCardFooter'
import EventCardHeader from '@/app/[locale]/(platform)/(home)/_components/EventCardHeader'
import EventCardMarketsList from '@/app/[locale]/(platform)/(home)/_components/EventCardMarketsList'
import EventCardSingleMarketActions from '@/app/[locale]/(platform)/(home)/_components/EventCardSingleMarketActions'
import EventCardTradePanel from '@/app/[locale]/(platform)/(home)/_components/EventCardTradePanel'
import { OpenCardContext } from '@/app/[locale]/(platform)/(home)/_components/EventOpenCardProvider'
import { useTradingOnboarding } from '@/app/[locale]/(platform)/_providers/TradingOnboardingProvider'
import { handleOrderCancelledFeedback, handleOrderErrorFeedback, handleOrderSuccessFeedback, handleValidationError } from '@/app/[locale]/(platform)/event/[slug]/_components/feedback'
import { Card, CardContent } from '@/components/ui/card'
import { useAffiliateOrderMetadata } from '@/hooks/useAffiliateOrderMetadata'
import { useAppKit } from '@/hooks/useAppKit'
import { useBalance } from '@/hooks/useBalance'
import { useEventCardOrderBook } from '@/hooks/useEventCardOrderBook'
import { useOutcomeLabel } from '@/hooks/useOutcomeLabel'
import { useSignaturePromptRunner } from '@/hooks/useSignaturePromptRunner'
import { formatDisplayAmount } from '@/lib/amount-input'
import { getExchangeEip712Domain, ORDER_SIDE, ORDER_TYPE } from '@/lib/constants'
import { calculateMarketFill } from '@/lib/event-card-orderbook'
import { shouldShowEventNewBadge } from '@/lib/event-new-badge'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { buildChanceByMarket } from '@/lib/market-chance'
import { buildOrderPayload, submitOrder } from '@/lib/orders'
import { signOrderPayload } from '@/lib/orders/signing'
import { validateOrder } from '@/lib/orders/validation'
import { cn } from '@/lib/utils'
import { isUserRejectedRequestError, normalizeAddress } from '@/lib/wallet'
import { useUser } from '@/stores/useUser'

const EMPTY_PRICE_OVERRIDES: Record<string, number> = {}

export default function EventCard({ event, priceOverridesByMarket = EMPTY_PRICE_OVERRIDES }: EventCardProps) {
  const { openCardId, setOpenCardId } = use(OpenCardContext)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedOutcome, setSelectedOutcome] = useState<SelectedOutcome | null>(null)
  const [tradeAmount, setTradeAmount] = useState('1')
  const [lastMouseEvent, setLastMouseEvent] = useState<MouseEvent | null>(null)
  const { open } = useAppKit()
  const { isConnected } = useAppKitAccount()
  const { signTypedDataAsync } = useSignTypedData()
  const { runWithSignaturePrompt } = useSignaturePromptRunner()
  const user = useUser()
  const affiliateMetadata = useAffiliateOrderMetadata()
  const { balance } = useBalance()
  const { ensureTradingReady } = useTradingOnboarding()
  const queryClient = useQueryClient()
  const normalizeOutcomeLabel = useOutcomeLabel()
  const hasDeployedProxyWallet = Boolean(user?.proxy_wallet_address && user?.proxy_wallet_status === 'deployed')
  const proxyWalletAddress = hasDeployedProxyWallet ? normalizeAddress(user?.proxy_wallet_address) : null
  const userAddress = normalizeAddress(user?.address)
  const makerAddress = proxyWalletAddress ?? null
  const signatureType = proxyWalletAddress ? 2 : 0
  const isOpen = openCardId === `${event.id}`
  const amountNumber = Number.parseFloat(tradeAmount) || 0
  const canValidateBalance = Boolean(isConnected && user)

  function onToggle() {
    setOpenCardId(isOpen ? null : `${event.id}`)
  }

  const activeOutcome = isOpen ? selectedOutcome : null
  const isInTradingMode = Boolean(activeOutcome)
  const isSingleMarket = event.markets.length === 1
  const yesOutcome = event.markets[0].outcomes[0]
  const noOutcome = event.markets[0].outcomes[1]
  const isResolvedEvent = event.status === 'resolved'
  const shouldShowNewBadge = shouldShowEventNewBadge(event)
  const shouldShowLiveBadge = !isResolvedEvent && Boolean(event.has_live_chart)
  const isNegRiskEnabled = Boolean(event.enable_neg_risk)
  const orderDomain = useMemo(() => getExchangeEip712Domain(isNegRiskEnabled), [isNegRiskEnabled])
  const availableBalance = balance.raw
  const selectedTokenId = selectedOutcome?.outcome.token_id ?? null

  const chanceByMarket = useMemo(
    () => buildChanceByMarket(event.markets, priceOverridesByMarket),
    [event.markets, priceOverridesByMarket],
  )

  function getDisplayChance(marketId: string) {
    return chanceByMarket[marketId] ?? 0
  }

  const primaryMarket = event.markets[0]
  const primaryDisplayChance = primaryMarket ? getDisplayChance(primaryMarket.condition_id) : 0
  const roundedPrimaryDisplayChance = Math.round(primaryDisplayChance)
  const endedLabel = useMemo(() => {
    if (!isResolvedEvent || !isSingleMarket) {
      return null
    }
    const endedAt = event.resolved_at ?? null
    if (!endedAt) {
      return null
    }
    const resolvedDate = new Date(endedAt)
    if (Number.isNaN(resolvedDate.getTime())) {
      return null
    }
    return `Ended ${formatDate(resolvedDate)}`
  }, [event.resolved_at, isResolvedEvent, isSingleMarket])

  const resolvedVolume = useMemo(() => event.volume ?? 0, [event.volume])

  const { normalizedAsks } = useEventCardOrderBook(selectedTokenId, isInTradingMode)

  const marketBuyFill = useMemo(() => {
    if (!isInTradingMode || !selectedOutcome || amountNumber <= 0) {
      return null
    }
    return calculateMarketFill(amountNumber, normalizedAsks)
  }, [amountNumber, isInTradingMode, normalizedAsks, selectedOutcome])

  const toWinAmount = useMemo(() => {
    if (!selectedOutcome || amountNumber <= 0) {
      return 0
    }

    if (marketBuyFill?.filledShares && marketBuyFill.filledShares > 0) {
      return marketBuyFill.filledShares
    }

    const fallbackPrice = typeof selectedOutcome.outcome.buy_price === 'number'
      ? selectedOutcome.outcome.buy_price
      : selectedOutcome.market?.probability
        ? selectedOutcome.market.probability / 100
        : 0

    return fallbackPrice > 0 ? amountNumber / fallbackPrice : 0
  }, [amountNumber, marketBuyFill?.filledShares, selectedOutcome])

  const toWinLabel = useMemo(
    () => formatCurrency(Math.max(0, toWinAmount), { includeSymbol: false }),
    [toWinAmount],
  )

  function handleTrade(outcome: Outcome, market: Market, variant: 'yes' | 'no') {
    setSelectedOutcome({
      market,
      outcome,
      variant,
    })

    if (!tradeAmount) {
      setTradeAmount('1')
    }
  }

  async function handleConfirmTrade() {
    if (!selectedOutcome) {
      return
    }

    if (!ensureTradingReady()) {
      return
    }

    const validation = validateOrder({
      isLoading,
      isConnected,
      user,
      market: selectedOutcome.market,
      outcome: selectedOutcome.outcome,
      amountNumber,
      side: ORDER_SIDE.BUY,
      isLimitOrder: false,
      limitPrice: '0',
      limitShares: '0',
      availableBalance: balance.raw,
    })

    if (!validation.ok) {
      handleValidationError(validation.reason, { openWalletModal: open })
      return
    }

    if (!user || !userAddress || !makerAddress) {
      return
    }

    const payload = buildOrderPayload({
      userAddress,
      makerAddress,
      signatureType,
      outcome: selectedOutcome.outcome,
      side: ORDER_SIDE.BUY,
      orderType: ORDER_TYPE.MARKET,
      amount: tradeAmount,
      limitPrice: '0',
      limitShares: '0',
      marketPriceCents: typeof selectedOutcome.outcome.buy_price === 'number'
        ? selectedOutcome.outcome.buy_price * 100
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

      handleOrderErrorFeedback('Trade failed', 'We could not sign your order. Please try again.')
      return
    }

    setIsLoading(true)
    try {
      const result = await submitOrder({
        order: payload,
        signature,
        orderType: ORDER_TYPE.MARKET,
        conditionId: selectedOutcome.market.condition_id,
        slug: event.slug,
      })

      if (result?.error) {
        handleOrderErrorFeedback('Trade failed', result.error)
        return
      }

      handleOrderSuccessFeedback({
        side: ORDER_SIDE.BUY,
        amountInput: tradeAmount,
        outcomeText: normalizeOutcomeLabel(selectedOutcome.outcome.outcome_text) ?? selectedOutcome.outcome.outcome_text,
        eventTitle: event.title,
        marketImage: selectedOutcome.market.icon_url,
        marketTitle: selectedOutcome.market.short_title || selectedOutcome.market.title,
        sellAmountValue: 0,
        avgSellPrice: '—',
        buyPrice: selectedOutcome.outcome.buy_price,
        queryClient,
        outcomeIndex: selectedOutcome.outcome.outcome_index,
        lastMouseEvent,
      })

      setSelectedOutcome(null)
      setTradeAmount('1')
      setLastMouseEvent(null)

      setTimeout(() => {
        void queryClient.refetchQueries({ queryKey: ['event-activity'] })
        void queryClient.refetchQueries({ queryKey: ['event-holders'] })
      }, 3000)
    }
    catch {
      handleOrderErrorFeedback('Trade failed', 'An unexpected error occurred. Please try again.')
    }
    finally {
      setIsLoading(false)
    }
  }

  function handleCancelTrade() {
    setSelectedOutcome(null)
    setTradeAmount('1')
    setLastMouseEvent(null)
    onToggle()
  }

  const formattedTradeAmount = formatDisplayAmount(tradeAmount)

  return (
    <Card
      className={
        cn(`
          group flex h-45 cursor-pointer flex-col overflow-hidden rounded-xl shadow-md shadow-black/4 transition-all
          hover:-translate-y-0.5 hover:bg-(--card-hover) hover:shadow-black/8
        `, { 'ring-2 ring-primary/20': isInTradingMode })
      }
    >
      <CardContent
        className={
          cn(`
            flex h-full flex-col px-3 pt-3
            ${isResolvedEvent ? 'pb-3' : 'pb-3 md:pb-1'}
          `)
        }
      >
        <EventCardHeader
          event={event}
          activeOutcome={activeOutcome}
          isInTradingMode={isInTradingMode}
          isSingleMarket={isSingleMarket}
          roundedPrimaryDisplayChance={roundedPrimaryDisplayChance}
          onCancelTrade={handleCancelTrade}
        />

        <div className="flex flex-1 flex-col">
          {activeOutcome
            ? (
                <EventCardTradePanel
                  activeOutcome={activeOutcome}
                  formattedTradeAmount={formattedTradeAmount}
                  amountNumber={amountNumber}
                  availableBalance={availableBalance}
                  isLoading={isLoading}
                  canValidateBalance={canValidateBalance}
                  isSingleMarket={isSingleMarket}
                  toWinLabel={toWinLabel}
                  onAmountChange={setTradeAmount}
                  onConfirmTrade={(mouseEvent) => {
                    if (mouseEvent) {
                      setLastMouseEvent(mouseEvent)
                    }
                    void handleConfirmTrade()
                  }}
                  onCancelTrade={handleCancelTrade}
                />
              )
            : (
                <div
                  className={
                    cn(isResolvedEvent && isSingleMarket
                      ? 'mt-6'
                      : isResolvedEvent && !isSingleMarket
                        ? 'mt-1'
                        : 'mt-auto')
                  }
                >
                  {!isSingleMarket && (
                    <EventCardMarketsList
                      event={event}
                      isResolvedEvent={isResolvedEvent}
                      getDisplayChance={getDisplayChance}
                      onTrade={handleTrade}
                      onToggle={onToggle}
                    />
                  )}

                  {isSingleMarket && yesOutcome && noOutcome && (
                    <EventCardSingleMarketActions
                      yesOutcome={yesOutcome}
                      noOutcome={noOutcome}
                      primaryMarket={primaryMarket}
                      isLoading={isLoading}
                      isResolvedEvent={isResolvedEvent}
                      onTrade={handleTrade}
                      onToggle={onToggle}
                    />
                  )}
                </div>
              )}
        </div>

        <EventCardFooter
          event={event}
          shouldShowNewBadge={shouldShowNewBadge}
          showLiveBadge={shouldShowLiveBadge}
          resolvedVolume={resolvedVolume}
          isInTradingMode={isInTradingMode}
          endedLabel={endedLabel}
        />
      </CardContent>
    </Card>
  )
}
