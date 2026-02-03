'use client'

import type { InfiniteData } from '@tanstack/react-query'
import type { Event, UserOpenOrder } from '@/types'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronDownIcon, ChevronUpIcon, XIcon } from 'lucide-react'
import { useExtracted, useLocale } from 'next-intl'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useTradingOnboarding } from '@/app/[locale]/(platform)/_providers/TradingOnboardingProvider'
import { cancelMarketOrdersAction } from '@/app/[locale]/(platform)/event/[slug]/_actions/cancel-market-orders'
import { cancelOrderAction } from '@/app/[locale]/(platform)/event/[slug]/_actions/cancel-order'
import { buildUserOpenOrdersQueryKey, useUserOpenOrdersQuery } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useUserOpenOrdersQuery'
import AlertBanner from '@/components/AlertBanner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { SAFE_BALANCE_QUERY_KEY } from '@/hooks/useBalance'
import { useOutcomeLabel } from '@/hooks/useOutcomeLabel'
import { MICRO_UNIT, OUTCOME_INDEX, tableHeaderClass } from '@/lib/constants'
import { formatCurrency, formatSharePriceLabel, formatSharesLabel } from '@/lib/formatters'
import { isTradingAuthRequiredError } from '@/lib/trading-auth/errors'
import { cn } from '@/lib/utils'
import { useIsSingleMarket } from '@/stores/useOrder'
import { useUser } from '@/stores/useUser'

interface EventMarketOpenOrdersProps {
  market: Event['markets'][number]
  eventSlug: string
}

interface OpenOrderRowProps {
  order: UserOpenOrder
  onCancel: (order: UserOpenOrder) => void
  isCancelling: boolean
}

type SortDirection = 'asc' | 'desc'
type SortColumn = 'side' | 'outcome' | 'price' | 'filled' | 'total' | 'expiration'

function getOrderSortValue(order: UserOpenOrder, column: SortColumn) {
  switch (column) {
    case 'side':
      return order.side === 'buy' ? 0 : 1
    case 'outcome':
      return (order.outcome.text || '').toLowerCase()
    case 'price':
      return Number(order.price) || 0
    case 'filled': {
      const totalShares = microToUnit(order.side === 'buy' ? order.taker_amount : order.maker_amount)
      if (totalShares <= 0) {
        return 0
      }
      const filledShares = microToUnit(order.size_matched)
      return Math.min(filledShares / totalShares, 1)
    }
    case 'total': {
      const totalValueMicro = order.side === 'buy' ? order.maker_amount : order.taker_amount
      return microToUnit(totalValueMicro)
    }
    case 'expiration': {
      if (order.type === 'GTC') {
        return Number.POSITIVE_INFINITY
      }
      const rawExpiration = typeof order.expiration === 'number'
        ? order.expiration
        : Number(order.expiration)
      return Number.isFinite(rawExpiration) ? rawExpiration : Number.POSITIVE_INFINITY
    }
    default:
      return 0
  }
}

function sortOrders(orders: UserOpenOrder[], sortState: { column: SortColumn, direction: SortDirection } | null) {
  if (!sortState) {
    return orders
  }

  const sorted = [...orders]
  sorted.sort((a, b) => {
    const aValue = getOrderSortValue(a, sortState.column)
    const bValue = getOrderSortValue(b, sortState.column)

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      const comparison = aValue.localeCompare(bValue)
      return sortState.direction === 'asc' ? comparison : -comparison
    }

    const numericComparison = Number(aValue) - Number(bValue)
    if (numericComparison === 0) {
      return 0
    }

    return sortState.direction === 'asc' ? numericComparison : -numericComparison
  })

  return sorted
}

