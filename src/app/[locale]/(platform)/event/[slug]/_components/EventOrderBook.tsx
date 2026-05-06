'use client'

import type { InfiniteData } from '@tanstack/react-query'
import type { EventOrderBookProps, OrderBookLevel, OrderBookUserOrder } from '@/app/[locale]/(platform)/event/[slug]/_types/EventOrderBookTypes'
import type { UserOpenOrder } from '@/types'
import { useQueryClient } from '@tanstack/react-query'
import { AlignVerticalSpaceAroundIcon, ArrowLeftRightIcon, Loader2Icon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useTradingOnboarding } from '@/app/[locale]/(platform)/_providers/TradingOnboardingProvider'
import { cancelOrderAction } from '@/app/[locale]/(platform)/event/[slug]/_actions/cancel-order'
import { useOrderBookSummaries } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useOrderBookSummaries'
import { buildUserOpenOrdersQueryKey, useUserOpenOrdersQuery } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useUserOpenOrdersQuery'
import {
  buildOrderBookSnapshot,
  calculateLimitAmount,
  formatOrderBookPrice,
  formatSharesInput,
  getExecutableLimitPrice,
  getOrderBookUserKey,
  getRoundedCents,
  microToUnit,
} from '@/app/[locale]/(platform)/event/[slug]/_utils/EventOrderBookUtils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { DEPOSIT_WALLET_BALANCE_QUERY_KEY } from '@/hooks/useBalance'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useOutcomeLabel } from '@/hooks/useOutcomeLabel'
import { ORDER_SIDE, ORDER_TYPE, tableHeaderClass } from '@/lib/constants'
import { formatOddsFromCents } from '@/lib/odds-format'
import { isTradingAuthRequiredError } from '@/lib/trading-auth/errors'
import { cn } from '@/lib/utils'
import { useOrder } from '@/stores/useOrder'
import { useUser } from '@/stores/useUser'
import EventOrderBookEmptyRow from './EventOrderBookEmptyRow'
import EventOrderBookRow from './EventOrderBookRow'

export { useOrderBookSummaries }

function useOrderBookRecenter(summary: unknown) {
  const orderBookScrollRef = useRef<HTMLDivElement | null>(null)
  const centerRowRef = useRef<HTMLDivElement | null>(null)
  const hasCenteredRef = useRef(false)

  const recenterOrderBook = useCallback(function recenterOrderBook(behavior: ScrollBehavior = 'smooth') {
    const container = orderBookScrollRef.current
    const centerRow = centerRowRef.current
    if (!container || !centerRow) {
      return
    }

    const target = centerRow.offsetTop - container.clientHeight / 2 + centerRow.clientHeight / 2
    const maxScrollTop = container.scrollHeight - container.clientHeight
    const clampedTarget = Math.max(0, Math.min(target, maxScrollTop))

    container.scrollTo({ top: clampedTarget, behavior })
  }, [])

  useLayoutEffect(function centerOrderBookOnSummaryReady() {
    if (!summary || hasCenteredRef.current) {
      return
    }

    recenterOrderBook('auto')
    hasCenteredRef.current = true
  }, [recenterOrderBook, summary])

  return { orderBookScrollRef, centerRowRef, hasCenteredRef, recenterOrderBook }
}

function useResetCenteringOnTokenChange(tokenId: string | undefined, hasCenteredRef: React.RefObject<boolean>) {
  useEffect(function resetCenteringFlagOnTokenChange() {
    hasCenteredRef.current = false
  }, [tokenId, hasCenteredRef])
}

