'use client'

import type { Route } from 'next'
import type {
  PredictionResultsSortOption,
  PredictionResultsStatusOption,
} from '@/lib/prediction-results-filters'
import type { Event, Market } from '@/types'
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query'
import { SearchIcon, Settings2Icon } from 'lucide-react'
import { useExtracted, useLocale } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { startTransition, useEffect, useMemo, useRef, useState } from 'react'
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
    return Number.isNaN(endDate.getTime()) ? 'Ends soon' : `Ends ${formatDate(endDate)}`
  }

  return event.status === 'resolved' ? 'Resolved' : 'Active'
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
    <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:gap-8">
      <div className="min-w-0 flex-1 space-y-4">
        <header className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                {displayLabel}
              </h1>
              <p className="text-sm text-muted-foreground">
                {visibleEvents.length}
                {' '}
                {visibleEvents.length === 1 ? t('result loaded') : t('results loaded')}
              </p>
            </div>

            <div className="lg:hidden">
              <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
                <DrawerTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    data-testid="prediction-filters-drawer-trigger"
                    className="rounded-full"
                  >
                    <Settings2Icon className="size-4" />
                    {t('Search & filters')}
                  </Button>
                </DrawerTrigger>
                <DrawerContent className="max-h-[85vh]">
                  <DrawerHeader>
                    <DrawerTitle>{t('Search & filters')}</DrawerTitle>
                    <DrawerDescription>{t('Refine the current prediction results page')}</DrawerDescription>
                  </DrawerHeader>
                  <div className="overflow-y-auto px-4 pb-6">
                    {filtersContent}
                  </div>
                </DrawerContent>
              </Drawer>
            </div>
          </div>
        </header>

        {showInitialSkeleton && (
          <PredictionResultsListSkeleton />
        )}

        {!showInitialSkeleton && (
          <div className="space-y-3">
            {isEmptyState
              ? (
                  <PredictionResultsEmptyState query={initialQuery} />
                )
              : (
                  <div className="space-y-3">
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
        className="hidden w-full max-w-xs lg:sticky lg:top-24 lg:block"
      >
        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
          {filtersContent}
        </div>
      </aside>
    </div>
  )
}

function PredictionResultRow({ event }: { event: Event }) {
  const primaryMarket = resolvePrimaryMarket(event)
  const primaryProbability = primaryMarket?.probability ?? 0
  const supportingTags = event.tags.slice(0, 2)

  return (
    <div className="
      group relative overflow-hidden rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition-colors
      hover:bg-accent/20
    "
    >
      <IntentPrefetchLink
        href={resolveEventPagePath(event) as Route}
        aria-label={event.title}
        className="absolute inset-0 z-0 rounded-2xl"
      />

      <div className="relative z-10 flex items-start gap-4">
        <div className="relative size-14 shrink-0 overflow-hidden rounded-xl border border-border/70 bg-accent">
          <EventIconImage
            src={event.icon_url}
            alt={event.title}
            sizes="56px"
            containerClassName="size-full"
          />
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          {supportingTags.length > 0 && (
            <div className="pointer-events-auto flex flex-wrap items-center gap-2">
              {supportingTags.map((tag) => {
                const tagPath = buildPredictionResultsPath(tag.slug)

                return tagPath
                  ? (
                      <IntentPrefetchLink
                        key={`${event.id}-${tag.slug}`}
                        href={tagPath as Route}
                        className={`
                          inline-flex items-center rounded-full border border-border/70 bg-background px-2.5 py-1
                          text-xs font-medium text-muted-foreground transition-colors
                          hover:bg-accent hover:text-foreground
                        `}
                      >
                        {tag.name}
                      </IntentPrefetchLink>
                    )
                  : null
              })}
            </div>
          )}

          <div className="space-y-1">
            <h2 className="line-clamp-2 text-lg font-semibold text-foreground group-hover:underline">
              {event.title}
            </h2>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span>
                {formatCompactCurrency(event.volume)}
                {' '}
                vol.
              </span>
              <span>{buildDateLabel(event)}</span>
              {primaryMarket?.question && (
                <span className="truncate">{primaryMarket.question}</span>
              )}
            </div>
          </div>
        </div>

        <div className="min-w-0 shrink-0 text-right">
          <p className="text-2xl font-semibold tracking-tight text-foreground">
            {Math.round(primaryProbability)}
            %
          </p>
          <p className="max-w-28 truncate text-xs text-muted-foreground">
            {primaryMarket?.short_title ?? primaryMarket?.title ?? (event.status === 'resolved' ? 'Resolved' : 'Market')}
          </p>
        </div>
      </div>
    </div>
  )
}

function PredictionResultsListSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn('space-y-3', compact && 'opacity-80')} data-testid="prediction-results-skeleton">
      {Array.from({ length: compact ? 2 : 4 }).map((_, index) => (
        <div key={index} className="flex items-start gap-4 rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
          <Skeleton className="size-14 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex gap-2">
              <Skeleton className="h-5 w-18 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <div className="space-y-2">
            <Skeleton className="ml-auto h-7 w-12" />
            <Skeleton className="ml-auto h-4 w-20" />
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
