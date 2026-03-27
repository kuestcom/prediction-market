'use client'

import type { Route } from 'next'
import type {
  PredictionResultsSortOption,
  PredictionResultsStatusOption,
} from '@/lib/prediction-results-filters'
import type { Event, Market } from '@/types'
import { useAppKitAccount } from '@reown/appkit/react'
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query'
import { BookmarkIcon, CheckIcon, ChevronRightIcon, Clock3Icon, FlameIcon, MessageCircleIcon, SearchIcon, Settings2Icon, XIcon } from 'lucide-react'
import { useExtracted, useLocale } from 'next-intl'
import { startTransition, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useCommentMetrics } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useCommentMetrics'
import { resolveResolvedOrderPanelDisplay } from '@/app/[locale]/(platform)/event/[slug]/_utils/resolved-order-panel-market'
import PredictionResultsFilters from '@/app/[locale]/(platform)/predictions/[slug]/_components/PredictionResultsFilters'
import PredictionResultsSearchParamsSync from '@/app/[locale]/(platform)/predictions/[slug]/_components/PredictionResultsSearchParamsSync'
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
import { useAppKit } from '@/hooks/useAppKit'
import { useDebounce } from '@/hooks/useDebounce'
import { useOutcomeLabel } from '@/hooks/useOutcomeLabel'
import { usePathname, useRouter } from '@/i18n/navigation'
import { OUTCOME_INDEX } from '@/lib/constants'
import { fetchEventsApi } from '@/lib/events-api'
import { resolveEventPagePath } from '@/lib/events-routing'
import { formatCompactCurrency, formatDate } from '@/lib/formatters'
import { HOME_EVENTS_PAGE_SIZE, isEventResolvedLike } from '@/lib/home-events'
import {
  buildPredictionResultsUrlSearchParams,
  DEFAULT_PREDICTION_RESULTS_SORT,
  DEFAULT_PREDICTION_RESULTS_STATUS,
  resolvePredictionResultsRequestedApiSort,
  resolvePredictionResultsRequestedApiStatus,
} from '@/lib/prediction-results-filters'
import { buildPredictionResultsPath } from '@/lib/prediction-search'
import { cn } from '@/lib/utils'

