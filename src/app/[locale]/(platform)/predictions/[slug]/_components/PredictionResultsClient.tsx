'use client'

import type { Route } from 'next'
import type {
  PredictionResultsSortOption,
  PredictionResultsStatusOption,
} from '@/lib/prediction-results-filters'
import type { Event, Market } from '@/types'
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query'
import { ChevronRightIcon, Clock3Icon, FlameIcon, MessageCircleIcon, SearchIcon, Settings2Icon } from 'lucide-react'
import { useExtracted, useLocale } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { startTransition, useEffect, useMemo, useRef, useState } from 'react'
import { useCommentMetrics } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useCommentMetrics'
import PredictionResultsFilters from '@/app/[locale]/(platform)/predictions/[slug]/_components/PredictionResultsFilters'
import EventIconImage from '@/components/EventIconImage'
import IntentPrefetchLink from '@/components/IntentPrefetchLink'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'
import { Skeleton } from '@/components/ui/skeleton'
import { useDebounce } from '@/hooks/useDebounce'
import { usePathname, useRouter } from '@/i18n/navigation'
import { resolveEventPagePath } from '@/lib/events-routing'
import { formatCompactCurrency, formatDate } from '@/lib/formatters'
import { HOME_EVENTS_PAGE_SIZE } from '@/lib/home-events'
import {
  buildPredictionResultsUrlSearchParams,
  DEFAULT_PREDICTION_RESULTS_SORT,
  DEFAULT_PREDICTION_RESULTS_STATUS,
  PREDICTION_RESULTS_SORT_PARAM,
  PREDICTION_RESULTS_STATUS_PARAM,
  resolvePredictionResultsApiSort,
} from '@/lib/prediction-results-filters'
import { buildPredictionResultsPath } from '@/lib/prediction-search'
import { cn } from '@/lib/utils'

interface PredictionResultsClientProps {
  displayLabel: string
  initialCurrentTimestamp: number
  initialEvents: Event[]
  initialInputValue: string
  initialQuery: string
  initialSort: PredictionResultsSortOption
  initialStatus: PredictionResultsStatusOption
  routeMainTag: string
  routeTag: string
}

const COMPETITIVE_NEUTRAL_PROBABILITY = 50

function resolvePrimaryMarket(event: Event): Market | null {
  if (event.markets.length === 0) {
    return null
  }

  if (event.status === 'resolved') {
    return event.markets[0] ?? null
  }

  return event.markets.find(market => !market.is_resolved && !market.condition?.resolved)
    ?? event.markets[0]
    ?? null
}

function sortPredictionEvents(events: Event[], sort: PredictionResultsSortOption) {
  if (sort !== 'competitive') {
    return events
  }

  return [...events].sort((left, right) => {
    const leftProbability = resolvePrimaryMarket(left)?.probability ?? COMPETITIVE_NEUTRAL_PROBABILITY
    const rightProbability = resolvePrimaryMarket(right)?.probability ?? COMPETITIVE_NEUTRAL_PROBABILITY
    const leftScore = Math.abs(leftProbability - COMPETITIVE_NEUTRAL_PROBABILITY)
    const rightScore = Math.abs(rightProbability - COMPETITIVE_NEUTRAL_PROBABILITY)

    if (leftScore !== rightScore) {
      return leftScore - rightScore
    }

    return (right.volume ?? 0) - (left.volume ?? 0)
  })
}

