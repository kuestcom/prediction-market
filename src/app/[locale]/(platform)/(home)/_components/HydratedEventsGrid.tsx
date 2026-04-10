'use client'

import type { FilterState } from '@/app/[locale]/(platform)/_providers/FilterProvider'
import type { Event } from '@/types'
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import EventCardSkeleton from '@/app/[locale]/(platform)/(home)/_components/EventCardSkeleton'
import EventsGridSkeleton from '@/app/[locale]/(platform)/(home)/_components/EventsGridSkeleton'
import EventsStaticGrid from '@/app/[locale]/(platform)/(home)/_components/EventsStaticGrid'
import EventsEmptyState from '@/app/[locale]/(platform)/event/[slug]/_components/EventsEmptyState'
import { useEventLastTrades } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventLastTrades'
import { useEventMarketQuotes } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventMidPrices'
import { buildMarketTargets } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventPriceHistory'
import { useColumns } from '@/hooks/useColumns'
import { useCurrentTimestamp } from '@/hooks/useCurrentTimestamp'
import { fetchEventsApi } from '@/lib/events-api'
import { HOME_EVENTS_PAGE_SIZE, isHomeEventResolvedLike } from '@/lib/home-events'
import { resolveDisplayPrice } from '@/lib/market-chance'
import { buildHomeSportsMoneylineModel } from '@/lib/sports-home-card'
import { useUser } from '@/stores/useUser'

