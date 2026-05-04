'use client'

import type { InfiniteData } from '@tanstack/react-query'
import type { ActivityOrder, Event } from '@/types'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLinkIcon, Loader2Icon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  useMarketChannelSubscription,
} from '@/app/[locale]/(platform)/event/[slug]/_components/EventMarketChannelProvider'
import AlertBanner from '@/components/AlertBanner'
import ProfileLink from '@/components/ProfileLink'
import ProfileLinkSkeleton from '@/components/ProfileLinkSkeleton'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useOutcomeLabel } from '@/hooks/useOutcomeLabel'
import { MICRO_UNIT } from '@/lib/constants'
import { EVENT_ACTIVITY_PAGE_SIZE, fetchEventTrades } from '@/lib/data-api/trades'
import { formatCurrency, formatSharePriceLabel, formatTimeAgo, fromMicro } from '@/lib/formatters'
import { POLYGON_SCAN_BASE } from '@/lib/network'
import { cn } from '@/lib/utils'

interface EventActivityProps {
  event: Event
}

function resolveActivityRowKey(activity: ActivityOrder) {
  return [
    activity.id,
    activity.created_at,
    activity.tx_hash ?? 'no-tx',
    activity.user.id,
    activity.market.condition_id ?? 'no-market',
    activity.side,
  ].join(':')
}

function getEventTokenIds(event: Event) {
  const tokenIds = new Set<string>()

  for (const market of event.markets) {
    for (const outcome of market.outcomes) {
      if (outcome.token_id) {
        tokenIds.add(String(outcome.token_id))
      }
    }
  }

  return Array.from(tokenIds)
}

const WS_REFRESH_THROTTLE_MS = 2000
const ACTIVITY_POLL_INTERVAL_MS = 60_000

function useInfiniteScrollSentinel({
  sentinelRef,
  hasMarkets,
  hasNextPage,
  isFetchingNextPage,
  loading,
  hasError,
  fetchNextPage,
  setInfiniteScrollError,
  errorMessage,
}: {
  sentinelRef: React.RefObject<HTMLDivElement | null>
  hasMarkets: boolean
  hasNextPage: boolean
  isFetchingNextPage: boolean
  loading: boolean
  hasError: boolean
  fetchNextPage: () => Promise<unknown>
  setInfiniteScrollError: (value: string | null) => void
  errorMessage: string
}) {
  useEffect(function observeInfiniteScrollSentinel() {
    const node = sentinelRef.current
    if (!node || !hasMarkets) {
      return
    }

    const observer = new IntersectionObserver(function handleSentinelIntersection(entries) {
      const entry = entries[0]
      if (
        entry?.isIntersecting
        && hasNextPage
        && !isFetchingNextPage
        && !loading
        && !hasError
      ) {
        fetchNextPage().catch((error) => {
          setInfiniteScrollError(error.message || errorMessage)
        })
      }
    }, { rootMargin: '200px 0px' })

    observer.observe(node)
    return function unobserveInfiniteScrollSentinel() {
      observer.disconnect()
    }
  }, [errorMessage, fetchNextPage, hasError, hasMarkets, hasNextPage, isFetchingNextPage, loading, sentinelRef, setInfiniteScrollError])
}