function buildDateLabel(event: Event) {
  if (event.status === 'resolved' && event.resolved_at) {
    const resolvedAt = new Date(event.resolved_at)
    return Number.isNaN(resolvedAt.getTime()) ? 'Resolved' : `Resolved ${formatDate(resolvedAt)}`
  }

  if (event.end_date) {
    const endDate = new Date(event.end_date)
    if (Number.isNaN(endDate.getTime())) {
      return 'Ends soon'
    }

    const diffMs = endDate.getTime() - Date.now()
    if (diffMs <= 0) {
      return 'Ended'
    }

    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const diffMonths = Math.round(diffDays / 30)

    if (diffDays >= 60) {
      return `Ends in ${diffMonths} months`
    }
    if (diffDays >= 30) {
      return `Ends in ${diffMonths} month`
    }
    if (diffDays >= 2) {
      return `Ends in ${diffDays} days`
    }
    if (diffHours >= 1) {
      return `Ends in ${diffHours} hours`
    }
    if (diffMinutes >= 1) {
      return `Ends in ${diffMinutes} min`
    }

    return 'Ends soon'
  }

  return event.status === 'resolved' ? 'Resolved' : 'Active'
}

function getEventRecentVolume(event: Event) {
  return event.markets.reduce((sum, market) => sum + (market.volume_24h ?? 0), 0)
}

async function fetchPredictionResults({
  initialCurrentTimestamp,
  locale,
  pageParam = 0,
  query,
  routeMainTag,
  routeTag,
  sort,
  status,
}: {
  initialCurrentTimestamp: number
  locale: string
  pageParam?: number
  query: string
  routeMainTag: string
  routeTag: string
  sort: PredictionResultsSortOption
  status: PredictionResultsStatusOption
}): Promise<Event[]> {
  const params = new URLSearchParams({
    currentTimestamp: initialCurrentTimestamp.toString(),
    homeFeed: 'true',
    locale,
    mainTag: routeMainTag,
    offset: pageParam.toString(),
    search: query,
    sort: resolvePredictionResultsApiSort(sort),
    status,
    tag: routeTag,
  })

  const response = await fetch(`/api/events?${params}`)
  if (!response.ok) {
    throw new Error('Failed to fetch prediction results')
  }

  return response.json()
}