interface PredictionResultsClientProps {
  displayLabel: string
  initialCurrentTimestamp: number | null
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

function buildDateLabel(event: Event, currentTimestamp: number | null) {
  if (event.status === 'resolved' && event.resolved_at) {
    const resolvedAt = new Date(event.resolved_at)
    return Number.isNaN(resolvedAt.getTime()) ? 'Resolved' : `Resolved ${formatDate(resolvedAt)}`
  }

  if (event.end_date) {
    const endDate = new Date(event.end_date)
    if (Number.isNaN(endDate.getTime())) {
      return 'Ends soon'
    }

    if (currentTimestamp == null) {
      return `Ends ${formatDate(endDate)}`
    }

    const diffMs = endDate.getTime() - currentTimestamp
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

function resolveMarketResultLabel(market: Market | null | undefined) {
  return market?.short_title?.trim() || market?.title?.trim() || null
}

function resolveResolvedPredictionResultLabel(event: Event) {
  const isMultiMarket = Math.max(event.total_markets_count ?? 0, event.markets.length) > 1
  const rankedCandidates = event.markets
    .map((market, index) => {
      const resolvedDisplay = resolveResolvedOrderPanelDisplay({
        event,
        selectedMarket: market,
      })
      const displayMarket = resolvedDisplay.market ?? market
      const resolvedOutcome = displayMarket?.outcomes?.find(
        outcome => outcome.outcome_index === resolvedDisplay.resolvedOutcomeIndex,
      ) ?? null
      const outcomeLabel = resolvedDisplay.outcomeLabel?.trim() || resolvedOutcome?.outcome_text?.trim() || null
      const marketLabel = resolvedDisplay.marketTitle?.trim() || resolveMarketResultLabel(displayMarket)
      const label = isMultiMarket ? marketLabel || outcomeLabel : outcomeLabel || marketLabel
      const rank = resolvedDisplay.resolvedOutcomeIndex === OUTCOME_INDEX.YES
        ? 0
        : resolvedDisplay.resolvedOutcomeIndex === OUTCOME_INDEX.NO
          ? 1
          : 2

      return {
        index,
        label,
        rank,
      }
    })
    .sort((left, right) => (left.rank - right.rank) || (left.index - right.index))

  const winningCandidate = rankedCandidates.find(candidate => Boolean(candidate.label))

  return {
    label: winningCandidate?.label ?? null,
    outcomeIndex: winningCandidate?.rank === 1
      ? OUTCOME_INDEX.NO
      : winningCandidate?.rank === 0
        ? OUTCOME_INDEX.YES
        : null,
  }
}

function filterPredictionEventsByStatus(events: Event[], status: PredictionResultsStatusOption) {
  if (status === 'all') {
    return events
  }

  return events.filter((event) => {
    const isResolvedEvent = isEventResolvedLike(event)
    return status === 'resolved' ? isResolvedEvent : !isResolvedEvent
  })
}

async function fetchPredictionResults({
  currentTimestamp,
  locale,
  pageParam = 0,
  query,
  routeMainTag,
  routeTag,
  sort,
  status,
  bookmarked = false,
}: {
  currentTimestamp: number | null
  locale: string
  pageParam?: number
  query: string
  routeMainTag: string
  routeTag: string
  sort: PredictionResultsSortOption
  status: PredictionResultsStatusOption
  bookmarked?: boolean
}): Promise<Event[]> {
  const requestStatus = resolvePredictionResultsRequestedApiStatus({
    query,
    status,
  })
  const sortBy = resolvePredictionResultsRequestedApiSort({
    query,
    sort,
  })
  return fetchEventsApi({
    tag: routeTag,
    mainTag: routeMainTag,
    search: query,
    bookmarked,
    homeFeed: true,
    locale,
    offset: pageParam,
    status: requestStatus,
    currentTimestamp,
    sort: sortBy,
  })
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
  const { open } = useAppKit()
  const { isConnected } = useAppKitAccount()
  const pathname = usePathname()
  const router = useRouter()
  const lastRequestedUrlRef = useRef<string | null>(null)
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [searchValue, setSearchValue] = useState(initialInputValue)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [selectedSort, setSelectedSort] = useState(initialSort)
  const [selectedStatus, setSelectedStatus] = useState(initialStatus)
  const [currentTimestamp, setCurrentTimestamp] = useState<number | null>(initialCurrentTimestamp)
  const [searchParamsString, setSearchParamsString] = useState('')
  const [searchParamsPathname, setSearchParamsPathname] = useState<string | null>(null)
  const debouncedSearchValue = useDebounce(searchValue, 300)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  const canRetryLoadMoreAfterErrorRef = useRef(true)
  const [infiniteScrollError, setInfiniteScrollError] = useState<string | null>(null)
  const canUseInitialData = !isBookmarked && selectedSort === initialSort && selectedStatus === initialStatus

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
      selectedSort,
      selectedStatus,
      isBookmarked,
      locale,
    ],
    queryFn: ({ pageParam }) => fetchPredictionResults({
      bookmarked: isBookmarked,
      currentTimestamp,
      locale,
      pageParam,
      query: initialQuery,
      routeMainTag,
      routeTag,
      sort: selectedSort,
      status: selectedStatus,
    }),
    getNextPageParam: (lastPage, allPages) => lastPage.length === HOME_EVENTS_PAGE_SIZE ? allPages.length * HOME_EVENTS_PAGE_SIZE : undefined,
    initialData: canUseInitialData ? { pageParams: [0], pages: [initialEvents] } : undefined,
    initialPageParam: 0,
    placeholderData: keepPreviousData,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 'static',
  })

  useEffect(() => {
    function updateCurrentTimestamp() {
      setCurrentTimestamp(Math.floor(Date.now() / 60_000) * 60_000)
    }

    updateCurrentTimestamp()
    const intervalId = window.setInterval(updateCurrentTimestamp, 60_000)

    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    setSearchValue(current => current === initialInputValue ? current : initialInputValue)
  }, [initialInputValue])

