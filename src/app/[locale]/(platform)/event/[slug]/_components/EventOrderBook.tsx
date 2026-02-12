'use client'

import type { InfiniteData } from '@tanstack/react-query'
import type { EventOrderBookProps, OrderBookLevel, OrderBookUserOrder } from '@/app/[locale]/(platform)/event/[slug]/_types/EventOrderBookTypes'
import type { UserOpenOrder } from '@/types'
import { useQueryClient } from '@tanstack/react-query'
import { AlignVerticalSpaceAroundIcon, Loader2Icon } from 'lucide-react'
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
import { SAFE_BALANCE_QUERY_KEY } from '@/hooks/useBalance'
import { useOutcomeLabel } from '@/hooks/useOutcomeLabel'
import { ORDER_SIDE, ORDER_TYPE, tableHeaderClass } from '@/lib/constants'
import { isTradingAuthRequiredError } from '@/lib/trading-auth/errors'
import { cn } from '@/lib/utils'
import { useOrder } from '@/stores/useOrder'
import { useUser } from '@/stores/useUser'
import EventOrderBookEmptyRow from './EventOrderBookEmptyRow'
import EventOrderBookRow from './EventOrderBookRow'

export { useOrderBookSummaries }

export default function EventOrderBook({
  market,
  outcome,
  summaries,
  isLoadingSummaries,
  eventSlug,
}: EventOrderBookProps) {
  const t = useExtracted()
  const normalizeOutcomeLabel = useOutcomeLabel()
  const user = useUser()
  const { openTradeRequirements } = useTradingOnboarding()
  const queryClient = useQueryClient()
  const refreshTimeoutRef = useRef<number | null>(null)
  const orderBookScrollRef = useRef<HTMLDivElement | null>(null)
  const centerRowRef = useRef<HTMLDivElement | null>(null)
  const hasCenteredRef = useRef(false)
  const [pendingCancelIds, setPendingCancelIds] = useState<Set<string>>(() => new Set())
  const tokenId = outcome?.token_id || market.outcomes[0]?.token_id

  const summary = tokenId ? summaries?.[tokenId] ?? null : null
  const setType = useOrder(state => state.setType)
  const setLimitPrice = useOrder(state => state.setLimitPrice)
  const setLimitShares = useOrder(state => state.setLimitShares)
  const setAmount = useOrder(state => state.setAmount)
  const inputRef = useOrder(state => state.inputRef)
  const currentOrderType = useOrder(state => state.type)
  const currentOrderSide = useOrder(state => state.side)
  const openOrdersQueryKey = useMemo(
    () => buildUserOpenOrdersQueryKey(user?.id, eventSlug, market.condition_id),
    [eventSlug, market.condition_id, user?.id],
  )
  const eventOpenOrdersQueryKey = useMemo(
    () => buildUserOpenOrdersQueryKey(user?.id, eventSlug),
    [eventSlug, user?.id],
  )
  const { data: userOpenOrdersData } = useUserOpenOrdersQuery({
    userId: user?.id,
    eventSlug,
    conditionId: market.condition_id,
    enabled: Boolean(user?.id),
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

  const recenterOrderBook = useCallback((behavior: ScrollBehavior = 'smooth') => {
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

  const removeOrderFromCache = useCallback((orderIds: string[]) => {
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

  const scheduleOpenOrdersRefresh = useCallback(() => {
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

  const handleCancelUserOrder = useCallback(async (orderId: string) => {
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
          openTradeRequirements()
        }
        throw new Error(response.error)
      }

      toast.success(t('Order cancelled'))
      removeOrderFromCache([orderId])

      await queryClient.invalidateQueries({ queryKey: openOrdersQueryKey })
      void queryClient.invalidateQueries({ queryKey: eventOpenOrdersQueryKey })
      void queryClient.invalidateQueries({ queryKey: ['orderbook-summary'] })
      void queryClient.invalidateQueries({ queryKey: [SAFE_BALANCE_QUERY_KEY] })
      setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: [SAFE_BALANCE_QUERY_KEY] })
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

  useEffect(() => () => {
    if (refreshTimeoutRef.current) {
      window.clearTimeout(refreshTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    hasCenteredRef.current = false
  }, [tokenId])

  useLayoutEffect(() => {
    if (!summary || hasCenteredRef.current) {
      return
    }

    recenterOrderBook('auto')
    hasCenteredRef.current = true
  }, [recenterOrderBook, summary])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
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

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [recenterOrderBook])

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

    queueMicrotask(() => inputRef?.current?.focus())
  }, [currentOrderType, currentOrderSide, setType, setLimitPrice, setLimitShares, setAmount, inputRef])

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
    <div ref={orderBookScrollRef} className="relative max-h-90 overflow-y-auto">
      <div>
        <div
          className={cn(
            tableHeaderClass,
            'sticky top-0 z-1 grid h-9 grid-cols-[40%_20%_20%_20%] items-center border-b bg-background',
          )}
        >
          <div className="flex h-full items-center gap-2">
            <span className="inline-flex -translate-y-px">{`${t('Trade')} ${displayOutcomeLabel}`}</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className={`
                    inline-flex size-6 -translate-y-[1.5px] items-center justify-center rounded-sm text-muted-foreground
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
          className={
            `
              sticky top-9 bottom-0 z-1 grid h-9 cursor-pointer grid-cols-[40%_20%_20%_20%] items-center border-y
              bg-background px-2 text-xs font-medium text-muted-foreground transition-colors
              hover:bg-muted
              sm:px-3
            `
          }
          role="presentation"
        >
          <div className="flex h-full cursor-pointer items-center">
            {t('Last')}
            :&nbsp;
            {lastPrice == null ? '--' : formatOrderBookPrice(lastPrice)}
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
