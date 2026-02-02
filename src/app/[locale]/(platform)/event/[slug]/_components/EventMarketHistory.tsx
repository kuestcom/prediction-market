'use client'

import type { Event } from '@/types'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Loader2Icon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useEffect, useMemo, useRef, useState } from 'react'
import AlertBanner from '@/components/AlertBanner'
import { Button } from '@/components/ui/button'
import { useOutcomeLabel } from '@/hooks/useOutcomeLabel'
import { MICRO_UNIT, POLYGON_SCAN_BASE } from '@/lib/constants'
import { fetchUserActivityData, mapDataApiActivityToActivityOrder } from '@/lib/data-api/user'
import { formatCurrency, formatSharePriceLabel, formatSharesLabel, formatTimeAgo, fromMicro } from '@/lib/formatters'
import { getUserPublicAddress } from '@/lib/user-address'
import { cn } from '@/lib/utils'
import { useIsSingleMarket } from '@/stores/useOrder'
import { useUser } from '@/stores/useUser'

interface EventMarketHistoryProps {
  market: Event['markets'][number]
}

export default function EventMarketHistory({ market }: EventMarketHistoryProps) {
  const t = useExtracted()
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  const [infiniteScrollError, setInfiniteScrollError] = useState<string | null>(null)
  const user = useUser()
  const isSingleMarket = useIsSingleMarket()
  const userAddress = getUserPublicAddress(user)
  const normalizeOutcomeLabel = useOutcomeLabel()

  useEffect(() => {
    queueMicrotask(() => setInfiniteScrollError(null))
  }, [market.condition_id])

  const {
    status,
    data,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['user-market-activity', userAddress, market.condition_id],
    queryFn: ({ pageParam = 0, signal }) =>
      fetchUserActivityData({
        pageParam,
        userAddress,
        conditionId: market.condition_id,
        signal,
      }).then(activities => activities.map(mapDataApiActivityToActivityOrder)),
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length === 50) {
        return allPages.reduce((total, page) => total + page.length, 0)
      }

      return undefined
    },
    enabled: Boolean(userAddress && market.condition_id),
    initialPageParam: 0,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
  })

  const activities = useMemo(
    () => (data?.pages.flat() ?? [])
      .filter(activity =>
        activity.market.condition_id === market.condition_id
        && activity.type === 'trade'),
    [data?.pages, market.condition_id],
  )
  const isLoadingInitial = status === 'pending'
  const hasInitialError = status === 'error'

  useEffect(() => {
    const node = loadMoreRef.current
    if (!node) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (
          entry?.isIntersecting
          && hasNextPage
          && !isFetchingNextPage
          && !infiniteScrollError
        ) {
          fetchNextPage().catch((error) => {
            setInfiniteScrollError(error.message || 'Failed to load more activity')
          })
        }
      },
      { rootMargin: '200px 0px' },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [fetchNextPage, hasNextPage, infiniteScrollError, isFetchingNextPage])

  function retryInfiniteScroll() {
    setInfiniteScrollError(null)
    fetchNextPage().catch((error) => {
      setInfiniteScrollError(error.message || 'Failed to load more activity')
    })
  }

  if (!userAddress) {
    return <></>
  }

  if (hasInitialError) {
    const content = (
      <>
        {isSingleMarket && (
          <div className="p-4">
            <h3 className="text-lg font-medium">{t('History')}</h3>
          </div>
        )}
        <div className={cn(isSingleMarket ? 'border-t' : '', 'p-4')}>
          <AlertBanner
            title={t('Failed to load activity')}
            description={(
              <Button
                type="button"
                onClick={() => refetch()}
                size="sm"
                variant="link"
                className="-ml-3"
              >
                {t('Try again')}
              </Button>
            )}
          />
        </div>
      </>
    )

    return isSingleMarket
      ? (
          <section className="rounded-xl border">
            {content}
          </section>
        )
      : (
          <div>
            {content}
          </div>
        )
  }

  if (isLoadingInitial || activities.length === 0) {
    return (
      isSingleMarket
        ? <></>
        : (
            <div className="text-sm text-muted-foreground">
              {t('No activity for this outcome.')}
            </div>
          )
    )
  }

  const content = (
    <>
      {isSingleMarket && (
        <div className="sticky top-0 z-10 bg-background/95 p-4 backdrop-blur-sm">
          <h3 className="text-lg font-medium">{t('History')}</h3>
        </div>
      )}

      <div className="divide-y divide-border">
        {activities.map((activity) => {
          const sharesValue = Number.parseFloat(fromMicro(activity.amount, 4))
          const sharesLabel = Number.isFinite(sharesValue)
            ? formatSharesLabel(sharesValue)
            : '—'
          const outcomeColorClass = (activity.outcome.text || '').toLowerCase() === 'yes'
            ? 'text-yes'
            : 'text-no'
          const actionLabel = activity.side === 'sell' ? t('Sold') : t('Bought')
          const priceLabel = formatSharePriceLabel(Number(activity.price), { fallback: '—' })
          const totalValue = Number(activity.total_value) / MICRO_UNIT
          const totalValueLabel = formatCurrency(totalValue, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
          const timeAgoLabel = formatTimeAgo(activity.created_at)
          const fullDateLabel = new Date(activity.created_at).toLocaleString(undefined, {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })
          const txUrl = activity.tx_hash ? `${POLYGON_SCAN_BASE}/tx/${activity.tx_hash}` : null

          return (
            <div
              key={activity.id}
              className={cn('flex h-11 items-center justify-between gap-3 px-3 text-sm leading-none text-foreground')}
            >
              <div className="flex min-w-0 items-center gap-2 overflow-hidden leading-none whitespace-nowrap">
                <span className="font-semibold">{actionLabel}</span>
                <span className={cn('font-semibold', outcomeColorClass)}>
                  {sharesLabel}
                  {' '}
                  {normalizeOutcomeLabel(activity.outcome.text)}
                </span>
                <span className="text-foreground">{t('at')}</span>
                <span className="font-semibold">{priceLabel}</span>
                <span className="text-muted-foreground">
                  (
                  {totalValueLabel}
                  )
                </span>
              </div>
              {txUrl
                ? (
                    <a
                      href={txUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`
                        text-xs whitespace-nowrap text-muted-foreground transition-colors
                        hover:text-foreground
                      `}
                      title={fullDateLabel}
                    >
                      {timeAgoLabel}
                    </a>
                  )
                : (
                    <span className="text-xs whitespace-nowrap text-muted-foreground" title={fullDateLabel}>
                      {timeAgoLabel}
                    </span>
                  )}
            </div>
          )
        })}
      </div>

      {isFetchingNextPage && (
        <div className={cn(isSingleMarket ? 'border-t' : '', `px-4 py-3 text-center text-xs text-muted-foreground`)}>
          <Loader2Icon className="mr-2 inline size-4 animate-spin align-middle" />
          {t('Loading more history...')}
        </div>
      )}

      {infiniteScrollError && (
        <div className={cn(isSingleMarket ? 'border-t' : '', 'px-4 py-3')}>
          <AlertBanner
            title={t('Failed to load more activity')}
            description={(
              <Button
                type="button"
                onClick={retryInfiniteScroll}
                size="sm"
                variant="link"
                className="-ml-3"
              >
                {t('Try again')}
              </Button>
            )}
          />
        </div>
      )}

      <div ref={loadMoreRef} className="h-1 w-full" aria-hidden />
    </>
  )

  return isSingleMarket
    ? (
        <section className="scrollbar-hide max-h-96 overflow-auto rounded-xl border">
          {content}
        </section>
      )
    : (
        <div className="scrollbar-hide max-h-96 overflow-auto">
          {content}
        </div>
      )
}