function useRealtimeActivityRefresh({
  hasMarkets,
  loading,
  marketIds,
  tokenIds,
  minAmountFilter,
  queryClient,
  queryKey,
}: {
  hasMarkets: boolean
  loading: boolean
  marketIds: string[]
  tokenIds: string[]
  minAmountFilter: string
  queryClient: ReturnType<typeof useQueryClient>
  queryKey: readonly unknown[]
}) {
  const isPollingRef = useRef(false)
  const lastWsRefreshAtRef = useRef(0)

  const refreshLatestActivity = useCallback(async function refreshLatestActivity() {
    if (!hasMarkets || loading || isPollingRef.current) {
      return
    }

    isPollingRef.current = true
    try {
      const latest = await fetchEventTrades({
        marketIds,
        pageParam: 0,
        minAmountFilter,
      })

      queryClient.setQueryData<InfiniteData<ActivityOrder[]>>(queryKey, (existing) => {
        if (!existing) {
          return {
            pages: [latest],
            pageParams: [0],
          }
        }

        const merged = [...latest, ...existing.pages.flat()]
        const seen = new Set<string>()
        const deduped: ActivityOrder[] = []

        for (const item of merged) {
          if (seen.has(item.id)) {
            continue
          }
          seen.add(item.id)
          deduped.push(item)
        }

        const pages: ActivityOrder[][] = []
        for (let i = 0; i < deduped.length; i += EVENT_ACTIVITY_PAGE_SIZE) {
          pages.push(deduped.slice(i, i + EVENT_ACTIVITY_PAGE_SIZE))
        }

        const pageParams = pages.map((_, index) => index * EVENT_ACTIVITY_PAGE_SIZE)

        return {
          pages,
          pageParams,
        }
      })
    }
    catch (error) {
      console.error('Failed to refresh activity feed', error)
    }
    finally {
      isPollingRef.current = false
    }
  }, [hasMarkets, loading, marketIds, minAmountFilter, queryClient, queryKey])

  useEffect(function pollActivityWhilePageVisible() {
    if (!hasMarkets) {
      return
    }

    const interval = window.setInterval(function refreshIfVisible() {
      if (document.hidden) {
        return
      }
      void refreshLatestActivity()
    }, ACTIVITY_POLL_INTERVAL_MS)

    return function stopActivityPolling() {
      window.clearInterval(interval)
    }
  }, [hasMarkets, refreshLatestActivity])

  const handleMarketChannelMessage = useCallback((payload: any) => {
    if (!hasMarkets || tokenIds.length === 0) {
      return
    }
    if (payload?.event_type !== 'last_trade_price') {
      return
    }
    const assetId = payload?.asset_id
    if (!tokenIds.includes(String(assetId))) {
      return
    }
    if (document.hidden) {
      return
    }
    const now = Date.now()
    if (now - lastWsRefreshAtRef.current < WS_REFRESH_THROTTLE_MS) {
      return
    }
    lastWsRefreshAtRef.current = now
    void refreshLatestActivity()
  }, [hasMarkets, refreshLatestActivity, tokenIds])

  useMarketChannelSubscription(handleMarketChannelMessage)
}

