'use client'

import type { InfiniteData } from '@tanstack/react-query'
import type { FilterState } from '@/app/[locale]/(platform)/_providers/FilterProvider'
import type { Event } from '@/types'
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { useEffect, useMemo, useRef, useState } from 'react'
import EventCardSkeleton from '@/app/[locale]/(platform)/(home)/_components/EventCardSkeleton'
import EventsGridSkeleton from '@/app/[locale]/(platform)/(home)/_components/EventsGridSkeleton'
import EventsStaticGrid from '@/app/[locale]/(platform)/(home)/_components/EventsStaticGrid'
import EventsEmptyState from '@/app/[locale]/(platform)/event/[slug]/_components/EventsEmptyState'
import { useEventLastTrades } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventLastTrades'
import { useEventMarketQuotes } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventMidPrices'
import { buildMarketTargets } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventPriceHistory'
import { useColumns } from '@/hooks/useColumns'
import { useCurrentTimestamp } from '@/hooks/useCurrentTimestamp'
import { useDebounce } from '@/hooks/useDebounce'
import { useHasHydrated } from '@/hooks/useHasHydrated'
import { fetchEventsApi } from '@/lib/events-api'
import { HOME_EVENTS_PAGE_SIZE, isHomeEventResolvedLike } from '@/lib/home-events'
import { resolveDisplayPrice } from '@/lib/market-chance'
import { buildHomeSportsMoneylineModel } from '@/lib/sports-home-card'
import { useUser } from '@/stores/useUser'

interface EventsGridProps {
  filters: FilterState
  initialEvents: Event[]
  initialCurrentTimestamp: number | null
  maxColumns?: number
  onClearFilters?: () => void
  routeMainTag: string
  routeTag: string
}

const EMPTY_EVENTS: Event[] = []
const EMPTY_PRICE_OVERRIDES: Record<string, number> = {}
const eventsSnapshotCache = new Map<string, Event[]>()
const EVENTS_SNAPSHOT_CACHE_LIMIT = 24
const HOME_LIVE_PRICE_OBSERVER_ROOT_MARGIN = '200px 0px'
const HOME_LIVE_OVERRIDE_SETTLE_DELAY_MS = 2_000
const HOME_FEED_REFRESH_INTERVAL_MS = 60_000

function resolveCardMarkets(event: Event) {
  const activeMarkets = isHomeEventResolvedLike(event)
    ? event.markets
    : event.markets.filter(market => !market.is_resolved && !market.condition?.resolved)

  return activeMarkets.length > 0 ? activeMarkets : event.markets
}

function resolveHomeCardMarkets(event: Event) {
  const sportsMoneylineModel = buildHomeSportsMoneylineModel(event)
  if (!sportsMoneylineModel) {
    return resolveCardMarkets(event)
  }

  const marketIds = new Set([
    sportsMoneylineModel.team1Button.conditionId,
    sportsMoneylineModel.team2Button.conditionId,
    sportsMoneylineModel.drawButton?.conditionId,
  ].filter(Boolean))

  const matchingMarkets = event.markets.filter(market => marketIds.has(market.condition_id))
  return matchingMarkets.length > 0 ? matchingMarkets : resolveCardMarkets(event)
}

function peekEventsSnapshot(key: string) {
  return eventsSnapshotCache.get(key) ?? null
}

function setEventsSnapshot(key: string, events: Event[]) {
  if (events.length === 0) {
    eventsSnapshotCache.delete(key)
    return
  }

  if (eventsSnapshotCache.has(key)) {
    eventsSnapshotCache.delete(key)
  }

  eventsSnapshotCache.set(key, events)

  while (eventsSnapshotCache.size > EVENTS_SNAPSHOT_CACHE_LIMIT) {
    const oldestKey = eventsSnapshotCache.keys().next().value
    if (!oldestKey) {
      break
    }

    eventsSnapshotCache.delete(oldestKey)
  }
}

