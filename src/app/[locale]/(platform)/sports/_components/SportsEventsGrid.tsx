'use client'

import type { FilterState } from '@/app/[locale]/(platform)/_providers/FilterProvider'
import type { SportsSidebarMode } from '@/app/[locale]/(platform)/sports/_components/SportsSidebarMenu'
import type { Event } from '@/types'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { useEffect, useMemo, useRef, useState } from 'react'
import EventCard from '@/app/[locale]/(platform)/(home)/_components/EventCard'
import EventCardSkeleton from '@/app/[locale]/(platform)/(home)/_components/EventCardSkeleton'
import EventsGridSkeleton from '@/app/[locale]/(platform)/(home)/_components/EventsGridSkeleton'
import EventsEmptyState from '@/app/[locale]/(platform)/event/[slug]/_components/EventsEmptyState'
import { useEventLastTrades } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventLastTrades'
import { useEventMarketQuotes } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventMidPrices'
import { buildMarketTargets } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventPriceHistory'
import { useColumns } from '@/hooks/useColumns'
import { useCurrentTimestamp } from '@/hooks/useCurrentTimestamp'
import { fetchEventsApi } from '@/lib/events-api'
import { filterHomeEvents, HOME_EVENTS_PAGE_SIZE, isEventResolvedLike } from '@/lib/home-events'
import { resolveDisplayPrice } from '@/lib/market-chance'
import { cn } from '@/lib/utils'
import { useUser } from '@/stores/useUser'

interface SportsEventsGridProps {
  filters: FilterState
  initialEvents: Event[]
  initialMode?: SportsSidebarMode
  sportsSportSlug?: string | null
  sportsSection?: 'games' | 'props' | null
}

const EMPTY_EVENTS: Event[] = []
const EMPTY_PRICE_OVERRIDES: Record<string, number> = {}
const SPORTS_LIVE_OVERRIDE_SETTLE_DELAY_MS = 2_000

function resolveSportsCardMarkets(event: Event) {
  const activeMarkets = isEventResolvedLike(event)
    ? event.markets
    : event.markets.filter(market => !market.is_resolved && !market.condition?.resolved)

  return activeMarkets.length > 0 ? activeMarkets : event.markets
}

function toTimestamp(value: string | null | undefined) {
  if (!value) {
    return Number.NEGATIVE_INFINITY
  }

  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY
}

function resolveEventStartTimestamp(event: Event) {
  const fromStartDate = toTimestamp(event.start_date ?? null)
  if (Number.isFinite(fromStartDate)) {
    return fromStartDate
  }

  return toTimestamp(event.created_at)
}

function resolveEventEndTimestamp(event: Event) {
  const fromEndDate = toTimestamp(event.end_date ?? null)
  if (Number.isFinite(fromEndDate)) {
    return fromEndDate
  }

  const marketEndTimestamps = event.markets
    .map(market => toTimestamp(market.end_time ?? null))
    .filter(timestamp => Number.isFinite(timestamp))

  if (marketEndTimestamps.length === 0) {
    return Number.NEGATIVE_INFINITY
  }

  return Math.max(...marketEndTimestamps)
}

function isEventLiveNow(event: Event, nowMs: number) {
  const start = resolveEventStartTimestamp(event)
  const end = resolveEventEndTimestamp(event)
  return start <= nowMs && nowMs <= end && event.status === 'active'
}

function isEventFuture(event: Event, nowMs: number) {
  const start = resolveEventStartTimestamp(event)
  return start > nowMs && event.status === 'active'
}

async function fetchEvents({
  pageParam = 0,
  filters,
  locale,
  sportsSportSlug,
  sportsSection,
}: {
  pageParam: number
  filters: FilterState
  locale: string
  sportsSportSlug: string | null
  sportsSection: 'games' | 'props' | null
}): Promise<Event[]> {
  return fetchEventsApi({
    tag: 'sports',
    search: filters.search,
    bookmarked: filters.bookmarked,
    frequency: filters.frequency,
    status: filters.status,
    offset: pageParam,
    locale,
    hideSports: filters.hideSports,
    hideCrypto: filters.hideCrypto,
    hideEarnings: filters.hideEarnings,
    sportsSportSlug,
    sportsSection,
  })
}