export default function EventActivity({ event }: EventActivityProps) {
  const t = useExtracted()
  const [minAmountFilter, setMinAmountFilter] = useState('none')
  const [infiniteScrollError, setInfiniteScrollError] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  const normalizeOutcomeLabel = useOutcomeLabel()
  const isSportsEvent = Boolean(event.sports_sport_slug?.trim())

  const marketIds = useMemo(
    () => event.markets.map(market => market.condition_id).filter(Boolean),
    [event.markets],
  )
  const marketKey = useMemo(() => marketIds.join(','), [marketIds])
  const hasMarkets = marketIds.length > 0
  const tokenIds = useMemo(
    () => {
      return getEventTokenIds(event)
    },
    [event],
  )

  const queryKey = useMemo(
    () => ['event-activity', event.slug, marketKey, minAmountFilter],
    [event.slug, marketKey, minAmountFilter],
  )

  const {
    status,
    data,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam = 0, signal }) =>
      fetchEventTrades({
        marketIds,
        pageParam,
        minAmountFilter,
        signal,
      }),
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length === EVENT_ACTIVITY_PAGE_SIZE) {
        return allPages.reduce((total, page) => total + page.length, 0)
      }

      return undefined
    },
    initialPageParam: 0,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
    enabled: hasMarkets,
  })

  const activities: ActivityOrder[] = data?.pages.flat() ?? []
  const loading = hasMarkets && status === 'pending'
  const hasInitialError = hasMarkets && status === 'error'

  useInfiniteScrollSentinel({
    sentinelRef: loadMoreRef,
    hasMarkets,
    hasNextPage,
    isFetchingNextPage,
    loading,
    hasError: Boolean(infiniteScrollError),
    fetchNextPage,
    setInfiniteScrollError,
    errorMessage: t('Failed to load more activity'),
  })

  useRealtimeActivityRefresh({
    hasMarkets,
    loading,
    marketIds,
    tokenIds,
    minAmountFilter,
    queryClient,
    queryKey,
  })

  function formatTotalValue(totalValueMicro: number) {
    const totalValue = totalValueMicro / MICRO_UNIT
    return formatSharePriceLabel(totalValue, { fallback: '0¢' })
  }

  function retryInfiniteScroll() {
    setInfiniteScrollError(null)
    fetchNextPage().catch((error) => {
      setInfiniteScrollError(error.message || t('Failed to load more activity'))
    })
  }

  function handleMinAmountFilterChange(nextValue: string) {
    setInfiniteScrollError(null)
    setMinAmountFilter(nextValue)
  }

  if (!hasMarkets) {
    return (
      <div className="mt-2">
        <AlertBanner title={t('No market available for this event')} />
      </div>
    )
  }

  if (hasInitialError) {
    return (
      <div className="mt-2">
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
    )
  }

  return (
    <div className="mt-2 grid gap-6">
      <div className="flex items-center justify-between gap-2">
        <Select value={minAmountFilter} onValueChange={handleMinAmountFilterChange}>
          <SelectTrigger className="dark:bg-transparent">
            <SelectValue placeholder={t('Min Amount:')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t('None')}</SelectItem>
            <SelectItem value="10">$10</SelectItem>
            <SelectItem value="100">$100</SelectItem>
            <SelectItem value="1000">$1,000</SelectItem>
            <SelectItem value="10000">$10,000</SelectItem>
            <SelectItem value="100000">$100,000</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading && (
        <div className="overflow-hidden">
          <ProfileLinkSkeleton
            showTrailing={true}
            usernameMaxWidthClassName="max-w-65"
            trailingWidthClassName="w-14"
          />
          <ProfileLinkSkeleton
            showTrailing={true}
            usernameMaxWidthClassName="max-w-65"
            trailingWidthClassName="w-14"
          />
          <ProfileLinkSkeleton
            showTrailing={true}
            usernameMaxWidthClassName="max-w-65"
            trailingWidthClassName="w-14"
          />
        </div>
      )}

      {!loading && activities.length === 0 && (
        <div className="text-center">
          <div className="text-sm text-muted-foreground">
            {minAmountFilter && minAmountFilter !== 'none'
              ? t('No activity found with minimum amount of {amount}.', {
                  amount: formatCurrency(Number.parseInt(minAmountFilter, 10) || 0, { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
                })
              : t('No trading activity yet for this event.')}
          </div>
          {minAmountFilter && minAmountFilter !== 'none' && (
            <div className="mt-2 text-xs text-muted-foreground">
              {t('Try lowering the minimum amount filter to see more activity.')}
            </div>
          )}
        </div>
      )}

      {!loading && activities.length > 0 && (
        <div className="overflow-hidden">
          <div className="divide-y divide-border/80">
            {activities.map((activity) => {
              const timeAgoLabel = formatTimeAgo(activity.created_at)
              const txUrl = activity.tx_hash ? `${POLYGON_SCAN_BASE}/tx/${activity.tx_hash}` : null
              const priceLabel = formatSharePriceLabel(Number(activity.price))
              const valueLabel = formatTotalValue(activity.total_value)
              const amountLabel = fromMicro(activity.amount)
              const outcomeColorClass = isSportsEvent
                ? 'text-primary'
                : (activity.outcome.text || '').toLowerCase() === 'yes'
                    ? 'text-yes'
                    : 'text-no'
              const rawUsername = activity.user.username
                || activity.user.address
                || 'trader'
              const normalizedUsername = rawUsername.startsWith('@')
                ? rawUsername.slice(1)
                : rawUsername
              const displayImage = activity.user.image || ''

              return (
                <div
                  key={resolveActivityRowKey(activity)}
                >
                  <ProfileLink
                    user={{
                      image: displayImage,
                      username: normalizedUsername,
                      address: activity.user.address,
                    }}
                    layout="inline"
                    joinedAt={activity.user.created_at}
                    usernameClassName="font-semibold text-foreground"
                    usernameMaxWidthClassName="max-w-44 sm:max-w-56"
                    containerClassName="px-3 py-2.5 text-sm leading-tight text-foreground sm:px-4"
                    trailing={(
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="whitespace-nowrap">
                          {timeAgoLabel}
                        </span>
                        {txUrl && (
                          <a
                            href={txUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={t('View transaction on Polygonscan')}
                            className="transition-colors hover:text-foreground"
                          >
                            <ExternalLinkIcon className="size-3.5" />
                          </a>
                        )}
                      </div>
                    )}
                    inlineContent={(
                      <>
                        <span className="text-foreground">
                          {activity.side === 'buy' ? t('bought') : t('sold')}
                          {' '}
                        </span>
                        <span className={cn('font-semibold', outcomeColorClass)}>
                          {amountLabel}
                          {' '}
                          {activity.outcome.text ? ` ${normalizeOutcomeLabel(activity.outcome.text)}` : ''}
                          {' '}
                          {' '}
                        </span>
                        <span className="text-foreground">
                          {t('at')}
                          {' '}
                        </span>
                        <span className="font-semibold text-foreground">
                          {priceLabel}
                          {' '}
                        </span>
                        <span className="text-muted-foreground">
                          (
                          {valueLabel}
                          )
                        </span>
                      </>
                    )}
                  />
                </div>
              )
            })}
          </div>

          {isFetchingNextPage && (
            <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" />
              {t('Loading more...')}
            </div>
          )}

          {infiniteScrollError && (
            <div className="bg-destructive/5 p-4">
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
        </div>
      )}
    </div>
  )
}