async function fetchEvents({
  pageParam = 0,
  currentTimestamp,
  filters,
  locale,
}: {
  currentTimestamp: number | null
  pageParam: number
  filters: FilterState
  locale: string
}): Promise<Event[]> {
  return fetchEventsApi({
    tag: filters.tag,
    mainTag: filters.mainTag,
    search: filters.search,
    bookmarked: filters.bookmarked,
    frequency: filters.frequency,
    homeFeed: true,
    status: filters.status,
    offset: pageParam,
    locale,
    currentTimestamp,
    hideSports: filters.hideSports,
    hideCrypto: filters.hideCrypto,
    hideEarnings: filters.hideEarnings,
  })
}

interface UseEventsRefetchOnTimestampParams {
  queryRunKey: string
  resolvedCurrentTimestamp: number | null
  status: string
  isFetching: boolean
  isFetchingNextPage: boolean
  refetch: () => Promise<unknown>
  shouldAutoRefreshEvents: boolean
}

function useEventsRefetchOnTimestamp({
  queryRunKey,
  resolvedCurrentTimestamp,
  status,
  isFetching,
  isFetchingNextPage,
  refetch,
  shouldAutoRefreshEvents,
}: UseEventsRefetchOnTimestampParams) {
  const queryTimestampRef = useRef<{
    key: string
    timestamp: number | null
  }>({
    key: queryRunKey,
    timestamp: resolvedCurrentTimestamp,
  })

  useEffect(function syncQueryTimestampForCurrentQueryKey() {
    if (queryTimestampRef.current.key === queryRunKey) {
      return
    }

    queryTimestampRef.current = {
      key: queryRunKey,
      timestamp: resolvedCurrentTimestamp,
    }
  }, [queryRunKey, resolvedCurrentTimestamp])

  useEffect(function refetchEventsWhenTimestampWindowElapses() {
    if (!shouldAutoRefreshEvents || status !== 'success') {
      return
    }

    if (resolvedCurrentTimestamp == null) {
      return
    }

    if (queryTimestampRef.current.timestamp == null) {
      queryTimestampRef.current = {
        key: queryRunKey,
        timestamp: resolvedCurrentTimestamp,
      }

      if (!isFetching && !isFetchingNextPage) {
        void refetch()
      }

      return
    }

    if (resolvedCurrentTimestamp <= queryTimestampRef.current.timestamp) {
      return
    }

    if ((resolvedCurrentTimestamp - queryTimestampRef.current.timestamp) < HOME_FEED_REFRESH_INTERVAL_MS) {
      return
    }

    if (isFetching || isFetchingNextPage) {
      return
    }

    queryTimestampRef.current = {
      key: queryRunKey,
      timestamp: resolvedCurrentTimestamp,
    }

    void refetch()
  }, [
    isFetching,
    isFetchingNextPage,
    queryRunKey,
    refetch,
    resolvedCurrentTimestamp,
    shouldAutoRefreshEvents,
    status,
  ])
}

interface UseEventsListParams {
  data: InfiniteData<Event[], unknown> | undefined
  snapshotKey: string
  status: string
  initialSnapshotEvents: Event[]
}

function useEventsList({
  data,
  snapshotKey,
  status,
  initialSnapshotEvents,
}: UseEventsListParams) {
  const allEvents = useMemo(() => (data ? data.pages.flat() : []), [data])
  const visibleEvents = useMemo(
    () => (allEvents.length === 0 ? EMPTY_EVENTS : allEvents),
    [allEvents],
  )
  const cachedSnapshotEvents = useMemo(
    () => peekEventsSnapshot(snapshotKey) ?? initialSnapshotEvents,
    [initialSnapshotEvents, snapshotKey],
  )

  useEffect(function persistVisibleEventsSnapshot() {
    if (visibleEvents.length === 0) {
      return
    }

    setEventsSnapshot(snapshotKey, visibleEvents)
  }, [snapshotKey, visibleEvents])

  useEffect(function clearStaleEventsSnapshotOnEmptySuccess() {
    if (status !== 'success' || visibleEvents.length > 0) {
      return
    }

    eventsSnapshotCache.delete(snapshotKey)
  }, [snapshotKey, status, visibleEvents.length])

  return { allEvents, visibleEvents, cachedSnapshotEvents }
}