export default function PredictionResultsClient({
  displayLabel,
  initialCurrentTimestamp,
  initialEvents,
  initialInputValue,
  initialQuery,
  initialSort,
  initialStatus,
  routeMainTag,
  routeTag,
}: PredictionResultsClientProps) {
  const t = useExtracted()
  const locale = useLocale()
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [searchValue, setSearchValue] = useState(initialInputValue)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const debouncedSearchValue = useDebounce(searchValue, 300)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  const canRetryLoadMoreAfterErrorRef = useRef(true)
  const [infiniteScrollError, setInfiniteScrollError] = useState<string | null>(null)

  useEffect(() => {
    setSearchValue(initialInputValue)
  }, [initialInputValue])

  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isPending,
  } = useInfiniteQuery({
    queryKey: [
      'prediction-results',
      routeMainTag,
      routeTag,
      initialQuery,
      initialSort,
      initialStatus,
      locale,
    ],
    queryFn: ({ pageParam }) => fetchPredictionResults({
      initialCurrentTimestamp,
      locale,
      pageParam,
      query: initialQuery,
      routeMainTag,
      routeTag,
      sort: initialSort,
      status: initialStatus,
    }),
    getNextPageParam: (lastPage, allPages) => lastPage.length === HOME_EVENTS_PAGE_SIZE ? allPages.length * HOME_EVENTS_PAGE_SIZE : undefined,
    initialData: { pageParams: [0], pages: [initialEvents] },
    initialPageParam: 0,
    placeholderData: keepPreviousData,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 'static',
  })

  useEffect(() => {
    setInfiniteScrollError(null)
    canRetryLoadMoreAfterErrorRef.current = true
  }, [initialQuery, initialSort, initialStatus, locale, routeMainTag, routeTag])

  useEffect(() => {
    if (!loadMoreRef.current || !hasNextPage) {
      return
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting || !canRetryLoadMoreAfterErrorRef.current || isFetchingNextPage) {
        return
      }

      void fetchNextPage().catch((fetchError: Error) => {
        canRetryLoadMoreAfterErrorRef.current = false
        setInfiniteScrollError(fetchError.message || 'Failed to load more results.')
      })
    }, { rootMargin: '240px 0px' })

    observer.observe(loadMoreRef.current)

    return () => observer.disconnect()
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])

  useEffect(() => {
    const nextPath = buildPredictionResultsPath(debouncedSearchValue)
    if (!nextPath || nextPath === pathname) {
      return
    }

    const nextParams = buildPredictionResultsUrlSearchParams(searchParams, {
      sort: initialSort,
      status: initialStatus,
    })
    const nextQuery = nextParams.toString()
    const nextUrl = nextQuery ? `${nextPath}?${nextQuery}` : nextPath

    startTransition(() => {
      router.replace(nextUrl as Route, { scroll: false })
    })
  }, [debouncedSearchValue, initialSort, initialStatus, pathname, router, searchParams])

  const visibleEvents = useMemo(() => {
    const pages = data?.pages.flat() ?? initialEvents
    return sortPredictionEvents(pages, initialSort)
  }, [data, initialEvents, initialSort])

  const isEmptyState = !isPending && !isFetching && visibleEvents.length === 0
  const showInitialSkeleton = visibleEvents.length === 0 && (isPending || isFetching)

  function replaceRoute({
    nextSort = initialSort,
    nextStatus = initialStatus,
  }: {
    nextSort?: PredictionResultsSortOption
    nextStatus?: PredictionResultsStatusOption
  }) {
    const nextParams = buildPredictionResultsUrlSearchParams(searchParams, {
      sort: nextSort,
      status: nextStatus,
    })
    const nextQuery = nextParams.toString()
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname

    if (
      nextSort === searchParams.get(PREDICTION_RESULTS_SORT_PARAM)
      && nextStatus === searchParams.get(PREDICTION_RESULTS_STATUS_PARAM)
    ) {
      return
    }

    startTransition(() => {
      router.replace(nextUrl as Route, { scroll: false })
    })
  }

  function handleRetryLoadMore() {
    canRetryLoadMoreAfterErrorRef.current = true
    setInfiniteScrollError(null)
    void fetchNextPage().catch((fetchError: Error) => {
      canRetryLoadMoreAfterErrorRef.current = false
      setInfiniteScrollError(fetchError.message || 'Failed to load more results.')
    })
  }

  function handleClearFilters() {
    setSearchValue(initialInputValue)
    replaceRoute({
      nextSort: DEFAULT_PREDICTION_RESULTS_SORT,
      nextStatus: DEFAULT_PREDICTION_RESULTS_STATUS,
    })
  }

  const filtersContent = (
    <PredictionResultsFilters
      searchValue={searchValue}
      sort={initialSort}
      status={initialStatus}
      onSearchValueChange={setSearchValue}
      onSortChange={value => replaceRoute({ nextSort: value })}
      onStatusChange={value => replaceRoute({ nextStatus: value })}
    />
  )

  return (
    <div className="mx-auto flex w-full min-w-0 flex-col gap-6 lg:flex-row lg:items-start lg:gap-12">
      <div className="min-w-0 flex-1">
        <header className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                {displayLabel}
                {' '}
                predictions & odds
              </h1>
              <span className="text-xl text-muted-foreground">·</span>
              <p className="text-base text-muted-foreground md:text-xl">
                {visibleEvents.length}
                {' '}
                {visibleEvents.length === 1 ? t('result loaded') : t('results loaded')}
              </p>
            </div>
          </div>

          <div className="shrink-0 lg:hidden">
            <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
              <DrawerTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  data-testid="prediction-filters-drawer-trigger"
                  className="rounded-full border-border/70 bg-background px-3"
                >
                  <Settings2Icon className="size-4" />
                  {t('Search & filters')}
                </Button>
              </DrawerTrigger>
              <DrawerContent className="max-h-[85vh] rounded-t-[28px]">
                <DrawerHeader>
                  <DrawerTitle>{t('Search & filters')}</DrawerTitle>
                  <DrawerDescription>{t('Refine the current prediction results page')}</DrawerDescription>
                </DrawerHeader>
                <div className="overflow-y-auto px-4 pb-6">
                  <div className="overflow-hidden rounded-lg border border-border/70 bg-card shadow-md">
                    {filtersContent}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleClearFilters}
                    className="
                      mt-4 h-10 w-full justify-center text-[13px] font-medium tracking-[-0.09px] text-muted-foreground
                    "
                  >
                    {t('Clear filters')}
                  </Button>
                </div>
              </DrawerContent>
            </Drawer>
          </div>
        </header>

        {showInitialSkeleton && (
          <PredictionResultsListSkeleton />
        )}

        {!showInitialSkeleton && (
          <div className="space-y-4">
            {isEmptyState
              ? (
                  <PredictionResultsEmptyState query={initialQuery} />
                )
              : (
                  <div className="divide-y divide-border/70">
                    {visibleEvents.map(event => (
                      <PredictionResultRow key={event.id} event={event} />
                    ))}
                  </div>
                )}

            {error && (
              <div className="
                rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive
              "
              >
                {t('Could not load prediction results. Please try again.')}
              </div>
            )}

            {infiniteScrollError && (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/70 px-4 py-3 text-sm">
                <span className="text-muted-foreground">
                  {infiniteScrollError}
                </span>
                <Button type="button" size="sm" variant="outline" onClick={handleRetryLoadMore}>
                  {t('Retry')}
                </Button>
              </div>
            )}

            {isFetchingNextPage && <PredictionResultsListSkeleton compact />}
            <div ref={loadMoreRef} data-testid="prediction-results-load-more" className="h-1 w-full" />
          </div>
        )}
      </div>

      <aside
        data-testid="prediction-filters-aside"
        className="
          hidden w-full self-start
          lg:sticky lg:top-[150px] lg:flex lg:w-[350px] lg:shrink-0 lg:flex-col lg:gap-4
        "
      >
        <div className="overflow-hidden rounded-lg border border-border/70 bg-card shadow-md">
          <div className="w-full shrink-0 bg-card">
            {filtersContent}
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          onClick={handleClearFilters}
          className="h-10 w-full justify-center text-[13px] font-medium tracking-[-0.09px] text-muted-foreground"
        >
          {t('Clear filters')}
        </Button>
      </aside>
    </div>
  )
}