export default function SportsEventsGrid({
  filters,
  initialEvents = EMPTY_EVENTS,
  initialMode = 'all',
  sportsSportSlug = null,
  sportsSection = null,
}: SportsEventsGridProps) {
  const locale = useLocale()
  const parentRef = useRef<HTMLDivElement | null>(null)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  const canRetryLoadMoreAfterErrorRef = useRef(true)
  const user = useUser()
  const userCacheKey = user?.id ?? 'guest'
  const [infiniteScrollError, setInfiniteScrollError] = useState<string | null>(null)
  const [sportsMode, setSportsMode] = useState<SportsSidebarMode>(initialMode)
  const currentTimestamp = useCurrentTimestamp({ intervalMs: 60_000 })
  const PAGE_SIZE = HOME_EVENTS_PAGE_SIZE
  const normalizedSportsSportSlug = sportsSportSlug?.trim().toLowerCase() || null
  const isDefaultState = filters.search === ''
    && !filters.bookmarked
    && filters.frequency === 'all'
    && filters.status === 'active'
  const shouldUseInitialData = isDefaultState && initialEvents.length > 0
  const shouldAutoRefreshEvents = filters.status === 'active'

  const {
    status,
    data,
    isFetching,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
    isPending,
    refetch,
  } = useInfiniteQuery({
    queryKey: [
      'events',
      filters.search,
      filters.bookmarked,
      filters.frequency,
      filters.status,
      filters.hideSports,
      filters.hideCrypto,
      filters.hideEarnings,
      locale,
      userCacheKey,
      normalizedSportsSportSlug,
      sportsSection,
    ],
    queryFn: ({ pageParam }) => fetchEvents({
      pageParam,
      filters,
      locale,
      sportsSportSlug: normalizedSportsSportSlug,
      sportsSection,
    }),
    getNextPageParam: (lastPage, allPages) => lastPage.length === PAGE_SIZE ? allPages.length * PAGE_SIZE : undefined,
    initialPageParam: 0,
    initialData: shouldUseInitialData ? { pages: [initialEvents], pageParams: [0] } : undefined,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 'static',
    refetchInterval: shouldAutoRefreshEvents ? 60_000 : false,
    refetchIntervalInBackground: true,
    initialDataUpdatedAt: 0,
    placeholderData: previousData => previousData,
  })

  const previousUserKeyRef = useRef(userCacheKey)
  const [stablePriceOverridesByMarket, setStablePriceOverridesByMarket] = useState<Record<string, number>>(EMPTY_PRICE_OVERRIDES)
  const pendingPriceOverrideSignatureRef = useRef<string>('')
  const priceOverrideCommitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (previousUserKeyRef.current === userCacheKey) {
      return
    }

    previousUserKeyRef.current = userCacheKey
    void refetch()
  }, [refetch, userCacheKey])

  useEffect(() => {
    setSportsMode(initialMode)
  }, [initialMode])

  useEffect(() => {
    setInfiniteScrollError(null)
    canRetryLoadMoreAfterErrorRef.current = true
  }, [
    filters.bookmarked,
    filters.frequency,
    filters.hideCrypto,
    filters.hideEarnings,
    filters.hideSports,
    filters.search,
    filters.status,
    locale,
    normalizedSportsSportSlug,
    sportsMode,
    sportsSection,
    userCacheKey,
  ])

  const allEvents = useMemo(() => (data ? data.pages.flat() : []), [data])

  const filteredEvents = useMemo(() => {
    if (!allEvents || allEvents.length === 0) {
      return EMPTY_EVENTS
    }

    return filterHomeEvents(allEvents, {
      currentTimestamp,
      hideSports: filters.hideSports,
      hideCrypto: filters.hideCrypto,
      hideEarnings: filters.hideEarnings,
      status: filters.status,
    })
  }, [allEvents, currentTimestamp, filters.hideSports, filters.hideCrypto, filters.hideEarnings, filters.status])

  const sportsBaseEvents = useMemo(() => {
    return filteredEvents
  }, [filteredEvents])
  const sportsModeEvents = useMemo(() => {
    if (sportsMode === 'all') {
      return sportsBaseEvents
    }

    if (currentTimestamp == null) {
      return sportsBaseEvents
    }

    if (sportsMode === 'live') {
      return sportsBaseEvents.filter(event => isEventLiveNow(event, currentTimestamp))
    }

    return sportsBaseEvents.filter(event => isEventFuture(event, currentTimestamp))
  }, [currentTimestamp, sportsBaseEvents, sportsMode])
  const visibleEvents = sportsModeEvents
  const marketTargets = useMemo(
    () => visibleEvents.flatMap(event => buildMarketTargets(resolveSportsCardMarkets(event))),
    [visibleEvents],
  )
  const marketQuotesByMarket = useEventMarketQuotes(marketTargets)
  const lastTradesByMarket = useEventLastTrades(marketTargets)
  const priceOverridesByMarket = useMemo(() => {
    const strictPriceByMarket: Record<string, number> = {}
    Object.keys({ ...marketQuotesByMarket, ...lastTradesByMarket }).forEach((conditionId) => {
      const quote = marketQuotesByMarket[conditionId]
      const lastTrade = lastTradesByMarket[conditionId]
      const displayPrice = resolveDisplayPrice({
        bid: quote?.bid ?? null,
        ask: quote?.ask ?? null,
        midpoint: quote?.mid ?? null,
        lastTrade,
        strictFallbacks: true,
      })

      if (displayPrice != null) {
        strictPriceByMarket[conditionId] = displayPrice
      }
    })

    const nextOverrides: Record<string, number> = {}
    visibleEvents.forEach((event) => {
      const displayMarkets = resolveSportsCardMarkets(event)
      if (displayMarkets.length === 0) {
        return
      }

      displayMarkets.forEach((market) => {
        const displayPrice = strictPriceByMarket[market.condition_id]
        if (displayPrice != null) {
          nextOverrides[market.condition_id] = displayPrice
        }
      })
    })

    return nextOverrides
  }, [lastTradesByMarket, marketQuotesByMarket, visibleEvents])
  const priceOverrideSignature = useMemo(
    () => Object.entries(priceOverridesByMarket)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([marketId, price]) => `${marketId}:${price}`)
      .join('|'),
    [priceOverridesByMarket],
  )

  const columns = useColumns()
  const activeColumns = columns >= 3 ? columns - 1 : columns
  const loadingMoreColumns = Math.max(1, activeColumns)

  const isLoadingNewData = isPending || (isFetching && !isFetchingNextPage && (!data || data.pages.length === 0))

  useEffect(() => {
    if (priceOverrideCommitTimeoutRef.current) {
      clearTimeout(priceOverrideCommitTimeoutRef.current)
      priceOverrideCommitTimeoutRef.current = null
    }

    if (!priceOverrideSignature) {
      pendingPriceOverrideSignatureRef.current = ''
      setStablePriceOverridesByMarket(current => (Object.keys(current).length === 0 ? current : EMPTY_PRICE_OVERRIDES))
      return
    }

    pendingPriceOverrideSignatureRef.current = priceOverrideSignature
    const nextOverrides = priceOverridesByMarket
    priceOverrideCommitTimeoutRef.current = setTimeout(() => {
      if (pendingPriceOverrideSignatureRef.current !== priceOverrideSignature) {
        return
      }

      setStablePriceOverridesByMarket((current) => {
        const currentSignature = Object.entries(current)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([marketId, price]) => `${marketId}:${price}`)
          .join('|')

        return currentSignature === priceOverrideSignature ? current : nextOverrides
      })
    }, SPORTS_LIVE_OVERRIDE_SETTLE_DELAY_MS)

    return () => {
      if (priceOverrideCommitTimeoutRef.current) {
        clearTimeout(priceOverrideCommitTimeoutRef.current)
        priceOverrideCommitTimeoutRef.current = null
      }
    }
  }, [priceOverrideSignature, priceOverridesByMarket])

  useEffect(() => {
    if (!loadMoreRef.current || !hasNextPage) {
      return
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry) {
        return
      }

      if (!entry.isIntersecting) {
        canRetryLoadMoreAfterErrorRef.current = true
        return
      }

      if (isFetchingNextPage) {
        return
      }

      if (infiniteScrollError) {
        if (!canRetryLoadMoreAfterErrorRef.current) {
          return
        }

        setInfiniteScrollError(null)
      }

      fetchNextPage().catch((error: any) => {
        if (error?.name === 'CanceledError' || error?.name === 'AbortError') {
          return
        }

        canRetryLoadMoreAfterErrorRef.current = false
        setInfiniteScrollError(error?.message || 'Failed to load more events.')
      })
    }, { rootMargin: '200px 0px' })

    observer.observe(loadMoreRef.current)
    return () => observer.disconnect()
  }, [fetchNextPage, hasNextPage, infiniteScrollError, isFetchingNextPage])

  if (isLoadingNewData) {
    return (
      <div ref={parentRef}>
        <EventsGridSkeleton />
      </div>
    )
  }

  if (status === 'error') {
    return <div className="flex min-h-50 min-w-0 items-center justify-center text-sm text-muted-foreground">Could not load events.</div>
  }

  if (!allEvents || allEvents.length === 0) {
    return <EventsEmptyState tag={filters.tag} searchQuery={filters.search} />
  }

  if (!visibleEvents || visibleEvents.length === 0) {
    return (
      <div
        ref={parentRef}
        className="flex min-h-50 min-w-0 items-center justify-center text-sm text-muted-foreground"
      >
        No events match your filters.
      </div>
    )
  }

  return (
    <div ref={parentRef} className="min-w-0 flex-1 space-y-3">
      <div
        className={cn('grid gap-3', { 'opacity-80': isFetching })}
        style={{
          gridTemplateColumns: `repeat(${Math.max(1, activeColumns)}, minmax(0, 1fr))`,
        }}
      >
        {visibleEvents.map(event => (
          <EventCard
            key={event.id}
            event={event}
            priceOverridesByMarket={stablePriceOverridesByMarket}
            enableHomeSportsMoneylineLayout={false}
            currentTimestamp={currentTimestamp}
          />
        ))}
      </div>

      {isFetchingNextPage && (
        <div
          className="grid gap-3"
          style={{
            gridTemplateColumns: `repeat(${loadingMoreColumns}, minmax(0, 1fr))`,
          }}
        >
          {Array.from({ length: loadingMoreColumns }).map((_, index) => (
            <EventCardSkeleton key={`loading-more-${index}`} />
          ))}
        </div>
      )}

      {infiniteScrollError && (
        <p className="text-center text-sm text-muted-foreground">
          {infiniteScrollError}
        </p>
      )}

      {hasNextPage && <div ref={loadMoreRef} className="h-1 w-full" aria-hidden="true" />}
    </div>
  )
}