function useRecenterKeyboardShortcut(recenterOrderBook: (behavior?: ScrollBehavior) => void) {
  useEffect(function attachRecenterKeyboardShortcut() {
    function handleRecenterKeyDown(event: KeyboardEvent) {
      if (!event.shiftKey || event.key.toLowerCase() !== 'c') {
        return
      }

      const target = event.target as HTMLElement | null
      const tagName = target?.tagName?.toLowerCase()
      const isEditable = tagName === 'input'
        || tagName === 'textarea'
        || tagName === 'select'
        || target?.isContentEditable

      if (event.metaKey || event.ctrlKey || event.altKey || isEditable) {
        return
      }

      event.preventDefault()
      recenterOrderBook()
    }

    window.addEventListener('keydown', handleRecenterKeyDown)
    return function detachRecenterKeyboardShortcut() {
      window.removeEventListener('keydown', handleRecenterKeyDown)
    }
  }, [recenterOrderBook])
}

function useUserOrderBookOrders({
  userId,
  eventSlug,
  conditionId,
}: {
  userId?: string | null
  eventSlug: string
  conditionId?: string
}) {
  const openOrdersQueryKey = useMemo(
    () => buildUserOpenOrdersQueryKey(userId, eventSlug, conditionId),
    [eventSlug, conditionId, userId],
  )
  const eventOpenOrdersQueryKey = useMemo(
    () => buildUserOpenOrdersQueryKey(userId, eventSlug),
    [eventSlug, userId],
  )
  const { data: userOpenOrdersData } = useUserOpenOrdersQuery({
    userId,
    eventSlug,
    conditionId,
    enabled: Boolean(userId),
  })
  const userOpenOrders = useMemo(
    () => userOpenOrdersData?.pages.flatMap(page => page.data) ?? [],
    [userOpenOrdersData?.pages],
  )
  const userOrdersByLevel = useMemo(() => {
    const map = new Map<string, OrderBookUserOrder>()
    userOpenOrders.forEach((order) => {
      const bookSide: 'ask' | 'bid' = order.side === 'sell' ? 'ask' : 'bid'
      const roundedPrice = getRoundedCents(order.price ?? 0, bookSide)
      const totalShares = order.side === 'buy'
        ? microToUnit(order.taker_amount)
        : microToUnit(order.maker_amount)

      if (!Number.isFinite(totalShares) || totalShares <= 0) {
        return
      }

      const filledShares = Math.min(microToUnit(order.size_matched), totalShares)
      const key = getOrderBookUserKey(bookSide, roundedPrice)
      if (map.has(key)) {
        return
      }

      map.set(key, {
        id: order.id,
        priceCents: roundedPrice,
        totalShares,
        filledShares,
        side: bookSide,
      })
    })
    return map
  }, [userOpenOrders])

  return { openOrdersQueryKey, eventOpenOrdersQueryKey, userOrdersByLevel }
}