  useEffect(() => {
    setIsBookmarked(false)
    setIsDrawerOpen(false)
  }, [initialQuery, routeMainTag, routeTag])

  useEffect(() => {
    setInfiniteScrollError(null)
    canRetryLoadMoreAfterErrorRef.current = true
  }, [initialQuery, selectedSort, selectedStatus, isBookmarked, locale, routeMainTag, routeTag])

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
    if (searchParamsPathname !== pathname) {
      return
    }

    const nextPath = buildPredictionResultsPath(debouncedSearchValue)
    if (!nextPath) {
      return
    }

    const nextParams = buildPredictionResultsUrlSearchParams(searchParamsString, {
      sort: selectedSort,
      status: selectedStatus,
    })
    const nextQuery = nextParams.toString()
    const nextUrl = nextQuery ? `${nextPath}?${nextQuery}` : nextPath
    const currentUrl = searchParamsString ? `${pathname}?${searchParamsString}` : pathname

    if (nextUrl === currentUrl || nextUrl === lastRequestedUrlRef.current) {
      return
    }

    lastRequestedUrlRef.current = nextUrl

    startTransition(() => {
      router.replace(nextUrl as Route, { scroll: false })
    })
  }, [debouncedSearchValue, pathname, router, searchParamsPathname, searchParamsString, selectedSort, selectedStatus])

  useEffect(() => {
    const currentUrl = searchParamsString ? `${pathname}?${searchParamsString}` : pathname

    if (lastRequestedUrlRef.current === currentUrl) {
      lastRequestedUrlRef.current = null
    }
  }, [pathname, searchParamsString])

  const visibleEvents = useMemo(() => {
    const pages = data?.pages.flat() ?? initialEvents
    const filteredPages = filterPredictionEventsByStatus(pages, selectedStatus)
    return sortPredictionEvents(filteredPages, selectedSort)
  }, [data, initialEvents, selectedSort, selectedStatus])

  const isEmptyState = !isPending && !isFetching && visibleEvents.length === 0
  const showInitialSkeleton = visibleEvents.length === 0 && (isPending || isFetching)

  function replaceRoute({
    nextSort = selectedSort,
    nextStatus = selectedStatus,
  }: {
    nextSort?: PredictionResultsSortOption
    nextStatus?: PredictionResultsStatusOption
  }) {
    const nextParams = buildPredictionResultsUrlSearchParams(searchParamsString, {
      sort: nextSort,
      status: nextStatus,
    })
    const nextQuery = nextParams.toString()
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname

    if (nextSort === selectedSort && nextStatus === selectedStatus) {
      return
    }

    setSelectedSort(nextSort)
    setSelectedStatus(nextStatus)

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
    setIsBookmarked(false)
    setSearchValue(initialInputValue)
    replaceRoute({
      nextSort: DEFAULT_PREDICTION_RESULTS_SORT,
      nextStatus: DEFAULT_PREDICTION_RESULTS_STATUS,
    })
  }

  function handleBookmarkToggle() {
    if (!isConnected) {
      queueMicrotask(() => open())
      return
    }

    setIsBookmarked(current => !current)
  }

  const filtersContent = (
    <PredictionResultsFilters
      searchValue={searchValue}
      sort={selectedSort}
      status={selectedStatus}
      onSearchValueChange={setSearchValue}
      onSortChange={value => replaceRoute({ nextSort: value })}
      onStatusChange={value => replaceRoute({ nextStatus: value })}
    />
  )

  return (
    <div className="mx-auto flex w-full min-w-0 flex-col gap-6 lg:flex-row lg:items-start lg:gap-12">
      <Suspense fallback={null}>
        <PredictionResultsSearchParamsSync
          onChange={({ searchParamsString: nextSearchParamsString, sort, status }) => {
            setSearchParamsPathname(current => current === pathname ? current : pathname)
            setSearchParamsString(current => current === nextSearchParamsString ? current : nextSearchParamsString)
            setSelectedSort(current => current === sort ? current : sort)
            setSelectedStatus(current => current === status ? current : status)
          }}
        />
      </Suspense>

      <div className="min-w-0 flex-1">
        <header className="mb-4 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h1 className="text-xl font-medium whitespace-nowrap">
                  {displayLabel}
                  {' '}
                  predictions & odds
                </h1>
                <span className="text-xl text-muted-foreground">·</span>
                <p className="text-base text-muted-foreground md:text-xl">
                  {visibleEvents.length}
                  {' '}
                  {visibleEvents.length === 1 ? t('event') : t('events')}
                </p>
              </div>
            </div>

            <div className="hidden shrink-0 items-center gap-2 lg:flex">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                data-testid="prediction-bookmark-filter"
                title={isBookmarked ? t('Show all items') : t('Show only bookmarked items')}
                aria-label={isBookmarked ? t('Remove bookmark filter') : t('Filter by bookmarks')}
                aria-pressed={isBookmarked}
                onClick={handleBookmarkToggle}
              >
                <BookmarkIcon className={cn('size-6 md:size-5', { 'fill-primary text-primary': isBookmarked })} />
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 lg:hidden">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              data-testid="prediction-bookmark-filter"
              title={isBookmarked ? t('Show all items') : t('Show only bookmarked items')}
              aria-label={isBookmarked ? t('Remove bookmark filter') : t('Filter by bookmarks')}
              aria-pressed={isBookmarked}
              onClick={handleBookmarkToggle}
            >
              <BookmarkIcon className={cn('size-6 md:size-5', { 'fill-primary text-primary': isBookmarked })} />
            </Button>

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
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="
                      mt-4 inline-flex h-10 w-full items-center justify-center text-[13px] font-medium
                      tracking-[-0.09px] text-muted-foreground transition-colors
                      hover:text-foreground
                    "
                  >
                    {t('Clear filters')}
                  </button>
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
                      <PredictionResultRow
                        key={event.id}
                        event={event}
                        currentTimestamp={currentTimestamp}
                        showResolvedOutcomeLayout={selectedStatus === 'resolved'}
                      />
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

        <button
          type="button"
          onClick={handleClearFilters}
          className="
            inline-flex h-10 w-full items-center justify-center text-[13px] font-medium tracking-[-0.09px]
            text-muted-foreground transition-colors
            hover:text-foreground
          "
        >
          {t('Clear filters')}
        </button>
      </aside>
    </div>
  )
}