interface HydratedEventsGridProps {
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
const hydratedEventsSnapshotCache = new Map<string, Event[]>()
const HYDRATED_EVENTS_SNAPSHOT_CACHE_LIMIT = 24
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

function peekHydratedEventsSnapshot(key: string) {
  return hydratedEventsSnapshotCache.get(key) ?? null
}

function touchHydratedEventsSnapshot(key: string) {
  const snapshot = hydratedEventsSnapshotCache.get(key) ?? null
  if (!snapshot) {
    return null
  }

  hydratedEventsSnapshotCache.delete(key)
  hydratedEventsSnapshotCache.set(key, snapshot)
  return snapshot
}

function setHydratedEventsSnapshot(key: string, events: Event[]) {
  if (events.length === 0) {
    hydratedEventsSnapshotCache.delete(key)
    return
  }

  if (hydratedEventsSnapshotCache.has(key)) {
    hydratedEventsSnapshotCache.delete(key)
  }

  hydratedEventsSnapshotCache.set(key, events)

  while (hydratedEventsSnapshotCache.size > HYDRATED_EVENTS_SNAPSHOT_CACHE_LIMIT) {
    const oldestKey = hydratedEventsSnapshotCache.keys().next().value
    if (!oldestKey) {
      break
    }

    hydratedEventsSnapshotCache.delete(oldestKey)
  }
}

function areVisibleEventsEquivalent(left: Event[], right: Event[]) {
  return left.length === right.length
    && left.every((event, index) => {
      const nextEvent = right[index]
      return (
        event.id === nextEvent?.id
        && event.is_bookmarked === nextEvent?.is_bookmarked
      )
    })
}

function subscribeToHydrationStore() {
  return function unsubscribeFromHydrationStore() {}
}

function getHydratedClientSnapshot() {
  return true
}

function getHydratedServerSnapshot() {
  return false
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

export default function HydratedEventsGrid({
  filters,
  initialEvents = EMPTY_EVENTS,
  initialCurrentTimestamp,
  maxColumns,
  onClearFilters,
  routeMainTag,
  routeTag,
}: HydratedEventsGridProps) {
  const locale = useLocale()
  const parentRef = useRef<HTMLDivElement | null>(null)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  const canRetryLoadMoreAfterErrorRef = useRef(true)
  const user = useUser()
  const queryUserScope = user?.id ?? 'guest'
  const currentTimestamp = useCurrentTimestamp({
    initialTimestamp: initialCurrentTimestamp,
    intervalMs: HOME_FEED_REFRESH_INTERVAL_MS,
  })
  const [infiniteScrollError, setInfiniteScrollError] = useState<string | null>(null)
  const hasHydrated = useSyncExternalStore(
    subscribeToHydrationStore,
    getHydratedClientSnapshot,
    getHydratedServerSnapshot,
  )
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
  const lastStableVisibleEventsRef = useRef<{
    events: Event[]
    key: string
  }>({
    events: peekHydratedEventsSnapshot(snapshotKey) ?? initialSnapshotEvents,
    key: snapshotKey,
  })
  const PAGE_SIZE = HOME_EVENTS_PAGE_SIZE
  const shouldUseInitialData = isRouteInitialState
    && initialEvents.length > 0
    && queryUserScope === 'guest'
  const shouldAutoRefreshEvents = filters.status === 'active'
  const resolvedCurrentTimestamp = currentTimestamp ?? initialCurrentTimestamp
  const queryRunKey = [
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
  const queryTimestampRef = useRef<{
    key: string
    timestamp: number | null
  }>({
    key: queryRunKey,
    timestamp: resolvedCurrentTimestamp,
  })
  const previousLoadMoreStateKeyRef = useRef(loadMoreStateKey)

  if (queryTimestampRef.current.key !== queryRunKey) {
    queryTimestampRef.current = {
      key: queryRunKey,
      timestamp: resolvedCurrentTimestamp,
    }
  }

  if (previousLoadMoreStateKeyRef.current !== loadMoreStateKey) {
    previousLoadMoreStateKeyRef.current = loadMoreStateKey
    canRetryLoadMoreAfterErrorRef.current = true

    if (infiniteScrollError !== null) {
      setInfiniteScrollError(null)
    }
  }

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
      currentTimestamp: queryTimestampRef.current.timestamp,
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

  const [livePriceEventIds, setLivePriceEventIds] = useState<string[]>([])
  const [stablePriceOverridesByMarket, setStablePriceOverridesByMarket] = useState<Record<string, number>>(EMPTY_PRICE_OVERRIDES)
  const pendingPriceOverrideSignatureRef = useRef<string>('')
  const priceOverrideCommitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
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

  const allEvents = useMemo(() => (data ? data.pages.flat() : []), [data])
  const hasFreshQueryData = !shouldUseInitialData || dataUpdatedAt > 0

  const visibleEvents = useMemo(
    () => (allEvents.length === 0 ? EMPTY_EVENTS : allEvents),
    [allEvents],
  )
  if (lastStableVisibleEventsRef.current.key !== snapshotKey) {
    lastStableVisibleEventsRef.current = {
      events: touchHydratedEventsSnapshot(snapshotKey) ?? initialSnapshotEvents,
      key: snapshotKey,
    }
  }

  if (
    visibleEvents.length > 0
    && !areVisibleEventsEquivalent(lastStableVisibleEventsRef.current.events, visibleEvents)
  ) {
    lastStableVisibleEventsRef.current = {
      events: visibleEvents,
      key: snapshotKey,
    }
  }

  if (
    status === 'success'
    && visibleEvents.length === 0
    && lastStableVisibleEventsRef.current.events.length > 0
  ) {
    lastStableVisibleEventsRef.current = {
      events: EMPTY_EVENTS,
      key: snapshotKey,
    }
  }

  useEffect(() => {
    if (visibleEvents.length === 0) {
      return
    }

    setHydratedEventsSnapshot(snapshotKey, visibleEvents)
  }, [snapshotKey, visibleEvents])

  useEffect(() => {
    if (status !== 'success' || visibleEvents.length > 0) {
      return
    }

    hydratedEventsSnapshotCache.delete(snapshotKey)
  }, [snapshotKey, status, visibleEvents.length])

  const columns = useColumns(maxColumns)
  const loadingMoreColumns = Math.max(1, columns)
  const lastStableVisibleEvents = lastStableVisibleEventsRef.current.events
  const shouldShowSnapshotFallback = visibleEvents.length === 0
    && lastStableVisibleEvents.length > 0
    && status !== 'success'
  const eventsToRender = shouldShowSnapshotFallback ? lastStableVisibleEvents : visibleEvents
  const hydrationSafeEventsToRender = !hasHydrated && isRouteInitialState
    ? initialEvents
    : eventsToRender
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
  const previousPriceOverrideSignatureRef = useRef(priceOverrideSignature)
  const isLoadingNewData = eventsToRender.length === 0
    && (isPending || (isFetching && !isFetchingNextPage && (!data || data.pages.length === 0)))

  if (
    priceOverrideSignature === ''
    && previousPriceOverrideSignatureRef.current !== ''
    && Object.keys(stablePriceOverridesByMarket).length > 0
  ) {
    setStablePriceOverridesByMarket(EMPTY_PRICE_OVERRIDES)
  }

  previousPriceOverrideSignatureRef.current = priceOverrideSignature

  useEffect(() => {
    if (priceOverrideCommitTimeoutRef.current) {
      clearTimeout(priceOverrideCommitTimeoutRef.current)
      priceOverrideCommitTimeoutRef.current = null
    }

    if (!priceOverrideSignature) {
      pendingPriceOverrideSignatureRef.current = ''
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
    }, HOME_LIVE_OVERRIDE_SETTLE_DELAY_MS)

    return () => {
      if (priceOverrideCommitTimeoutRef.current) {
        clearTimeout(priceOverrideCommitTimeoutRef.current)
        priceOverrideCommitTimeoutRef.current = null
      }
    }
  }, [priceOverrideSignature, priceOverridesByMarket])

  const renderedEventIds = useMemo(
    () => new Set(hydrationSafeEventsToRender.map(event => String(event.id))),
    [hydrationSafeEventsToRender],
  )

  if (livePriceEventIds.length > 0) {
    const nextLivePriceEventIds = livePriceEventIds.filter(eventId => renderedEventIds.has(eventId))

    if (nextLivePriceEventIds.length !== livePriceEventIds.length) {
      setLivePriceEventIds(nextLivePriceEventIds)
    }
  }

  useEffect(() => {
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

    return () => observer.disconnect()
  }, [hydrationSafeEventsToRender])

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

      if (isFetching || isFetchingNextPage) {
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
  }, [fetchNextPage, hasNextPage, infiniteScrollError, isFetching, isFetchingNextPage])

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