function useOrderBookUserOrderCancellation({
  queryClient,
  openOrdersQueryKey,
  eventOpenOrdersQueryKey,
  openTradeRequirements,
}: {
  queryClient: ReturnType<typeof useQueryClient>
  openOrdersQueryKey: readonly unknown[]
  eventOpenOrdersQueryKey: readonly unknown[]
  openTradeRequirements: (options: { forceTradingAuth: boolean }) => void
}) {
  const t = useExtracted()
  const refreshTimeoutRef = useRef<number | null>(null)
  const [pendingCancelIds, setPendingCancelIds] = useState<Set<string>>(() => new Set())

  useEffect(function clearRefreshTimeoutOnUnmount() {
    return function clearRefreshTimeout() {
      if (refreshTimeoutRef.current) {
        window.clearTimeout(refreshTimeoutRef.current)
      }
    }
  }, [])

  const removeOrderFromCache = useCallback(function removeOrderFromCache(orderIds: string[]) {
    if (!orderIds.length) {
      return
    }

    function updateCache(queryKey: readonly unknown[]) {
      queryClient.setQueryData<InfiniteData<{ data: UserOpenOrder[], next_cursor: string }>>(queryKey, (current) => {
        if (!current) {
          return current
        }

        const nextPages = current.pages.map(page => ({
          ...page,
          data: page.data.filter(order => !orderIds.includes(order.id)),
        }))
        return { ...current, pages: nextPages }
      })
    }

    updateCache(openOrdersQueryKey)
    updateCache(eventOpenOrdersQueryKey)
  }, [eventOpenOrdersQueryKey, openOrdersQueryKey, queryClient])

  const scheduleOpenOrdersRefresh = useCallback(function scheduleOpenOrdersRefresh() {
    if (typeof window === 'undefined') {
      return
    }
    if (refreshTimeoutRef.current) {
      window.clearTimeout(refreshTimeoutRef.current)
    }
    refreshTimeoutRef.current = window.setTimeout(() => {
      void queryClient.invalidateQueries({ queryKey: openOrdersQueryKey })
      void queryClient.invalidateQueries({ queryKey: eventOpenOrdersQueryKey })
    }, 10_000)
  }, [eventOpenOrdersQueryKey, openOrdersQueryKey, queryClient])

  const handleCancelUserOrder = useCallback(async function handleCancelUserOrder(orderId: string) {
    if (!orderId || pendingCancelIds.has(orderId)) {
      return
    }

    setPendingCancelIds((current) => {
      const next = new Set(current)
      next.add(orderId)
      return next
    })

    try {
      const response = await cancelOrderAction(orderId)
      if (response?.error) {
        if (isTradingAuthRequiredError(response.error)) {
          openTradeRequirements({ forceTradingAuth: true })
          return
        }
        throw new Error(response.error)
      }

      toast.success(t('Order cancelled'))
      removeOrderFromCache([orderId])

      await queryClient.invalidateQueries({ queryKey: openOrdersQueryKey })
      void queryClient.invalidateQueries({ queryKey: eventOpenOrdersQueryKey })
      void queryClient.invalidateQueries({ queryKey: ['orderbook-summary'] })
      void queryClient.invalidateQueries({ queryKey: [DEPOSIT_WALLET_BALANCE_QUERY_KEY] })
      setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: [DEPOSIT_WALLET_BALANCE_QUERY_KEY] })
      }, 3000)
      scheduleOpenOrdersRefresh()
    }
    catch (error: any) {
      const message = typeof error?.message === 'string'
        ? error.message
        : t('Failed to cancel order.')
      toast.error(message)
    }
    finally {
      setPendingCancelIds((current) => {
        const next = new Set(current)
        next.delete(orderId)
        return next
      })
    }
  }, [pendingCancelIds, t, removeOrderFromCache, queryClient, openOrdersQueryKey, eventOpenOrdersQueryKey, scheduleOpenOrdersRefresh, openTradeRequirements])

  return { pendingCancelIds, handleCancelUserOrder }
}