function PredictionResultRow({
  currentTimestamp,
  event,
  showResolvedOutcomeLayout = false,
}: {
  currentTimestamp: number | null
  event: Event
  showResolvedOutcomeLayout?: boolean
}) {
  const t = useExtracted()
  const locale = useLocale()
  const normalizeOutcomeLabel = useOutcomeLabel()
  const { data: commentMetrics } = useCommentMetrics(event.slug)
  const primaryMarket = resolvePrimaryMarket(event)
  const primaryProbability = primaryMarket?.probability ?? 0
  const supportingTags = event.tags.slice(0, 2)
  const isMultiMarket = Math.max(event.total_markets_count ?? 0, event.markets.length) > 1
  const isResolvedEvent = isEventResolvedLike(event)
  const recentVolume = getEventRecentVolume(event)
  const commentsCount = commentMetrics?.comments_count ?? null
  const eventPath = resolveEventPagePath(event)
  const selectedMarketLabel = primaryMarket?.short_title?.trim()
    || primaryMarket?.title?.trim()
    || (event.status === 'resolved' ? t('Resolved') : t('Market'))
  const resolvedResultDisplay = useMemo(() => {
    if (!showResolvedOutcomeLayout || !isResolvedEvent) {
      return {
        label: null,
        outcomeIndex: null,
      }
    }

    const resolvedDisplay = resolveResolvedPredictionResultLabel(event)
    return {
      label: resolvedDisplay.label ? (normalizeOutcomeLabel(resolvedDisplay.label) || resolvedDisplay.label) : t('Resolved'),
      outcomeIndex: resolvedDisplay.outcomeIndex,
    }
  }, [event, isResolvedEvent, normalizeOutcomeLabel, showResolvedOutcomeLayout, t])
  const resolvedBadgeOutcome = resolvedResultDisplay.outcomeIndex === OUTCOME_INDEX.NO
    ? 'no'
    : resolvedResultDisplay.outcomeIndex === OUTCOME_INDEX.YES
      ? 'yes'
      : 'unknown'

  return (
    <div className="group relative py-4">
      <IntentPrefetchLink
        href={eventPath as Route}
        aria-label={event.title}
        className="absolute inset-0 z-0 rounded-2xl"
      />

      <div className="
        pointer-events-none absolute -inset-x-4 inset-y-0 rounded-2xl bg-accent/35 opacity-0 transition-opacity
        duration-150
        group-hover:opacity-100
      "
      />

      <div className="relative z-10 flex items-center gap-4">
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

        <div className="flex min-w-0 flex-1 items-center gap-4">
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

            <IntentPrefetchLink
              href={eventPath as Route}
              className="pointer-events-auto relative z-20 block rounded-sm focus-visible:outline-none"
            >
              <h2 className="line-clamp-3 text-lg/snug font-medium text-foreground group-hover:underline">
                {event.title}
              </h2>
            </IntentPrefetchLink>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1 whitespace-nowrap">
                <span>
                  {formatCompactCurrency(event.volume ?? 0)}
                  {' '}
                  Vol.
                </span>
              </span>
              <span className="flex items-center gap-1 whitespace-nowrap">
                <FlameIcon className={cn('size-3.5', recentVolume > 200 ? 'text-rose-400' : 'text-muted-foreground')} />
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
                <span>{buildDateLabel(event, currentTimestamp)}</span>
              </span>
            </div>
          </div>

          <div className="flex max-w-[42%] min-w-[112px] shrink-0 items-center gap-3 self-center">
            {showResolvedOutcomeLayout && isResolvedEvent
              ? (
                  <div className="flex min-w-0 flex-1 flex-col items-end justify-center text-right">
                    <div className="flex max-w-full items-center gap-2">
                      <p
                        className="truncate text-lg font-medium text-foreground"
                        title={resolvedResultDisplay.label ?? undefined}
                      >
                        {resolvedResultDisplay.label}
                      </p>
                      <span
                        data-testid="prediction-result-resolved-badge"
                        data-outcome={resolvedBadgeOutcome}
                        className={cn(
                          'flex size-5 shrink-0 items-center justify-center rounded-full',
                          resolvedBadgeOutcome === 'no' && 'bg-no text-background',
                          resolvedBadgeOutcome === 'yes' && 'bg-yes text-background',
                          resolvedBadgeOutcome === 'unknown' && 'bg-muted text-muted-foreground',
                        )}
                      >
                        {resolvedBadgeOutcome === 'no'
                          ? <XIcon className="size-3.5" strokeWidth={2.6} />
                          : resolvedBadgeOutcome === 'yes'
                            ? <CheckIcon className="size-3.5" strokeWidth={2.6} />
                            : <span className="size-2 rounded-full bg-current" />}
                      </span>
                    </div>
                  </div>
                )
              : (
                  <div className="flex min-w-0 flex-1 flex-col items-end justify-center text-right">
                    <p className="
                      truncate text-xl leading-none font-semibold tracking-tight text-foreground
                      md:text-[26px]
                    "
                    >
                      {Math.round(primaryProbability)}
                      %
                    </p>
                    {isMultiMarket && (
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {selectedMarketLabel}
                      </p>
                    )}
                  </div>
                )}
            <ChevronRightIcon className="
              size-4 shrink-0 text-muted-foreground transition-transform duration-150
              group-hover:translate-x-0.5
            "
            />
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
        <div key={index} className="flex items-center gap-4 py-4">
          <Skeleton className="size-12 rounded-md md:size-13" />
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex gap-2">
              <Skeleton className="h-4 w-16 rounded-full" />
              <Skeleton className="h-4 w-14 rounded-full" />
            </div>
            <Skeleton className="h-5 w-4/5" />
            <Skeleton className="mt-2 h-4 w-3/5" />
          </div>
          <div className="ml-auto flex flex-col items-end justify-center gap-2 text-right">
            <Skeleton className="ml-auto h-6 w-12" />
            <Skeleton className="ml-auto h-3 w-20" />
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