function PredictionResultRow({ event }: { event: Event }) {
  const t = useExtracted()
  const locale = useLocale()
  const { data: commentMetrics } = useCommentMetrics(event.slug)
  const primaryMarket = resolvePrimaryMarket(event)
  const primaryProbability = primaryMarket?.probability ?? 0
  const supportingTags = event.tags.slice(0, 2)
  const isMultiMarket = Math.max(event.total_markets_count, event.markets.length) > 1
  const recentVolume = getEventRecentVolume(event)
  const commentsCount = commentMetrics?.comments_count ?? null
  const eventPath = resolveEventPagePath(event)
  const selectedMarketLabel = primaryMarket?.short_title?.trim()
    || primaryMarket?.title?.trim()
    || (event.status === 'resolved' ? t('Resolved') : t('Market'))

  return (
    <div className="group relative py-4">
      <IntentPrefetchLink
        href={eventPath as Route}
        aria-label={event.title}
        className="absolute inset-0 z-0 rounded-2xl"
      />

      <div className="
        pointer-events-none absolute -inset-x-4 inset-y-1 rounded-2xl bg-accent/35 opacity-0 transition-opacity
        duration-150
        group-hover:opacity-100
      "
      />

      <div className="relative z-10 flex items-start gap-4">
        <div className="
          relative size-12 shrink-0 overflow-hidden rounded-md border border-border/70 bg-muted
          md:size-13
        "
        >
          <EventIconImage
            src={event.icon_url}
            alt={event.title}
            sizes="52px"
            containerClassName="size-full"
          />
        </div>

        <div className="min-w-0 flex-1">
          {supportingTags.length > 0 && (
            <div className="
              pointer-events-auto mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground
            "
            >
              {supportingTags.map((tag, index) => {
                const tagPath = buildPredictionResultsPath(tag.slug)

                return tagPath
                  ? (
                      <div key={`${event.id}-${tag.slug}`} className="flex items-center gap-2">
                        {index > 0 && <span className="text-muted-foreground/80">·</span>}
                        <IntentPrefetchLink
                          href={tagPath as Route}
                          className="font-medium text-muted-foreground transition-colors hover:text-foreground"
                        >
                          {tag.name}
                        </IntentPrefetchLink>
                      </div>
                    )
                  : null
              })}
            </div>
          )}

          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="line-clamp-3 text-lg/snug font-medium text-foreground group-hover:underline">
                {event.title}
              </h2>
              <div className="
                mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium text-muted-foreground
              "
              >
                <span className="flex items-center gap-1 whitespace-nowrap">
                  <span>
                    {formatCompactCurrency(event.volume ?? 0)}
                    {' '}
                    Vol.
                  </span>
                </span>
                <span className="flex items-center gap-1 whitespace-nowrap">
                  <FlameIcon className="size-3.5 text-rose-400" />
                  <span>
                    {formatCompactCurrency(recentVolume)}
                    {' '}
                    24h
                  </span>
                </span>
                <a
                  href={`${eventPath}#commentsInner`}
                  className="
                    pointer-events-auto flex items-center gap-1 whitespace-nowrap transition-colors
                    hover:text-foreground
                  "
                >
                  <MessageCircleIcon className="size-3.5 text-muted-foreground" />
                  <span>{commentsCount == null ? '—' : Number(commentsCount).toLocaleString(locale)}</span>
                </a>
                <span className="flex items-center gap-1 whitespace-nowrap">
                  <Clock3Icon className="size-3.5 text-muted-foreground" />
                  <span>{buildDateLabel(event)}</span>
                </span>
              </div>
            </div>

            <div className="flex max-w-[42%] min-w-[112px] shrink-0 items-center gap-3 self-center">
              <div className="min-w-0 flex-1 text-right">
                <p className="truncate text-2xl font-semibold tracking-tight text-foreground md:text-[32px]">
                  {Math.round(primaryProbability)}
                  %
                </p>
                {isMultiMarket && (
                  <p className="truncate text-sm text-muted-foreground">
                    {selectedMarketLabel}
                  </p>
                )}
              </div>
              <ChevronRightIcon className="
                size-4 shrink-0 text-muted-foreground transition-transform duration-150
                group-hover:translate-x-0.5
              "
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function PredictionResultsListSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn('divide-y divide-border/70', compact && 'opacity-80')} data-testid="prediction-results-skeleton">
      {Array.from({ length: compact ? 2 : 4 }).map((_, index) => (
        <div key={index} className="flex items-start gap-4 py-4">
          <Skeleton className="size-12 rounded-md md:size-13" />
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex gap-2">
              <Skeleton className="h-4 w-16 rounded-full" />
              <Skeleton className="h-4 w-14 rounded-full" />
            </div>
            <Skeleton className="h-5 w-4/5" />
            <Skeleton className="mt-2 h-4 w-3/5" />
          </div>
          <div className="ml-auto space-y-2 text-right">
            <Skeleton className="ml-auto h-8 w-14" />
            <Skeleton className="ml-auto h-4 w-24" />
          </div>
        </div>
      ))}
    </div>
  )
}

function PredictionResultsEmptyState({ query }: { query: string }) {
  const t = useExtracted()

  return (
    <div className="rounded-2xl border border-dashed border-border/70 bg-card px-5 py-12 text-center">
      <div className="mb-3 flex justify-center text-muted-foreground">
        <SearchIcon className="size-6" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">
        {t('No prediction results found')}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {query
          ? `${t('Try adjusting your search for')} "${query}".`
          : t('Try a different search term or filter combination.')}
      </p>
    </div>
  )
}