function SortHeaderButton({
  column,
  label,
  alignment = 'left',
  sortState,
  onSort,
}: {
  column: SortColumn
  label: string
  alignment?: 'left' | 'center' | 'right'
  sortState: { column: SortColumn, direction: SortDirection } | null
  onSort: (column: SortColumn) => void
}) {
  const isActive = sortState?.column === column
  const direction = isActive ? sortState?.direction : null
  const Icon = direction === 'asc' ? ChevronUpIcon : ChevronDownIcon

  return (
    <button
      type="button"
      className={cn(
        'group flex w-full items-center gap-2 whitespace-nowrap uppercase transition-colors',
        alignment === 'center' && 'justify-center',
        alignment === 'right' && 'justify-end',
        alignment === 'left' && 'justify-start',
      )}
      onClick={() => onSort(column)}
    >
      <span>{label}</span>
      <Icon
        className={cn(
          'size-3.5 shrink-0 transition-colors',
          isActive ? 'text-foreground' : 'text-muted-foreground/60',
        )}
      />
    </button>
  )
}

function microToUnit(value?: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0
  }
  return value / MICRO_UNIT
}

function formatExpirationLabel(order: UserOpenOrder, locale: string, untilCancelledLabel: string) {
  if (order.type === 'GTC') {
    return untilCancelledLabel
  }

  const rawExpiration = typeof order.expiration === 'number'
    ? order.expiration
    : Number(order.expiration)

  if (!Number.isFinite(rawExpiration) || rawExpiration <= 0) {
    return '—'
  }

  const date = new Date(rawExpiration * 1000)
  return date.toLocaleString(locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatFilledLabel(filledShares: number, totalShares: number) {
  if (!Number.isFinite(totalShares) || totalShares <= 0) {
    return '—'
  }

  const normalizedFilled = Math.min(Math.max(filledShares, 0), totalShares)
  return `${formatSharesLabel(normalizedFilled)}/${formatSharesLabel(totalShares)}`
}

function OpenOrderRow({ order, onCancel, isCancelling }: OpenOrderRowProps) {
  const t = useExtracted()
  const locale = useLocale()
  const normalizeOutcomeLabel = useOutcomeLabel()
  const isBuy = order.side === 'buy'
  const sideLabel = isBuy ? t('Buy') : t('Sell')
  const priceLabel = formatSharePriceLabel(order.price, { fallback: '—' })
  const totalShares = microToUnit(isBuy ? order.taker_amount : order.maker_amount)
  const filledShares = microToUnit(order.size_matched)
  const filledLabel = formatFilledLabel(filledShares, totalShares)
  const totalValueMicro = isBuy ? order.maker_amount : order.taker_amount
  const totalValueLabel = formatCurrency(microToUnit(totalValueMicro), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  const expirationLabel = formatExpirationLabel(order, locale, t('Until Cancelled'))
  const isNoOutcome = order.outcome.index === OUTCOME_INDEX.NO
  const outcomeLabel = normalizeOutcomeLabel(order.outcome.text || (isNoOutcome ? 'No' : 'Yes'))
    || (isNoOutcome ? 'No' : 'Yes')

  return (
    <tr className="text-2xs leading-tight text-foreground sm:text-xs">
      <td className="p-2 text-xs font-semibold text-muted-foreground sm:px-3 sm:text-sm">
        {sideLabel}
      </td>
      <td className="p-2 sm:px-3">
        <span
          className={cn(
            `
              inline-flex min-h-7 min-w-14 items-center justify-center rounded-sm px-4 text-xs font-semibold
              tracking-wide
            `,
            isNoOutcome ? 'bg-no/15 text-no-foreground' : 'bg-yes/15 text-yes-foreground',
          )}
        >
          {outcomeLabel}
        </span>
      </td>
      <td className="p-2 text-center text-xs font-semibold sm:px-3 sm:text-sm">{priceLabel}</td>
      <td className="p-2 text-center text-xs font-semibold sm:px-3 sm:text-sm">{filledLabel}</td>
      <td className="p-2 text-center text-xs font-semibold sm:px-3 sm:text-sm">{totalValueLabel}</td>
      <td className="p-2 text-2xs font-medium text-muted-foreground sm:px-3 sm:text-xs">
        {expirationLabel}
      </td>
      <td className="p-2 sm:px-3">
        <div className="flex justify-end">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                aria-label={t('Cancel {side} order for {outcome}', { side: sideLabel, outcome: outcomeLabel })}
                variant="outline"
                size="sm"
                disabled={isCancelling}
                onClick={() => onCancel(order)}
              >
                <XIcon className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {t('Cancel')}
            </TooltipContent>
          </Tooltip>
        </div>
      </td>
    </tr>
  )
}

export default function EventMarketOpenOrders({ market, eventSlug }: EventMarketOpenOrdersProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const t = useExtracted()
  const user = useUser()
  const queryClient = useQueryClient()
  const { openTradeRequirements } = useTradingOnboarding()
  const isSingleMarket = useIsSingleMarket()
  const [infiniteScrollError, setInfiniteScrollError] = useState<string | null>(null)
  const [pendingCancelIds, setPendingCancelIds] = useState<Set<string>>(() => new Set())
  const [isCancellingAll, setIsCancellingAll] = useState(false)
  const [isCancelAllDialogOpen, setIsCancelAllDialogOpen] = useState(false)
  const [sortState, setSortState] = useState<{ column: SortColumn, direction: SortDirection } | null>(null)

  useEffect(() => {
    queueMicrotask(() => {
      setInfiniteScrollError(null)
    })
  }, [market.condition_id, eventSlug])

  const openOrdersQueryKey = useMemo(
    () => buildUserOpenOrdersQueryKey(user?.id, eventSlug, market.condition_id),
    [eventSlug, market.condition_id, user?.id],
  )
  const eventOpenOrdersQueryKey = useMemo(
    () => buildUserOpenOrdersQueryKey(user?.id, eventSlug),
    [eventSlug, user?.id],
  )

  const {
    status,
    data,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useUserOpenOrdersQuery({
    userId: user?.id,
    eventSlug,
    conditionId: market.condition_id,
  })

  const orders = useMemo(() => data?.pages.flatMap(page => page.data) ?? [], [data?.pages])
  const sortedOrders = useMemo(() => sortOrders(orders, sortState), [orders, sortState])
  const hasOrders = sortedOrders.length > 0

  const removeOrdersFromCache = useCallback((orderIds: string[]) => {
    if (!orderIds.length) {
      return
    }

    function updateCache(queryKey: readonly unknown[]) {
      queryClient.setQueryData<InfiniteData<{ data: UserOpenOrder[], next_cursor: string }>>(queryKey, (current) => {
        if (!current) {
          return current
        }

        const updatedPages = current.pages.map(page => ({
          ...page,
          data: page.data.filter(item => !orderIds.includes(item.id)),
        }))
        return { ...current, pages: updatedPages }
      })
    }

    updateCache(openOrdersQueryKey)
    updateCache(eventOpenOrdersQueryKey)
  }, [eventOpenOrdersQueryKey, openOrdersQueryKey, queryClient])

  const scheduleOpenOrdersRefresh = useCallback(() => {
    setTimeout(() => {
      void queryClient.invalidateQueries({ queryKey: openOrdersQueryKey })
      void queryClient.invalidateQueries({ queryKey: eventOpenOrdersQueryKey })
    }, 10_000)
  }, [eventOpenOrdersQueryKey, openOrdersQueryKey, queryClient])

  const handleCancelOrder = useCallback(async (order: UserOpenOrder) => {
    if (pendingCancelIds.has(order.id)) {
      return
    }

    setPendingCancelIds((current) => {
      const next = new Set(current)
      next.add(order.id)
      return next
    })

    try {
      const response = await cancelOrderAction(order.id)
      if (response?.error) {
        throw new Error(response.error)
      }

      toast.success(t('Order cancelled'))

      removeOrdersFromCache([order.id])
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
      if (isTradingAuthRequiredError(message)) {
        openTradeRequirements()
      }
      else {
        toast.error(message)
      }
    }
    finally {
      setPendingCancelIds((current) => {
        const next = new Set(current)
        next.delete(order.id)
        return next
      })
    }
  }, [eventOpenOrdersQueryKey, openOrdersQueryKey, openTradeRequirements, pendingCancelIds, queryClient, removeOrdersFromCache, scheduleOpenOrdersRefresh, t])

  const handleSort = useCallback((column: SortColumn) => {
    setSortState((current) => {
      if (current?.column === column) {
        return {
          column,
          direction: current.direction === 'asc' ? 'desc' : 'asc',
        }
      }
      return { column, direction: 'desc' }
    })
  }, [])

  const handleCancelAll = useCallback(async () => {
    if (!sortedOrders.length || isCancellingAll) {
      return
    }

    const orderIds = sortedOrders.map(order => order.id)
    setIsCancellingAll(true)
    setPendingCancelIds((current) => {
      const next = new Set(current)
      orderIds.forEach(id => next.add(id))
      return next
    })

    try {
      const result = await cancelMarketOrdersAction({ market: market.condition_id })
      if (result.error) {
        throw new Error(result.error)
      }

      const failedIds = Object.keys(result.notCanceled ?? {})
      const failedCount = failedIds.length

      if (failedCount === 0) {
        toast.success(t('All open orders for this market were cancelled.'))
      }
      else {
        const tUnsafe = t as unknown as (message: string, values?: Record<string, any>) => string
        toast.error(tUnsafe(
          'Could not cancel {count} order{count, plural, one {} other {s}}.',
          { count: failedCount },
        ))
      }

      if (result.cancelled.length) {
        removeOrdersFromCache(result.cancelled)
      }
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
        : t('Failed to cancel open orders.')
      if (isTradingAuthRequiredError(message)) {
        openTradeRequirements()
      }
      else {
        toast.error(message)
      }
    }
    finally {
      setPendingCancelIds((current) => {
        const next = new Set(current)
        orderIds.forEach(id => next.delete(id))
        return next
      })
      setIsCancellingAll(false)
    }
  }, [
    isCancellingAll,
    market.condition_id,
    openTradeRequirements,
    eventOpenOrdersQueryKey,
    openOrdersQueryKey,
    queryClient,
    removeOrdersFromCache,
    scheduleOpenOrdersRefresh,
    sortedOrders,
    t,
  ])

  const handleCancelAllConfirm = useCallback(() => {
    if (isCancellingAll) {
      return
    }
    setIsCancelAllDialogOpen(false)
    void handleCancelAll()
  }, [handleCancelAll, isCancellingAll])

  useEffect(() => {
    if (!hasOrders || typeof window === 'undefined') {
      return
    }

    const intervalId = window.setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: openOrdersQueryKey })
      void queryClient.invalidateQueries({ queryKey: eventOpenOrdersQueryKey })
    }, 60_000)

    return () => window.clearInterval(intervalId)
  }, [eventOpenOrdersQueryKey, hasOrders, openOrdersQueryKey, queryClient])

  useEffect(() => {
    if (!sentinelRef.current || !hasNextPage || status === 'pending') {
      return
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) {
        return
      }
      if (isFetchingNextPage || infiniteScrollError) {
        return
      }

      fetchNextPage().catch((error: any) => {
        if (error?.name === 'CanceledError' || error?.name === 'AbortError') {
          return
        }
        setInfiniteScrollError(error?.message || t('Failed to load more open orders'))
      })
    }, { rootMargin: '200px 0px' })

    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [fetchNextPage, hasNextPage, infiniteScrollError, isFetchingNextPage, status, t])

  const shouldRender = Boolean(user?.id && status === 'success' && hasOrders)

  if (!shouldRender) {
    return null
  }

  const content = (
    <>
      {isSingleMarket && (
        <div className="p-4">
          <h3 className="text-lg font-medium">{t('Open Orders')}</h3>
        </div>
      )}

      <div className="max-w-full min-w-0 overflow-x-auto">
        <table className="w-full max-w-full table-fixed border-collapse max-sm:min-w-[140%] sm:min-w-full">
          <thead>
            <tr className="border-b bg-background">
              <th className={cn(tableHeaderClass, 'text-left')}>
                <SortHeaderButton column="side" label={t('Side')} sortState={sortState} onSort={handleSort} />
              </th>
              <th className={cn(tableHeaderClass, 'text-left')}>
                <SortHeaderButton column="outcome" label={t('Outcome')} sortState={sortState} onSort={handleSort} />
              </th>
              <th className={cn(tableHeaderClass, 'text-center')}>
                <SortHeaderButton column="price" label={t('Price')} alignment="center" sortState={sortState} onSort={handleSort} />
              </th>
              <th className={cn(tableHeaderClass, 'text-center')}>
                <SortHeaderButton column="filled" label={t('Filled')} alignment="center" sortState={sortState} onSort={handleSort} />
              </th>
              <th className={cn(tableHeaderClass, 'text-center')}>
                <SortHeaderButton column="total" label={t('Total')} alignment="center" sortState={sortState} onSort={handleSort} />
              </th>
              <th className={cn(tableHeaderClass, 'text-left')}>
                <SortHeaderButton column="expiration" label={t('Expiration')} sortState={sortState} onSort={handleSort} />
              </th>
              <th className={cn(tableHeaderClass, 'text-right')}>
                <button
                  type="button"
                  className={`
                    text-2xs font-semibold tracking-wide whitespace-nowrap text-destructive uppercase transition-opacity
                    disabled:opacity-40
                  `}
                  onClick={() => setIsCancelAllDialogOpen(true)}
                  disabled={isCancellingAll || !hasOrders}
                >
                  {isCancellingAll ? t('Cancelling…') : t('Cancel All')}
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {sortedOrders.map(order => (
              <OpenOrderRow
                key={order.id}
                order={order}
                onCancel={handleCancelOrder}
                isCancelling={pendingCancelIds.has(order.id)}
              />
            ))}
          </tbody>
        </table>
        {hasNextPage && !infiniteScrollError && (
          <div ref={sentinelRef} className="h-1" />
        )}
      </div>

      {hasOrders && isFetchingNextPage && (
        <div className={cn(isSingleMarket ? 'border-t' : '', `px-4 py-3 text-center text-xs text-muted-foreground`)}>
          {t('Loading more open orders...')}
        </div>
      )}

      {infiniteScrollError && (
        <div className={cn(isSingleMarket ? 'border-t' : '', 'px-4 py-3')}>
          <AlertBanner
            title={t('Could not load more open orders')}
            description={(
              <Button
                type="button"
                variant="link"
                size="sm"
                className="-ml-3"
                onClick={() => {
                  setInfiniteScrollError(null)
                  fetchNextPage().catch((error: any) => {
                    if (error?.name === 'CanceledError' || error?.name === 'AbortError') {
                      return
                    }
                    setInfiniteScrollError(error?.message || t('Failed to load more open orders'))
                  })
                }}
              >
                {t('Try again')}
              </Button>
            )}
          />
        </div>
      )}

      <Dialog open={isCancelAllDialogOpen} onOpenChange={setIsCancelAllDialogOpen}>
        <DialogContent className="max-w-sm bg-background sm:p-8">
          <div className="space-y-6">
            <DialogHeader className="space-y-3">
              <DialogTitle className="text-center text-2xl font-bold">
                {t('Are you sure?')}
              </DialogTitle>
              <DialogDescription className="text-center text-sm text-muted-foreground">
                {t('Are you sure you want to cancel all open orders for this market?')}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button
                type="button"
                variant="outline"
                className="bg-background sm:w-36"
                onClick={() => setIsCancelAllDialogOpen(false)}
              >
                {t('Never mind')}
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="bg-destructive hover:bg-destructive sm:w-36"
                onClick={handleCancelAllConfirm}
                disabled={isCancellingAll}
              >
                {isCancellingAll ? t('Cancelling…') : t('Confirm')}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )

  return isSingleMarket
    ? (
        <section className="min-w-0 overflow-hidden rounded-xl border">
          {content}
        </section>
      )
    : (
        <div className="min-w-0">
          {content}
        </div>
      )
}
