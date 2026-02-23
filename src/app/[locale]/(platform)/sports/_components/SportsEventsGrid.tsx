'use client'

import type { Route } from 'next'
import type { FilterState } from '@/app/[locale]/(platform)/_providers/FilterProvider'
import type { SportsSidebarMode } from '@/app/[locale]/(platform)/sports/_components/SportsSidebarMenu'
import type { Event } from '@/types'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useWindowVirtualizer } from '@tanstack/react-virtual'
import { useLocale } from 'next-intl'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import EventCard from '@/app/[locale]/(platform)/(home)/_components/EventCard'
import EventCardSkeleton from '@/app/[locale]/(platform)/(home)/_components/EventCardSkeleton'
import EventsGridSkeleton from '@/app/[locale]/(platform)/(home)/_components/EventsGridSkeleton'
import EventsEmptyState from '@/app/[locale]/(platform)/event/[slug]/_components/EventsEmptyState'
import { useEventLastTrades } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventLastTrades'
import { useEventMarketQuotes } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventMidPrices'
import { buildMarketTargets } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventPriceHistory'
import { SPORTS_MENU_ENTRIES } from '@/app/[locale]/(platform)/sports/_components/sportsMenuData'
import SportsSidebarMenu from '@/app/[locale]/(platform)/sports/_components/SportsSidebarMenu'
import { useColumns } from '@/hooks/useColumns'
import { useRouter } from '@/i18n/navigation'
import { resolveDisplayPrice } from '@/lib/market-chance'
import { cn } from '@/lib/utils'
import { useUser } from '@/stores/useUser'

interface SportsEventsGridProps {
  filters: FilterState
  initialEvents: Event[]
  initialMode?: SportsSidebarMode
  sportsSportSlug?: string | null
  activeSportSlug?: string | null
  selectedTitle?: string
}

const EMPTY_EVENTS: Event[] = []
const SPORTS_TITLE_ALIASES: Record<string, string[]> = {
  'cbb': ['ncaab'],
  'ncaab': ['cbb'],
  'counter-strike': ['cs2'],
  'cs2': ['counter-strike'],
  'league-of-legends': ['lol'],
  'lol': ['league-of-legends'],
}

function resolveSportsTagSlugFromHref(href: string) {
  const segments = href
    .split('/')
    .map(segment => segment.trim().toLowerCase())
    .filter(Boolean)
  const sportsIndex = segments.indexOf('sports')
  if (sportsIndex === -1) {
    return null
  }

  const nextSegment = segments[sportsIndex + 1]
  if (!nextSegment || nextSegment === 'live' || nextSegment === 'futures') {
    return null
  }

  return nextSegment
}

const SPORTS_TITLE_BY_TAG_SLUG = (() => {
  const titleByTag = new Map<string, string>()

  for (const entry of SPORTS_MENU_ENTRIES) {
    if (entry.type === 'link') {
      const tagSlug = resolveSportsTagSlugFromHref(entry.href)
      if (tagSlug && !titleByTag.has(tagSlug)) {
        titleByTag.set(tagSlug, entry.label)
      }
      continue
    }

    if (entry.type !== 'group') {
      continue
    }

    for (const child of entry.links) {
      const tagSlug = resolveSportsTagSlugFromHref(child.href)
      if (tagSlug && !titleByTag.has(tagSlug)) {
        titleByTag.set(tagSlug, child.label)
      }
    }
  }

  return titleByTag
})()

