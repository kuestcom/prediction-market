'use client'

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
import { filterHomeEvents, HOME_EVENTS_PAGE_SIZE } from '@/lib/home-events'
import { resolveDisplayPrice } from '@/lib/market-chance'
import { useUser } from '@/stores/useUser'

interface HydratedEventsGridProps {
  filters: FilterState
  initialEvents: Event[]
  initialCurrentTimestamp: number
  maxColumns?: number
  onClearFilters?: () => void
  routeMainTag: string
  routeTag: string
}

const EMPTY_EVENTS: Event[] = []
const hydratedEventsSnapshotCache = new Map<string, Event[]>()
const HYDRATED_EVENTS_SNAPSHOT_CACHE_LIMIT = 24
const HOME_LIVE_PRICE_OBSERVER_ROOT_MARGIN = '200px 0px'

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

async function fetchEvents({
  pageParam = 0,
  filters,
  locale,
}: {
  pageParam: number
  filters: FilterState
  locale: string
}): Promise<Event[]> {
  const params = new URLSearchParams({
    tag: filters.tag,
    mainTag: filters.mainTag,
    search: filters.search,
    bookmarked: filters.bookmarked.toString(),
    frequency: filters.frequency,
    status: filters.status,
    offset: pageParam.toString(),
    locale,
  })

  if (filters.hideSports) {
    params.set('hideSports', 'true')
  }
  if (filters.hideCrypto) {
    params.set('hideCrypto', 'true')
  }
  if (filters.hideEarnings) {
    params.set('hideEarnings', 'true')
  }

  const response = await fetch(`/api/events?${params}`)
  if (!response.ok) {
    throw new Error('Failed to fetch events')
  }

  return response.json()
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
  const userCacheKey = user?.id ?? 'guest'
  const queryUserScope = filters.bookmarked ? userCacheKey : 'public'
  const currentTimestamp = useCurrentTimestamp({
    initialTimestamp: initialCurrentTimestamp,
    intervalMs: 60_000,
  })
  const [infiniteScrollError, setInfiniteScrollError] = useState<string | null>(null)
  const snapshotKey = [
    locale,
    routeMainTag,
    routeTag,
    filters.tag,
    filters.mainTag,
    filters.search,
    filters.bookmarked ? queryUserScope : 'public',
    filters.frequency,
    filters.status,
    filters.hideSports ? 'hide-sports' : 'show-sports',
    filters.hideCrypto ? 'hide-crypto' : 'show-crypto',
    filters.hideEarnings ? 'hide-earnings' : 'show-earnings',
  ].join(':')
  const [lastStableVisibleEvents, setLastStableVisibleEvents] = useState<Event[]>(
    () => peekHydratedEventsSnapshot(snapshotKey) ?? initialEvents,
  )
  const PAGE_SIZE = HOME_EVENTS_PAGE_SIZE
  const isRouteInitialState = filters.tag === routeTag
    && filters.mainTag === routeMainTag
    && filters.search === ''
    && !filters.bookmarked
    && filters.frequency === 'all'
    && filters.status === 'active'
    && !filters.hideSports
    && !filters.hideCrypto
    && !filters.hideEarnings
  const shouldUseInitialData = isRouteInitialState && initialEvents.length > 0

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
    queryKey: [
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
    ],
    queryFn: ({ pageParam }) => fetchEvents({
      pageParam,
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

  const previousUserKeyRef = useRef(queryUserScope)
  const [livePriceEventIds, setLivePriceEventIds] = useState<string[]>([])

  useEffect(() => {
    if (!filters.bookmarked || previousUserKeyRef.current === queryUserScope) {
      return
    }

    previousUserKeyRef.current = queryUserScope
    void refetch()
  }, [filters.bookmarked, queryUserScope, refetch])

  useEffect(() => {
    setInfiniteScrollError(null)
    canRetryLoadMoreAfterErrorRef.current = true
  }, [
    filters.bookmarked,
    filters.frequency,
    filters.hideCrypto,
    filters.hideEarnings,
    filters.hideSports,
    filters.mainTag,
    filters.search,
    filters.status,
    filters.tag,
    locale,
    queryUserScope,
  ])

  const allEvents = useMemo(() => (data ? data.pages.flat() : []), [data])
  const hasFreshQueryData = !shouldUseInitialData || dataUpdatedAt > 0
  const effectiveCurrentTimestamp = hasFreshQueryData ? currentTimestamp : initialCurrentTimestamp

  const visibleEvents = useMemo(() => {
    if (allEvents.length === 0) {
      return EMPTY_EVENTS
    }

    return filterHomeEvents(allEvents, {
      currentTimestamp: effectiveCurrentTimestamp,
      hideSports: filters.hideSports,
      hideCrypto: filters.hideCrypto,
      hideEarnings: filters.hideEarnings,
      status: filters.status,
    })
  }, [allEvents, effectiveCurrentTimestamp, filters.hideSports, filters.hideCrypto, filters.hideEarnings, filters.status])

  useEffect(() => {
    setLastStableVisibleEvents(touchHydratedEventsSnapshot(snapshotKey) ?? initialEvents)
  }, [initialEvents, snapshotKey])

  useEffect(() => {
    if (visibleEvents.length === 0) {
      return
    }

    setLastStableVisibleEvents((previous) => {
      if (
        previous.length === visibleEvents.length
        && previous.every((event, index) => event.id === visibleEvents[index]?.id)
      ) {
        return previous
      }

      setHydratedEventsSnapshot(snapshotKey, visibleEvents)
      return visibleEvents
    })
  }, [snapshotKey, visibleEvents])

  useEffect(() => {
    if (status !== 'success' || visibleEvents.length > 0) {
      return
    }

    hydratedEventsSnapshotCache.delete(snapshotKey)
    setLastStableVisibleEvents(current => (current.length === 0 ? current : EMPTY_EVENTS))
  }, [snapshotKey, status, visibleEvents.length])

  const columns = useColumns(maxColumns)
  const loadingMoreColumns = Math.max(1, columns)
  const shouldShowSnapshotFallback = visibleEvents.length === 0
    && lastStableVisibleEvents.length > 0
    && status !== 'success'
  const eventsToRender = shouldShowSnapshotFallback ? lastStableVisibleEvents : visibleEvents
  const fallbackLiveEventIds = useMemo(
    () => eventsToRender.slice(0, Math.max(columns * 2, 4)).map(event => String(event.id)),
    [columns, eventsToRender],
  )
  const activeLiveEventIds = livePriceEventIds.length > 0
    ? livePriceEventIds
    : fallbackLiveEventIds
  const livePriceEvents = useMemo(
    () => eventsToRender.filter(event => activeLiveEventIds.includes(String(event.id))),
    [activeLiveEventIds, eventsToRender],
  )
  const marketTargets = useMemo(
    () => livePriceEvents.flatMap(event => buildMarketTargets(event.markets)),
    [livePriceEvents],
  )
  const marketQuotesByMarket = useEventMarketQuotes(marketTargets)
  const lastTradesByMarket = useEventLastTrades(marketTargets)
  const priceOverridesByMarket = useMemo(() => {
    const marketIds = new Set([
      ...Object.keys(marketQuotesByMarket),
      ...Object.keys(lastTradesByMarket),
    ])

    const entries: Array<[string, number]> = []
    marketIds.forEach((conditionId) => {
      const quote = marketQuotesByMarket[conditionId]
      const lastTrade = lastTradesByMarket[conditionId]
      const displayPrice = resolveDisplayPrice({
        bid: quote?.bid ?? null,
        ask: quote?.ask ?? null,
        midpoint: quote?.mid ?? null,
        lastTrade,
      })
      if (displayPrice != null) {
        entries.push([conditionId, displayPrice])
      }
    })

    return Object.fromEntries(entries)
  }, [lastTradesByMarket, marketQuotesByMarket])

  const isLoadingNewData = eventsToRender.length === 0
    && (isPending || (isFetching && !isFetchingNextPage && (!data || data.pages.length === 0)))

  useEffect(() => {
    if (!parentRef.current || eventsToRender.length === 0) {
      setLivePriceEventIds([])
      return
    }

    const observedIds = new Set<string>()
    const cardElements = Array.from(parentRef.current.querySelectorAll<HTMLElement>('[data-home-event-id]'))

    if (cardElements.length === 0) {
      setLivePriceEventIds([])
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
  }, [eventsToRender])

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

  if (eventsToRender.length === 0 && (!allEvents || allEvents.length === 0)) {
    return <EventsEmptyState tag={filters.tag} searchQuery={filters.search} onClearFilters={onClearFilters} />
  }

  if (eventsToRender.length === 0) {
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
        events={eventsToRender}
        priceOverridesByMarket={priceOverridesByMarket}
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