export default function EventOrderBook({
  market,
  outcome,
  summaries,
  isLoadingSummaries,
  eventSlug,
  surfaceVariant = 'default',
  oddsFormat = 'price',
  tradeLabel,
  onToggleOutcome,
  toggleOutcomeTooltip,
  openMobileOrderPanelOnLevelSelect = false,
}: EventOrderBookProps) {
  const t = useExtracted()
  const normalizeOutcomeLabel = useOutcomeLabel()
  const user = useUser()
  const { openTradeRequirements } = useTradingOnboarding()
  const queryClient = useQueryClient()
  const tokenId = outcome?.token_id || market.outcomes[0]?.token_id
  const isSportsCardSurface = surfaceVariant === 'sportsCard'
  const surfaceClass = isSportsCardSurface ? 'bg-card' : 'bg-background'

  const summary = tokenId ? summaries?.[tokenId] ?? null : null
  const setType = useOrder(state => state.setType)
  const setLimitPrice = useOrder(state => state.setLimitPrice)
  const setLimitShares = useOrder(state => state.setLimitShares)
  const setAmount = useOrder(state => state.setAmount)
  const inputRef = useOrder(state => state.inputRef)
  const currentOrderType = useOrder(state => state.type)
  const currentOrderSide = useOrder(state => state.side)
  const setIsMobileOrderPanelOpen = useOrder(state => state.setIsMobileOrderPanelOpen)
  const isMobile = useIsMobile()

  const { orderBookScrollRef, centerRowRef, hasCenteredRef, recenterOrderBook } = useOrderBookRecenter(summary)
  useResetCenteringOnTokenChange(tokenId, hasCenteredRef)
  useRecenterKeyboardShortcut(recenterOrderBook)

  const { openOrdersQueryKey, eventOpenOrdersQueryKey, userOrdersByLevel } = useUserOrderBookOrders({
    userId: user?.id,
    eventSlug,
    conditionId: market.condition_id,
  })

  const { pendingCancelIds, handleCancelUserOrder } = useOrderBookUserOrderCancellation({
    queryClient,
    openOrdersQueryKey,
    eventOpenOrdersQueryKey,
    openTradeRequirements,
  })

  const {
    asks,
    bids,
    lastPrice,
    spread,
    maxTotal,
    outcomeLabel,
  } = useMemo(
    () => buildOrderBookSnapshot(summary, market, outcome),
    [summary, market, outcome],
  )
  const displayOutcomeLabel = normalizeOutcomeLabel(outcomeLabel) ?? outcomeLabel
  const displayTradeLabel = tradeLabel ?? `${t('Trade')} ${displayOutcomeLabel}`
  const formatDisplayedPrice = useCallback((priceCents: number | null | undefined) => {
    if (oddsFormat === 'price') {
      return formatOrderBookPrice(priceCents ?? null)
    }
    return formatOddsFromCents(priceCents ?? null, oddsFormat)
  }, [oddsFormat])

  const renderedAsks = useMemo(
    () => [...asks].sort((a, b) => b.priceCents - a.priceCents),
    [asks],
  )

  const handleLevelSelect = useCallback((level: OrderBookLevel) => {
    if (currentOrderType !== ORDER_TYPE.LIMIT) {
      setType(ORDER_TYPE.LIMIT)
    }
    const executablePrice = getExecutableLimitPrice(level)
    setLimitPrice(executablePrice)

    const shouldPrefillShares = (currentOrderSide === ORDER_SIDE.BUY && level.side === 'ask')
      || (currentOrderSide === ORDER_SIDE.SELL && level.side === 'bid')

    if (shouldPrefillShares) {
      const limitShares = formatSharesInput(level.cumulativeShares)
      setLimitShares(limitShares)

      const limitAmount = calculateLimitAmount(executablePrice, limitShares)
      if (limitAmount !== null) {
        setAmount(limitAmount)
      }
    }

    if (openMobileOrderPanelOnLevelSelect && isMobile) {
      setIsMobileOrderPanelOpen(true)
    }

    queueMicrotask(() => inputRef?.current?.focus())
  }, [
    currentOrderType,
    currentOrderSide,
    inputRef,
    isMobile,
    openMobileOrderPanelOnLevelSelect,
    setAmount,
    setIsMobileOrderPanelOpen,
    setLimitPrice,
    setLimitShares,
    setType,
  ])

  if (!tokenId) {
    return (
      <div className="px-4 py-6 text-center text-sm text-muted-foreground">
        {t('Order book data is unavailable for this outcome.')}
      </div>
    )
  }

  if (isLoadingSummaries) {
    return (
      <div className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-muted-foreground">
        <Loader2Icon className="size-4 animate-spin" />
        {t('Loading order book...')}
      </div>
    )
  }

  return (
    <div
      ref={orderBookScrollRef}
      className={cn(
        'relative isolate max-h-90 overflow-y-auto',
        surfaceClass,
      )}
    >
      <div className={cn(surfaceClass)}>
        <div
          className={cn(
            tableHeaderClass,
            'grid h-9 grid-cols-[40%_20%_20%_20%] items-center border-b',
            'sticky top-0 z-10',
            surfaceClass,
          )}
        >
          <div className="flex h-full items-center gap-2">
            <span className="inline-flex -translate-y-px">{displayTradeLabel}</span>
            {onToggleOutcome && toggleOutcomeTooltip && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className={`
                      inline-flex size-6 translate-y-[-1.5px] items-center justify-center rounded-sm
                      text-muted-foreground transition-colors
                      hover:bg-muted/70 hover:text-foreground
                    `}
                    onClick={onToggleOutcome}
                    aria-label={toggleOutcomeTooltip}
                  >
                    <ArrowLeftRightIcon className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {toggleOutcomeTooltip}
                </TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className={`
                    inline-flex size-6 translate-y-[-1.5px] items-center justify-center rounded-sm text-muted-foreground
                    transition-colors
                    hover:bg-muted/70 hover:text-foreground
                  `}
                  onClick={() => recenterOrderBook()}
                  aria-label={t('Recenter order book')}
                >
                  <AlignVerticalSpaceAroundIcon className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {t('Recenter Book (Shift + C)')}
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="flex h-full items-center justify-center">
            <span className="inline-flex -translate-y-px">{t('Price')}</span>
          </div>
          <div className="flex h-full items-center justify-center">
            <span className="inline-flex -translate-y-px">{t('Shares')}</span>
          </div>
          <div className="flex h-full items-center justify-center">
            <span className="inline-flex -translate-y-px">{t('Total')}</span>
          </div>
        </div>

        {renderedAsks.length > 0
          ? (
              renderedAsks.map((level, index) => {
                const userOrder = userOrdersByLevel.get(getOrderBookUserKey(level.side, level.priceCents))
                return (
                  <EventOrderBookRow
                    key={`ask-${level.priceCents}-${index}`}
                    level={level}
                    maxTotal={maxTotal}
                    showBadge={index === renderedAsks.length - 1 ? 'ask' : undefined}
                    priceFormatter={formatDisplayedPrice}
                    onSelect={handleLevelSelect}
                    userOrder={userOrder}
                    isCancelling={userOrder ? pendingCancelIds.has(userOrder.id) : false}
                    onCancelUserOrder={handleCancelUserOrder}
                  />
                )
              })
            )
          : <EventOrderBookEmptyRow label={t('No asks')} />}

        <div
          ref={centerRowRef}
          className={cn(
            `
              grid h-9 cursor-pointer grid-cols-[40%_20%_20%_20%] items-center border-y px-2 text-xs font-medium
              text-muted-foreground transition-colors
              sm:px-3
            `,
            isSportsCardSurface && 'sticky top-9 bottom-0 z-10',
            isSportsCardSurface ? 'bg-card hover:bg-secondary' : 'bg-background hover:bg-muted',
          )}
          role="presentation"
        >
          <div className="flex h-full cursor-pointer items-center">
            {t('Last')}
            :&nbsp;
            {lastPrice == null ? '--' : formatDisplayedPrice(lastPrice)}
          </div>
          <div className="flex h-full cursor-pointer items-center justify-center">
            {t('Spread')}
            :&nbsp;
            {formatOrderBookPrice(spread)}
          </div>
          <div className="flex h-full items-center justify-center" />
          <div className="flex h-full items-center justify-center" />
        </div>

        {bids.length > 0
          ? (
              bids.map((level, index) => {
                const userOrder = userOrdersByLevel.get(getOrderBookUserKey(level.side, level.priceCents))
                return (
                  <EventOrderBookRow
                    key={`bid-${level.priceCents}-${index}`}
                    level={level}
                    maxTotal={maxTotal}
                    showBadge={index === 0 ? 'bid' : undefined}
                    priceFormatter={formatDisplayedPrice}
                    onSelect={handleLevelSelect}
                    userOrder={userOrder}
                    isCancelling={userOrder ? pendingCancelIds.has(userOrder.id) : false}
                    onCancelUserOrder={handleCancelUserOrder}
                  />
                )
              })
            )
          : <EventOrderBookEmptyRow label={t('No bids')} />}
      </div>
    </div>
  )
}