function formatTagSlugAsTitle(tagSlug: string) {
  return tagSlug
    .split('-')
    .filter(Boolean)
    .map((segment) => {
      return segment.charAt(0).toUpperCase() + segment.slice(1)
    })
    .join(' ')
}

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
  sportsSportSlug,
}: {
  pageParam: number
  filters: FilterState
  locale: string
  sportsSportSlug: string | null
}): Promise<Event[]> {
  const params = new URLSearchParams({
    tag: 'sports',
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
  if (sportsSportSlug) {
    params.set('sportsSportSlug', sportsSportSlug)
  }
  const response = await fetch(`/api/events?${params}`)
  if (!response.ok) {
    throw new Error('Failed to fetch events')
  }
  return response.json()
}

export default function SportsEventsGrid({
  filters,
  initialEvents = EMPTY_EVENTS,
  initialMode = 'all',
  sportsSportSlug = null,
  activeSportSlug = null,
  selectedTitle,
}: SportsEventsGridProps) {
  const locale = useLocale()
  const router = useRouter()
  const parentRef = useRef<HTMLDivElement | null>(null)
  const user = useUser()
  const userCacheKey = user?.id ?? 'guest'
  const [hasInitialized, setHasInitialized] = useState(false)
  const [scrollMargin, setScrollMargin] = useState(0)
  const [sportsMode, setSportsMode] = useState<SportsSidebarMode>(initialMode)
  const [currentTimestamp, setCurrentTimestamp] = useState<number | null>(null)
  const PAGE_SIZE = 40
  const normalizedSportsSportSlug = sportsSportSlug?.trim().toLowerCase() || null
  const isDefaultState = filters.search === ''
    && !filters.bookmarked
    && filters.frequency === 'all'
    && filters.status === 'active'
  const shouldUseInitialData = isDefaultState && initialEvents.length > 0
  const isSportsContext = true

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
    ],
    queryFn: ({ pageParam }) => fetchEvents({
      pageParam,
      filters,
      locale,
      sportsSportSlug: normalizedSportsSportSlug,
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

  useEffect(() => {
    if (!isSportsContext) {
      setSportsMode('all')
    }
  }, [isSportsContext])

  useEffect(() => {
    setSportsMode(initialMode)
  }, [initialMode])

  useEffect(() => {
    setCurrentTimestamp(Date.now())
  }, [])

  const allEvents = useMemo(() => (data ? data.pages.flat() : []), [data])

  const filteredEvents = useMemo(() => {
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

    if (currentTimestamp == null) {
      return eventsMatchingTagFilters
    }

    const newestBySeriesSlug = new Map<string, Event>()

    for (const event of eventsMatchingTagFilters) {
      const seriesSlug = normalizeSeriesSlug(event.series_slug)
      if (!seriesSlug) {
        continue
      }

      const currentNewest = newestBySeriesSlug.get(seriesSlug)
      if (!currentNewest || isPreferredSeriesEvent(event, currentNewest, currentTimestamp)) {
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
  }, [allEvents, currentTimestamp, filters.hideSports, filters.hideCrypto, filters.hideEarnings, filters.status])

  const sportsBaseEvents = useMemo(() => {
    if (!isSportsContext) {
      return EMPTY_EVENTS
    }
    return filteredEvents
  }, [filteredEvents, isSportsContext])
  const sportsModeEvents = useMemo(() => {
    if (!isSportsContext || sportsMode === 'all') {
      return sportsBaseEvents
    }

    if (currentTimestamp == null) {
      return sportsBaseEvents
    }

    if (sportsMode === 'live') {
      return sportsBaseEvents.filter(event => isEventLiveNow(event, currentTimestamp))
    }

    return sportsBaseEvents.filter(event => isEventFuture(event, currentTimestamp))
  }, [currentTimestamp, isSportsContext, sportsBaseEvents, sportsMode])
  const visibleEvents = isSportsContext ? sportsModeEvents : filteredEvents

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
  const normalizedActiveSportSlug = activeSportSlug?.trim().toLowerCase() || normalizedSportsSportSlug
  const activeSportsTagSlug = useMemo(() => {
    if (normalizedActiveSportSlug) {
      return normalizedActiveSportSlug
    }

    return null
  }, [normalizedActiveSportSlug])
  const sportsSelectedTitle = useMemo(() => {
    if (!isSportsContext) {
      return ''
    }

    if (selectedTitle?.trim()) {
      return selectedTitle
    }

    if (sportsMode === 'live') {
      return 'Live'
    }

    if (sportsMode === 'futures') {
      return 'Futures'
    }

    if (!activeSportsTagSlug) {
      return 'All Sports'
    }

    const directTitle = SPORTS_TITLE_BY_TAG_SLUG.get(activeSportsTagSlug)
    if (directTitle) {
      return directTitle
    }

    for (const alias of SPORTS_TITLE_ALIASES[activeSportsTagSlug] ?? []) {
      const aliasedTitle = SPORTS_TITLE_BY_TAG_SLUG.get(alias)
      if (aliasedTitle) {
        return aliasedTitle
      }
    }

    return formatTagSlugAsTitle(activeSportsTagSlug)
  }, [activeSportsTagSlug, isSportsContext, selectedTitle, sportsMode])
  const handleNavigateHref = useCallback((href: string) => {
    router.push(href as Route)
  }, [router])
  const handleSelectSportsTag = useCallback((_requestedTagSlug: string, href: string) => {
    setSportsMode('all')
    router.push(href as Route)
  }, [router])

  const columns = useColumns()
  const activeColumns = useMemo(() => {
    if (isSportsContext && columns >= 3) {
      return columns - 1
    }
    return columns
  }, [columns, isSportsContext])

  useEffect(() => {
    queueMicrotask(() => {
      if (parentRef.current) {
        setScrollMargin(parentRef.current.offsetTop)
      }
    })
  }, [])

  const rowsCount = Math.ceil(visibleEvents.length / Math.max(1, activeColumns))

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
    if (isSportsContext) {
      return (
        <div className="w-full">
          <div className="relative w-full lg:flex lg:items-start lg:gap-4">
            <SportsSidebarMenu
              mode={sportsMode}
              activeTagSlug={activeSportsTagSlug}
              onSelectMode={setSportsMode}
              onSelectTagSlug={handleSelectSportsTag}
              onNavigateHref={handleNavigateHref}
            />
            <div ref={parentRef} className="relative min-w-0 flex-1">
              {sportsSelectedTitle && (
                <h1 className="text-3xl font-semibold tracking-tight text-foreground lg:mt-2 lg:ml-4">{sportsSelectedTitle}</h1>
              )}
            </div>
          </div>
        </div>
      )
    }
    return <EventsEmptyState tag={filters.tag} searchQuery={filters.search} />
  }

  if (!visibleEvents || visibleEvents.length === 0) {
    if (isSportsContext) {
      return (
        <div className="w-full">
          <div className="relative w-full lg:flex lg:items-start lg:gap-4">
            <SportsSidebarMenu
              mode={sportsMode}
              activeTagSlug={activeSportsTagSlug}
              onSelectMode={setSportsMode}
              onSelectTagSlug={handleSelectSportsTag}
              onNavigateHref={handleNavigateHref}
            />
            <div ref={parentRef} className="min-w-0 flex-1">
              {sportsSelectedTitle && (
                <h1 className="mb-3 text-3xl font-semibold tracking-tight text-foreground lg:mt-12 lg:ml-4">{sportsSelectedTitle}</h1>
              )}
              <div className="flex min-h-50 min-w-0 items-center justify-center text-sm text-muted-foreground">
                No events match your filters.
              </div>
            </div>
          </div>
        </div>
      )
    }
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
    <div className="w-full">
      <div className={cn('relative w-full', { 'lg:flex lg:items-start lg:gap-4': isSportsContext })}>
        {isSportsContext && (
          <SportsSidebarMenu
            mode={sportsMode}
            activeTagSlug={activeSportsTagSlug}
            onSelectMode={setSportsMode}
            onSelectTagSlug={handleSelectSportsTag}
            onNavigateHref={handleNavigateHref}
          />
        )}

        <div ref={parentRef} className="relative min-w-0 flex-1">
          {isSportsContext && sportsSelectedTitle && (
            <h1 className="mb-3 text-3xl font-semibold tracking-tight text-foreground lg:mt-12 lg:ml-4">{sportsSelectedTitle}</h1>
          )}

          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              position: 'relative',
              width: '100%',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const start = virtualRow.index * activeColumns
              const end = Math.min(start + activeColumns, visibleEvents.length)
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
                  <div
                    className={cn('grid gap-3', { 'opacity-80': isFetching })}
                    style={{
                      gridTemplateColumns: `repeat(${Math.max(1, activeColumns)}, minmax(0, 1fr))`,
                    }}
                  >
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
      </div>
    </div>
  )
}