function useHomeLivePriceVisibility(hydrationSafeEventsToRender: Event[]) {
  const parentRef = useRef<HTMLDivElement | null>(null)
  const [livePriceEventIds, setLivePriceEventIds] = useState<string[]>([])

  useEffect(function observeVisibleHomeEventCards() {
    if (!parentRef.current || hydrationSafeEventsToRender.length === 0) {
      return
    }

    const observedIds = new Set<string>()
    const cardElements = Array.from(parentRef.current.querySelectorAll<HTMLElement>('[data-home-event-id]'))

    if (cardElements.length === 0) {
      return
    }

    const observer = new IntersectionObserver((entries) => {
      let hasChanges = false

      entries.forEach((entry) => {
        const eventId = entry.target.getAttribute('data-home-event-id')
        if (!eventId) {
          return
        }

        if (entry.isIntersecting) {
          if (!observedIds.has(eventId)) {
            observedIds.add(eventId)
            hasChanges = true
          }
          return
        }

        if (observedIds.delete(eventId)) {
          hasChanges = true
        }
      })

      if (hasChanges) {
        setLivePriceEventIds(Array.from(observedIds))
      }
    }, { rootMargin: HOME_LIVE_PRICE_OBSERVER_ROOT_MARGIN })

    cardElements.forEach(element => observer.observe(element))

    return function disconnectHomeEventCardObserver() {
      observer.disconnect()
    }
  }, [hydrationSafeEventsToRender])

  return { parentRef, livePriceEventIds }
}

interface UseHomeLivePriceOverridesParams {
  hydrationSafeEventsToRender: Event[]
  livePriceEventIds: string[]
}

function useHomeLivePriceOverrides({
  hydrationSafeEventsToRender,
  livePriceEventIds,
}: UseHomeLivePriceOverridesParams) {
  const livePriceEvents = useMemo(
    () => hydrationSafeEventsToRender.filter(event => livePriceEventIds.includes(String(event.id))),
    [hydrationSafeEventsToRender, livePriceEventIds],
  )
  const marketTargets = useMemo(
    () => livePriceEvents.flatMap(event => buildMarketTargets(resolveHomeCardMarkets(event))),
    [livePriceEvents],
  )
  const marketQuotesByMarket = useEventMarketQuotes(marketTargets)
  const lastTradesByMarket = useEventLastTrades(marketTargets)
  const priceOverridesByMarket = useMemo(() => {
    if (livePriceEvents.length === 0) {
      return EMPTY_PRICE_OVERRIDES
    }

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
    livePriceEvents.forEach((event) => {
      const displayMarkets = resolveHomeCardMarkets(event)
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
  }, [lastTradesByMarket, livePriceEvents, marketQuotesByMarket])
  const priceOverrideSignature = useMemo(
    () => Object.entries(priceOverridesByMarket)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([marketId, price]) => `${marketId}:${price}`)
      .join('|'),
    [priceOverridesByMarket],
  )
  const debouncedPriceOverridesByMarket = useDebounce(priceOverridesByMarket, HOME_LIVE_OVERRIDE_SETTLE_DELAY_MS)
  const stablePriceOverridesByMarket = priceOverrideSignature
    ? debouncedPriceOverridesByMarket
    : EMPTY_PRICE_OVERRIDES

  return { stablePriceOverridesByMarket }
}

interface UseInfiniteScrollLoadMoreParams {
  hasNextPage: boolean
  fetchNextPage: () => Promise<unknown>
  isFetching: boolean
  isFetchingNextPage: boolean
  loadMoreStateKey: string
}

function useInfiniteScrollLoadMore({
  hasNextPage,
  fetchNextPage,
  isFetching,
  isFetchingNextPage,
  loadMoreStateKey,
}: UseInfiniteScrollLoadMoreParams) {
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  const canRetryLoadMoreAfterErrorRef = useRef(true)
  const previousLoadMoreStateKeyRef = useRef(loadMoreStateKey)
  const [infiniteScrollErrorState, setInfiniteScrollErrorState] = useState<{
    key: string
    value: string | null
  }>({
    key: loadMoreStateKey,
    value: null,
  })
  const infiniteScrollError = infiniteScrollErrorState.key === loadMoreStateKey
    ? infiniteScrollErrorState.value
    : null

  useEffect(function resetLoadMoreRetryStateOnQueryScopeChange() {
    if (previousLoadMoreStateKeyRef.current === loadMoreStateKey) {
      return
    }

    previousLoadMoreStateKeyRef.current = loadMoreStateKey
    canRetryLoadMoreAfterErrorRef.current = true
  }, [loadMoreStateKey])

  useEffect(function observeLoadMoreSentinelForFetch() {
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

      if (isFetching || isFetchingNextPage) {
        return
      }

      if (infiniteScrollError) {
        if (!canRetryLoadMoreAfterErrorRef.current) {
          return
        }

        setInfiniteScrollErrorState({ key: loadMoreStateKey, value: null })
      }

      fetchNextPage().catch((error: any) => {
        if (error?.name === 'CanceledError' || error?.name === 'AbortError') {
          return
        }

        canRetryLoadMoreAfterErrorRef.current = false
        setInfiniteScrollErrorState({
          key: loadMoreStateKey,
          value: error?.message || 'Failed to load more events.',
        })
      })
    }, { rootMargin: '200px 0px' })

    observer.observe(loadMoreRef.current)
    return function disconnectLoadMoreObserver() {
      observer.disconnect()
    }
  }, [fetchNextPage, hasNextPage, infiniteScrollError, isFetching, isFetchingNextPage, loadMoreStateKey])

  return { loadMoreRef, infiniteScrollError }
}

