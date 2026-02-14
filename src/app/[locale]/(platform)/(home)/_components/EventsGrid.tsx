'use client'

import type { FilterState } from '@/app/[locale]/(platform)/_providers/FilterProvider'
import type { Event } from '@/types'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useWindowVirtualizer } from '@tanstack/react-virtual'
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
import { resolveDisplayPrice } from '@/lib/market-chance'
import { cn } from '@/lib/utils'
import { useUser } from '@/stores/useUser'

interface EventsGridProps {
  filters: FilterState
  initialEvents: Event[]
}

const EMPTY_EVENTS: Event[] = []

function normalizeSeriesSlug(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase()
  return normalized || null
}

function toTimestamp(value: string | null | undefined) {
  if (!value) {
    return Number.NEGATIVE_INFINITY
  }

  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY
}

function isMoreRecentEvent(candidate: Event, current: Event) {
  const candidateCreatedAt = toTimestamp(candidate.created_at)
  const currentCreatedAt = toTimestamp(current.created_at)

  if (candidateCreatedAt !== currentCreatedAt) {
    return candidateCreatedAt > currentCreatedAt
  }

  const candidateUpdatedAt = toTimestamp(candidate.updated_at)
  const currentUpdatedAt = toTimestamp(current.updated_at)

  if (candidateUpdatedAt !== currentUpdatedAt) {
    return candidateUpdatedAt > currentUpdatedAt
  }

  return candidate.id > current.id
}

function isResolvedLike(event: Event) {
  if (event.status === 'resolved') {
    return true
  }

  if (!event.markets || event.markets.length === 0) {
    return false
  }

  return event.markets.every(market => market.is_resolved)
}

