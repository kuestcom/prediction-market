'use client'

import { useInfiniteQuery } from '@tanstack/react-query'
import { ExternalLinkIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { DataApiActivity } from '@/lib/data-api/user'
import type { ActivityOrder, Event } from '@/types'

import {
  getEventActivityQueryKey,
  getNextEventActivityPageParam,
  mergeEventActivities,
  mergeEventLiveActivities,
  resolveEventActivityOutcomeColorClass,
} from '@/app/[locale]/(platform)/event/[slug]/_components/event-activity-utils'
import { useEventActivityPolling } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventActivityPolling'
import { useEventActivityWebSocket } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventActivityWebSocket'
import AlertBanner from '@/components/AlertBanner'
import ProfileLink from '@/components/ProfileLink'
import ProfileLinkSkeleton from '@/components/ProfileLinkSkeleton'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import useLocalizedTimeAgo from '@/hooks/useLocalizedTimeAgo'
import { useNowTimestamp } from '@/hooks/useNowTimestamp'
import { useOutcomeLabel } from '@/hooks/useOutcomeLabel'
import { usePublicRuntimeConfig } from '@/hooks/usePublicRuntimeConfig'
import { filterActivitiesByMinAmount } from '@/lib/activity/filter'
import { MICRO_UNIT } from '@/lib/constants'
import { fetchEventTrades } from '@/lib/data-api/trades'
import { mapDataApiActivityToActivityOrder } from '@/lib/data-api/user'
import { formatCurrency, formatSharePriceLabel, fromMicro, toMicro } from '@/lib/formatters'
import { POLYGON_SCAN_BASE } from '@/lib/network'
import { cn } from '@/lib/utils'

interface EventActivityProps {
  event: Event
}

interface ActivityMarketLabelLookup {
  byConditionId: Map<string, string>
  bySlug: Map<string, string>
}

function getMarketDisplayLabel(market: Event['markets'][number]) {
  return market.short_title?.trim() || market.title.trim() || market.slug
}

function buildActivityMarketLabelLookup(markets: Event['markets']) {
  const byConditionId = new Map<string, string>()
  const bySlug = new Map<string, string>()

  for (const market of markets) {
    const label = getMarketDisplayLabel(market)

    if (market.condition_id) {
      byConditionId.set(market.condition_id, label)
    }
    if (market.slug) {
      bySlug.set(market.slug, label)
    }
  }

  return {
    byConditionId,
    bySlug,
  }
}

function resolveActivityMarketLabel(activity: ActivityOrder, lookup: ActivityMarketLabelLookup) {
  const conditionId = activity.market.condition_id?.trim()
  const slug = activity.market.slug?.trim()

  return (
    (conditionId ? lookup.byConditionId.get(conditionId) : undefined) ||
    (slug ? lookup.bySlug.get(slug) : undefined) ||
    activity.market.title.trim() ||
    slug ||
    ''
  )
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

const ALL_ACTIVITY_MARKETS_VALUE = 'all'

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
  useEffect(
    function observeInfiniteScrollSentinel() {
      const node = sentinelRef.current
      if (!node || !hasMarkets) {
        return
      }

      const observer = new IntersectionObserver(
        function handleSentinelIntersection(entries) {
          const entry = entries[0]
          if (entry?.isIntersecting && hasNextPage && !isFetchingNextPage && !loading && !hasError) {
            fetchNextPage().catch((error) => {
              setInfiniteScrollError(error.message || errorMessage)
            })
          }
        },
        { rootMargin: '200px 0px' },
      )

      observer.observe(node)
      return function unobserveInfiniteScrollSentinel() {
        observer.disconnect()
      }
    },
    [
      errorMessage,
      fetchNextPage,
      hasError,
      hasMarkets,
      hasNextPage,
      isFetchingNextPage,
      loading,
      sentinelRef,
      setInfiniteScrollError,
    ],
  )
}

export default function EventActivity({ event }: EventActivityProps) {
  const t = useExtracted()
  const { formatTimeAgo } = useLocalizedTimeAgo()
  const [minAmountFilter, setMinAmountFilter] = useState('none')
  const [activityMarketFilter, setActivityMarketFilter] = useState(ALL_ACTIVITY_MARKETS_VALUE)
  const [infiniteScrollError, setInfiniteScrollError] = useState<string | null>(null)
  const [liveActivityOrders, setLiveActivityOrders] = useState<ActivityOrder[]>([])
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  const nowTimestamp = useNowTimestamp()
  const normalizeOutcomeLabel = useOutcomeLabel()
  const { wsLiveDataUrl } = usePublicRuntimeConfig()
  const isSportsEvent = Boolean(event.sports_sport_slug?.trim())
  const isMultiMarket = event.markets.length > 1

  const allMarketIds = useMemo(
    () => event.markets.map((market) => market.condition_id).filter(Boolean),
    [event.markets],
  )
  const resolvedActivityMarketFilter =
    isMultiMarket && allMarketIds.includes(activityMarketFilter) ? activityMarketFilter : ALL_ACTIVITY_MARKETS_VALUE
  const activityMarkets = useMemo(() => {
    if (resolvedActivityMarketFilter === ALL_ACTIVITY_MARKETS_VALUE) {
      return event.markets
    }

    return event.markets.filter((market) => market.condition_id === resolvedActivityMarketFilter)
  }, [event.markets, resolvedActivityMarketFilter])
  const marketIds = useMemo(
    () => activityMarkets.map((market) => market.condition_id).filter(Boolean),
    [activityMarkets],
  )
  const activityMarketLabels = useMemo(() => buildActivityMarketLabelLookup(event.markets), [event.markets])
  const marketKey = useMemo(() => marketIds.join(','), [marketIds])
  const hasMarkets = marketIds.length > 0
  const parsedMinAmount = Number(minAmountFilter)
  const minAmountMicro =
    Number.isFinite(parsedMinAmount) && parsedMinAmount > 0 ? Number(toMicro(parsedMinAmount)) : undefined
  const queryKey = useMemo(
    () => getEventActivityQueryKey(event.slug, marketKey, resolvedActivityMarketFilter, minAmountFilter),
    [event.slug, marketKey, minAmountFilter, resolvedActivityMarketFilter],
  )
  const minAmountFilterLabel =
    minAmountFilter === 'none'
      ? t('Min amount')
      : formatCurrency(Number.parseInt(minAmountFilter, 10) || 0, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        })
  const isMinAmountFiltered = minAmountFilter !== 'none'
  const selectedActivityMarket = activityMarkets[0]
  const selectedActivityMarketLabel =
    resolvedActivityMarketFilter === ALL_ACTIVITY_MARKETS_VALUE
      ? ''
      : selectedActivityMarket
        ? getMarketDisplayLabel(selectedActivityMarket)
        : ''
  const isMarketFiltered = selectedActivityMarketLabel.length > 0

  const { status, data, isFetching, isFetchingNextPage, fetchNextPage, hasNextPage, refetch } = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam, signal }) =>
      fetchEventTrades({
        marketIds,
        pageParam: 0,
        cursorTimestamp: pageParam.cursorTimestamp,
        cursorId: pageParam.cursorId,
        cursorUser: pageParam.cursorUser,
        minAmountFilter,
        signal,
      }),
    getNextPageParam: getNextEventActivityPageParam,
    initialPageParam: {},
    staleTime: Infinity,
    gcTime: 1000 * 60 * 10,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    enabled: hasMarkets,
  })

  const filteredLiveActivityOrders = useMemo(() => {
    const marketIdSet = new Set(marketIds)
    const matchingActivities = liveActivityOrders.filter((activity) => {
      const conditionId = activity.market.condition_id
      return Boolean(conditionId && marketIdSet.has(conditionId))
    })
    return filterActivitiesByMinAmount(matchingActivities, minAmountMicro)
  }, [liveActivityOrders, marketIds, minAmountMicro])
  const activities = mergeEventActivities(filteredLiveActivityOrders, data?.pages.flat() ?? [])
  const loading = hasMarkets && status === 'pending' && activities.length === 0
  const hasInitialError = hasMarkets && status === 'error' && activities.length === 0

  const handleLiveActivities = useCallback((liveActivities: DataApiActivity[]) => {
    const mappedActivities = liveActivities.map(mapDataApiActivityToActivityOrder)
    if (mappedActivities.length === 0) {
      return
    }

    setLiveActivityOrders((current) => mergeEventLiveActivities(current, mappedActivities))
  }, [])

  const handleRefreshedActivities = useCallback((latestActivities: ActivityOrder[]) => {
    if (latestActivities.length === 0) {
      return
    }

    setLiveActivityOrders((current) => mergeEventLiveActivities(current, latestActivities))
  }, [])

  useEventActivityWebSocket({
    eventSlug: event.slug,
    onActivities: handleLiveActivities,
    wsUrl: wsLiveDataUrl,
  })

  useEventActivityPolling({
    hasMarkets,
    isActivityQueryFetching: isFetching,
    marketIds,
    minAmountFilter,
    onActivities: handleRefreshedActivities,
  })

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

  function handleActivityMarketFilterChange(nextValue: string) {
    setInfiniteScrollError(null)
    setActivityMarketFilter(nextValue)
  }

  function resolveEmptyActivityMessage() {
    if (isMarketFiltered && isMinAmountFiltered) {
      return t('No activity found for {market} with minimum amount of {amount}.', {
        amount: minAmountFilterLabel,
        market: selectedActivityMarketLabel,
      })
    }

    if (isMarketFiltered) {
      return t('No trading activity yet for {market}.', {
        market: selectedActivityMarketLabel,
      })
    }

    if (isMinAmountFiltered) {
      return t('No activity found with minimum amount of {amount}.', {
        amount: minAmountFilterLabel,
      })
    }

    return t('No trading activity yet for this event.')
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
          description={
            <Button type="button" onClick={() => refetch()} size="sm" variant="link" className="-ml-3">
              {t('Try again')}
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="mt-2 grid gap-6">
      <div className="flex flex-row items-center gap-2">
        {isMultiMarket && (
          <Select
            items={[
              { label: t('All'), value: ALL_ACTIVITY_MARKETS_VALUE },
              ...event.markets.map((market) => ({
                label: getMarketDisplayLabel(market),
                value: market.condition_id,
              })),
            ]}
            value={resolvedActivityMarketFilter}
            onValueChange={(value) => value !== null && handleActivityMarketFilterChange(value)}
          >
            <SelectTrigger className="w-full sm:w-40 md:w-44 dark:bg-transparent">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_ACTIVITY_MARKETS_VALUE}>{t('All')}</SelectItem>
              {event.markets.map((market) => (
                <SelectItem key={market.condition_id} value={market.condition_id}>
                  {getMarketDisplayLabel(market)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={minAmountFilter} onValueChange={(value) => value !== null && handleMinAmountFilterChange(value)}>
          <SelectTrigger className="w-full sm:w-auto dark:bg-transparent">
            <SelectValue render={<span className="line-clamp-1" />}>{minAmountFilterLabel}</SelectValue>
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
          <ProfileLinkSkeleton showTrailing={true} usernameMaxWidthClassName="max-w-65" trailingWidthClassName="w-14" />
          <ProfileLinkSkeleton showTrailing={true} usernameMaxWidthClassName="max-w-65" trailingWidthClassName="w-14" />
          <ProfileLinkSkeleton showTrailing={true} usernameMaxWidthClassName="max-w-65" trailingWidthClassName="w-14" />
        </div>
      )}

      {!loading && activities.length === 0 && (
        <div className="text-center">
          <div className="text-sm text-muted-foreground">{resolveEmptyActivityMessage()}</div>
          {isMinAmountFiltered && (
            <div className="mt-2 text-xs text-muted-foreground">
              {isMarketFiltered
                ? t('Try lowering the minimum amount filter or selecting another market.')
                : t('Try lowering the minimum amount filter to see more activity.')}
            </div>
          )}
        </div>
      )}

      {!loading && activities.length > 0 && (
        <div className="overflow-hidden">
          <div className="divide-y divide-border/80">
            {activities.map((activity) => {
              const timeAgoLabel = nowTimestamp === null ? '—' : formatTimeAgo(activity.created_at, nowTimestamp)
              const txUrl = activity.tx_hash ? `${POLYGON_SCAN_BASE}/tx/${activity.tx_hash}` : null
              const priceLabel = formatSharePriceLabel(Number(activity.price))
              const valueLabel = formatTotalValue(activity.total_value)
              const amountLabel = fromMicro(activity.amount)
              const outcomeColorClass = resolveEventActivityOutcomeColorClass(activity, isSportsEvent)
              const marketLabel = isMultiMarket ? resolveActivityMarketLabel(activity, activityMarketLabels) : ''
              const rawUsername = activity.user.username || activity.user.address || 'trader'
              const normalizedUsername = rawUsername.startsWith('@') ? rawUsername.slice(1) : rawUsername
              const displayImage = activity.user.image || ''

              return (
                <div key={resolveActivityRowKey(activity)}>
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
                    trailing={
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="whitespace-nowrap">{timeAgoLabel}</span>
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
                    }
                    inlineContent={
                      <>
                        <span className="text-foreground">{activity.side === 'buy' ? t('bought') : t('sold')} </span>
                        <span className={cn('font-semibold', outcomeColorClass)}>
                          {amountLabel}
                          {activity.outcome.text ? ` ${normalizeOutcomeLabel(activity.outcome.text)}` : ''}{' '}
                        </span>
                        {marketLabel && (
                          <>
                            <span className="text-foreground">{t('for')} </span>
                            <span className="font-semibold text-foreground">{marketLabel} </span>
                          </>
                        )}
                        <span className="text-foreground">{t('at')} </span>
                        <span className="font-semibold text-foreground">{priceLabel} </span>
                        <span className="text-muted-foreground">({valueLabel})</span>
                      </>
                    }
                  />
                </div>
              )
            })}
          </div>

          {isFetchingNextPage && (
            <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
              <Spinner className="size-4" />
              {t('Loading more...')}
            </div>
          )}

          {infiniteScrollError && (
            <div className="bg-destructive/5 p-4">
              <AlertBanner
                title={t('Failed to load more activity')}
                description={
                  <Button type="button" onClick={retryInfiniteScroll} size="sm" variant="link" className="-ml-3">
                    {t('Try again')}
                  </Button>
                }
              />
            </div>
          )}

          <div ref={loadMoreRef} className="h-1 w-full" aria-hidden />
        </div>
      )}
    </div>
  )
}