export default function EventsGrid({
  filters,
  initialEvents = EMPTY_EVENTS,
  initialCurrentTimestamp,
  maxColumns,
  onClearFilters,
  routeMainTag,
  routeTag,
}: EventsGridProps) {
  const locale = useLocale()
  const user = useUser()
  const queryUserScope = user?.id ?? 'guest'
  const currentTimestamp = useCurrentTimestamp({
    initialTimestamp: initialCurrentTimestamp,
    intervalMs: HOME_FEED_REFRESH_INTERVAL_MS,
  })
  const hasHydrated = useHasHydrated()
  const snapshotKey = [
    locale,
    routeMainTag,
    routeTag,
    filters.tag,
    filters.mainTag,
    filters.search,
    filters.bookmarked ? 'bookmarked' : 'all-events',
    queryUserScope,
    filters.frequency,
    filters.status,
    filters.hideSports ? 'hide-sports' : 'show-sports',
    filters.hideCrypto ? 'hide-crypto' : 'show-crypto',
    filters.hideEarnings ? 'hide-earnings' : 'show-earnings',
  ].join(':')
  const isRouteInitialState = filters.tag === routeTag
    && filters.mainTag === routeMainTag
    && filters.search === ''
    && !filters.bookmarked
    && filters.frequency === 'all'
    && filters.status === 'active'
    && !filters.hideSports
    && !filters.hideCrypto
    && !filters.hideEarnings
  const initialSnapshotEvents = isRouteInitialState ? initialEvents : EMPTY_EVENTS
  const PAGE_SIZE = HOME_EVENTS_PAGE_SIZE
  const shouldUseInitialData = isRouteInitialState
    && initialEvents.length > 0
    && queryUserScope === 'guest'
  const shouldAutoRefreshEvents = filters.status === 'active'
  const resolvedCurrentTimestamp = currentTimestamp ?? initialCurrentTimestamp
  const queryRunKey = snapshotKey
  const loadMoreStateKey = [
    filters.tag,
    filters.mainTag,
    filters.search,
    filters.bookmarked ? 'bookmarked' : 'all-events',
    filters.frequency,
    filters.status,
    filters.hideSports ? 'hide-sports' : 'show-sports',
    filters.hideCrypto ? 'hide-crypto' : 'show-crypto',
    filters.hideEarnings ? 'hide-earnings' : 'show-earnings',
    locale,
    queryUserScope,
  ].join(':')

  const eventsQueryKey = [
    'events',
    filters.tag,
    filters.mainTag,
    filters.search,
    filters.bookmarked,
    filters.frequency,
    filters.status,
    filters.hideSports,
    filters.hideCrypto,
    filters.hideEarnings,
    locale,
    queryUserScope,
  ]

  const {
    status,
    data,
    dataUpdatedAt,
    isFetching,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
    isPending,
    refetch,
  } = useInfiniteQuery({
    queryKey: eventsQueryKey,
    queryFn: ({ pageParam }) => fetchEvents({
      pageParam,
      currentTimestamp: resolvedCurrentTimestamp,
      filters,
      locale,
    }),
    getNextPageParam: (lastPage, allPages) => lastPage.length === PAGE_SIZE ? allPages.length * PAGE_SIZE : undefined,
    initialPageParam: 0,
    initialData: shouldUseInitialData ? { pages: [initialEvents], pageParams: [0] } : undefined,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 'static',
    initialDataUpdatedAt: 0,
    placeholderData: keepPreviousData,
  })

  useEventsRefetchOnTimestamp({
    queryRunKey,
    resolvedCurrentTimestamp,
    status,
    isFetching,
    isFetchingNextPage,
    refetch,
    shouldAutoRefreshEvents,
  })

  const { allEvents, visibleEvents, cachedSnapshotEvents } = useEventsList({
    data,
    snapshotKey,
    status,
    initialSnapshotEvents,
  })

  const columns = useColumns(maxColumns)
  const loadingMoreColumns = Math.max(1, columns)
  const hasFreshQueryData = !shouldUseInitialData || dataUpdatedAt > 0
  const shouldShowSnapshotFallback = visibleEvents.length === 0
    && cachedSnapshotEvents.length > 0
    && status !== 'success'
  const eventsToRender = shouldShowSnapshotFallback ? cachedSnapshotEvents : visibleEvents
  const hydrationSafeEventsToRender = !hasHydrated && isRouteInitialState
    ? initialEvents
    : eventsToRender

  const { parentRef, livePriceEventIds } = useHomeLivePriceVisibility(hydrationSafeEventsToRender)
  const { stablePriceOverridesByMarket } = useHomeLivePriceOverrides({
    hydrationSafeEventsToRender,
    livePriceEventIds,
  })

  const isLoadingNewData = eventsToRender.length === 0
    && (isPending || (isFetching && !isFetchingNextPage && (!data || data.pages.length === 0)))

  const { loadMoreRef, infiniteScrollError } = useInfiniteScrollLoadMore({
    hasNextPage,
    fetchNextPage,
    isFetching,
    isFetchingNextPage,
    loadMoreStateKey,
  })

  if (isLoadingNewData) {
    return (
      <div ref={parentRef}>
        <EventsGridSkeleton maxColumns={maxColumns} />
      </div>
    )
  }

  if (status === 'error') {
    return (
      <p className="text-center text-sm text-muted-foreground">
        Could not load more events.
      </p>
    )
  }

  if (hydrationSafeEventsToRender.length === 0 && (!allEvents || allEvents.length === 0)) {
    return <EventsEmptyState tag={filters.tag} searchQuery={filters.search} onClearFilters={onClearFilters} />
  }

  if (hydrationSafeEventsToRender.length === 0) {
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
    <div ref={parentRef} className="w-full space-y-3 transition-opacity duration-200">
      <EventsStaticGrid
        events={hydrationSafeEventsToRender}
        priceOverridesByMarket={hasHydrated ? stablePriceOverridesByMarket : EMPTY_PRICE_OVERRIDES}
        maxColumns={maxColumns}
        isFetching={(visibleEvents.length === 0) || (isFetching && hasFreshQueryData)}
        currentTimestamp={currentTimestamp}
      />

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