function isPreferredSeriesEvent(candidate: Event, current: Event, nowMs: number) {
  const candidateEnd = toTimestamp(candidate.end_date)
  const currentEnd = toTimestamp(current.end_date)
  const candidateHasFutureEnd = candidateEnd >= nowMs
  const currentHasFutureEnd = currentEnd >= nowMs
  const candidateResolved = isResolvedLike(candidate)
  const currentResolved = isResolvedLike(current)

  if (candidateHasFutureEnd && currentHasFutureEnd) {
    if (candidateResolved !== currentResolved) {
      return !candidateResolved
    }

    if (candidateEnd !== currentEnd) {
      // Among upcoming series events, keep the one ending sooner (current cycle).
      return candidateEnd < currentEnd
    }

    return isMoreRecentEvent(candidate, current)
  }

  if (candidateHasFutureEnd !== currentHasFutureEnd) {
    return candidateHasFutureEnd
  }

  if (candidateResolved !== currentResolved) {
    return !candidateResolved
  }

  if (candidateEnd !== currentEnd) {
    return candidateEnd > currentEnd
  }

  return isMoreRecentEvent(candidate, current)
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

export default function EventsGrid({
  filters,
  initialEvents = EMPTY_EVENTS,
}: EventsGridProps) {
  const locale = useLocale()
  const parentRef = useRef<HTMLDivElement | null>(null)
  const user = useUser()
  const userCacheKey = user?.id ?? 'guest'
  const [hasInitialized, setHasInitialized] = useState(false)
  const [scrollMargin, setScrollMargin] = useState(0)
  const PAGE_SIZE = 40
  const isDefaultState = filters.tag === 'trending'
    && filters.search === ''
    && !filters.bookmarked
    && filters.frequency === 'all'
    && filters.status === 'active'
  const shouldUseInitialData = isDefaultState && initialEvents.length > 0

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
      filters.tag,
      filters.search,
      filters.bookmarked,
      filters.frequency,
      filters.status,
      filters.hideSports,
      filters.hideCrypto,
      filters.hideEarnings,
      locale,
      userCacheKey,
    ],
    queryFn: ({ pageParam }) => fetchEvents({
      pageParam,
      filters,
      locale,
    }),
    getNextPageParam: (lastPage, allPages) => lastPage.length > 0 ? allPages.length * PAGE_SIZE : undefined,
    initialPageParam: 0,
    initialData: shouldUseInitialData ? { pages: [initialEvents], pageParams: [0] } : undefined,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 0,
    placeholderData: previousData => previousData,
  })

  const previousUserKeyRef = useRef(userCacheKey)

  useEffect(() => {
    if (previousUserKeyRef.current === userCacheKey) {
      return
    }

    previousUserKeyRef.current = userCacheKey
    void refetch()
  }, [refetch, userCacheKey])

  const allEvents = useMemo(() => (data ? data.pages.flat() : []), [data])

  const visibleEvents = useMemo(() => {
    if (!allEvents || allEvents.length === 0) {
      return EMPTY_EVENTS
    }

    const eventsMatchingTagFilters = allEvents.filter((event) => {
      const tagSlugs = new Set<string>()

      if (event.main_tag) {
        tagSlugs.add(event.main_tag.toLowerCase())
      }

      for (const tag of event.tags ?? []) {
        if (tag?.slug) {
          tagSlugs.add(tag.slug.toLowerCase())
        }
      }

      const slugs = Array.from(tagSlugs)
      const hasSportsTag = slugs.some(slug => slug.includes('sport'))
      const hasCryptoTag = slugs.some(slug => slug.includes('crypto'))
      const hasEarningsTag = slugs.some(slug => slug.includes('earning'))

      if (filters.hideSports && hasSportsTag) {
        return false
      }

      if (filters.hideCrypto && hasCryptoTag) {
        return false
      }

      return !(filters.hideEarnings && hasEarningsTag)
    })

    if (filters.status === 'resolved') {
      return eventsMatchingTagFilters
    }

    const newestBySeriesSlug = new Map<string, Event>()
    const nowMs = Date.now()

    for (const event of eventsMatchingTagFilters) {
      const seriesSlug = normalizeSeriesSlug(event.series_slug)
      if (!seriesSlug) {
        continue
      }

      const currentNewest = newestBySeriesSlug.get(seriesSlug)
      if (!currentNewest || isPreferredSeriesEvent(event, currentNewest, nowMs)) {
        newestBySeriesSlug.set(seriesSlug, event)
      }
    }

    if (newestBySeriesSlug.size === 0) {
      return eventsMatchingTagFilters
    }

    return eventsMatchingTagFilters.filter((event) => {
      const seriesSlug = normalizeSeriesSlug(event.series_slug)
      if (!seriesSlug) {
        return true
      }

      return newestBySeriesSlug.get(seriesSlug)?.id === event.id
    })
  }, [allEvents, filters.hideSports, filters.hideCrypto, filters.hideEarnings, filters.status])

  const marketTargets = useMemo(
    () => visibleEvents.flatMap(event => buildMarketTargets(event.markets)),
    [visibleEvents],
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

  const columns = useColumns()

  useEffect(() => {
    queueMicrotask(() => {
      if (parentRef.current) {
        setScrollMargin(parentRef.current.offsetTop)
      }
    })
  }, [])

  const rowsCount = Math.ceil(visibleEvents.length / columns)

  const virtualizer = useWindowVirtualizer({
    count: rowsCount,
    estimateSize: () => 194,
    scrollMargin,
    onChange: (instance) => {
      if (!hasInitialized) {
        setHasInitialized(true)
        return
      }

      const items = instance.getVirtualItems()
      const last = items[items.length - 1]
      if (
        last
        && last.index >= rowsCount - 1
        && hasNextPage
        && !isFetchingNextPage
      ) {
        queueMicrotask(() => fetchNextPage())
      }
    },
  })

  const isLoadingNewData = isPending || (isFetching && !isFetchingNextPage && (!data || data.pages.length === 0))

  if (isLoadingNewData) {
    return (
      <div ref={parentRef}>
        <EventsGridSkeleton />
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
    <div ref={parentRef} className="relative w-full">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: 'relative',
          width: '100%',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const start = virtualRow.index * columns
          const end = Math.min(start + columns, visibleEvents.length)
          const rowEvents = visibleEvents.slice(start, end)

          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${
                  virtualRow.start
                  - (virtualizer.options.scrollMargin ?? 0)
                }px)`,
              }}
            >
              <div className={cn('grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4', { 'opacity-80': isFetching })}>
                {rowEvents.map(event => (
                  <EventCard
                    key={event.id}
                    event={event}
                    priceOverridesByMarket={priceOverridesByMarket}
                  />
                ))}
                {isFetchingNextPage && <EventCardSkeleton />}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
