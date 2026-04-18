'use client'

import type { ReadonlyURLSearchParams } from 'next/navigation'
import type { ConditionChangeLogEntry, Event, EventLiveChartConfig, EventSeriesEntry, User } from '@/types'
import { ArrowUpIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import EventCategoryNote from '@/app/[locale]/(platform)/event/[slug]/_components/EventCategoryNote'
import EventHeader from '@/app/[locale]/(platform)/event/[slug]/_components/EventHeader'
import EventMarketChannelProvider from '@/app/[locale]/(platform)/event/[slug]/_components/EventMarketChannelProvider'
import EventMarkets from '@/app/[locale]/(platform)/event/[slug]/_components/EventMarkets'
import EventOrderPanelForm from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelForm'
import EventOrderPanelTermsDisclaimer from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelTermsDisclaimer'
import { EventOutcomeChanceProvider } from '@/app/[locale]/(platform)/event/[slug]/_components/EventOutcomeChanceProvider'
import EventRelatedSkeleton from '@/app/[locale]/(platform)/event/[slug]/_components/EventRelatedSkeleton'
import EventRules from '@/app/[locale]/(platform)/event/[slug]/_components/EventRules'
import EventSingleMarketOrderBook from '@/app/[locale]/(platform)/event/[slug]/_components/EventSingleMarketOrderBook'
import EventTabs from '@/app/[locale]/(platform)/event/[slug]/_components/EventTabs'
import ResolutionTimelinePanel from '@/app/[locale]/(platform)/event/[slug]/_components/ResolutionTimelinePanel'
import { resolveEventOrderBootstrapSelection } from '@/app/[locale]/(platform)/event/[slug]/_utils/event-order-bootstrap-selection'
import {
  resolveEventResolvedOutcomeIndex,
  toResolutionTimelineOutcome,
} from '@/app/[locale]/(platform)/event/[slug]/_utils/eventResolvedOutcome'
import { shouldDisplayResolutionTimeline } from '@/app/[locale]/(platform)/event/[slug]/_utils/resolution-timeline-builder'
import { Skeleton } from '@/components/ui/skeleton'
import { useIsMobile } from '@/hooks/useIsMobile'
import { ORDER_SIDE, ORDER_TYPE } from '@/lib/constants'
import { formatAmountInputValue } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useOrder, useSyncLimitPriceWithOutcome } from '@/stores/useOrder'
import { useUser } from '@/stores/useUser'
import EventChart from './EventChart'
import EventLiveSeriesChart, { shouldUseLiveSeriesChart } from './EventLiveSeriesChart'

const EventMarketContext = dynamic(
  () => import('@/app/[locale]/(platform)/event/[slug]/_components/EventMarketContext'),
  { ssr: false, loading: () => <Skeleton className="h-18" /> },
)

const EventOrderPanelMobile = dynamic(
  () => import('@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelMobile'),
  { ssr: false, loading: () => null },
)

const EventRelated = dynamic(
  () => import('@/app/[locale]/(platform)/event/[slug]/_components/EventRelated'),
  { ssr: false, loading: () => <EventRelatedSkeleton /> },
)

const EventMarketPositions = dynamic(
  () => import('@/app/[locale]/(platform)/event/[slug]/_components/EventMarketPositions'),
  { ssr: false, loading: () => <Skeleton className="h-52" /> },
)

const EventMarketOpenOrders = dynamic(
  () => import('@/app/[locale]/(platform)/event/[slug]/_components/EventMarketOpenOrders'),
  { ssr: false, loading: () => <Skeleton className="h-52" /> },
)

const EventMarketHistory = dynamic(
  () => import('@/app/[locale]/(platform)/event/[slug]/_components/EventMarketHistory'),
  { ssr: false, loading: () => <Skeleton className="h-52" /> },
)

interface EventContentProps {
  event: Event
  user: User | null
  marketContextEnabled: boolean
  changeLogEntries: ConditionChangeLogEntry[]
  marketSlug?: string
  seriesEvents?: EventSeriesEntry[]
  liveChartConfig?: EventLiveChartConfig | null
}

function isMarketResolved(market: Event['markets'][number] | null | undefined) {
  return Boolean(market?.is_resolved || market?.condition?.resolved)
}

function resolveDefaultMarket(markets: Event['markets']) {
  return markets.find(market => market.is_active && !isMarketResolved(market))
    ?? markets.find(market => !isMarketResolved(market))
    ?? markets[0]
}

interface EventOrderQuerySyncProps {
  event: Event
  marketSlug?: string
  isMobile: boolean
}

interface ResolvedEventOrderQueryState {
  appliedKey: string
  market: Event['markets'][number]
  targetOutcome: Event['markets'][number]['outcomes'][number] | null
  normalizedSide: string | undefined
  normalizedOrderType: string | undefined
  sharesValue: string | null
}

function resolveEventOrderQueryState(
  event: Event,
  marketSlug: string | undefined,
  searchParams: ReadonlyURLSearchParams,
): ResolvedEventOrderQueryState | null {
  const paramsKey = searchParams.toString()
  if (!paramsKey) {
    return null
  }

  const sideParam = searchParams.get('side')?.trim()
  const orderTypeParam = searchParams.get('orderType')?.trim()
  const outcomeIndexParam = searchParams.get('outcomeIndex')?.trim()
  const sharesParam = searchParams.get('shares')?.trim()
  const conditionIdParam = searchParams.get('conditionId')?.trim()

  if (!sideParam && !orderTypeParam && !outcomeIndexParam && !sharesParam && !conditionIdParam) {
    return null
  }

  const market = conditionIdParam
    ? event.markets.find(item => item.condition_id === conditionIdParam)
    : marketSlug
      ? event.markets.find(item => item.slug === marketSlug)
      : resolveDefaultMarket(event.markets)
  if (!market) {
    return null
  }

  const parsedOutcomeIndex = Number.parseInt(outcomeIndexParam ?? '', 10)
  const resolvedOutcomeIndex = Number.isFinite(parsedOutcomeIndex)
    ? parsedOutcomeIndex
    : null
  const targetOutcome = resolvedOutcomeIndex !== null
    ? market.outcomes.find(outcome => outcome.outcome_index === resolvedOutcomeIndex)
    ?? market.outcomes[resolvedOutcomeIndex]
    ?? null
    : null
  const normalizedSide = sideParam?.toUpperCase()
  const normalizedOrderType = orderTypeParam?.toUpperCase()
  const parsedShares = sharesParam ? Number.parseFloat(sharesParam) : Number.NaN
  const sharesValue = Number.isFinite(parsedShares) && parsedShares > 0
    ? formatAmountInputValue(parsedShares)
    : null

  return {
    appliedKey: `${event.id}:${marketSlug ?? ''}:${paramsKey}`,
    market,
    targetOutcome,
    normalizedSide,
    normalizedOrderType,
    sharesValue,
  }
}

function resolveBootstrapTargetMarket(event: Event, marketSlug?: string) {
  if (marketSlug) {
    return event.markets.find(market => market.slug === marketSlug) ?? null
  }

  return resolveDefaultMarket(event.markets) ?? null
}

interface WindowViewportSnapshot {
  scrollY: number
  viewportWidth: number
}

const DEFAULT_WINDOW_VIEWPORT_SNAPSHOT: WindowViewportSnapshot = {
  scrollY: 0,
  viewportWidth: 0,
}

let windowViewportSnapshot: WindowViewportSnapshot = DEFAULT_WINDOW_VIEWPORT_SNAPSHOT

function subscribeWindowViewport(onStoreChange: () => void) {
  if (typeof window === 'undefined') {
    return () => {}
  }

  window.addEventListener('scroll', onStoreChange, { passive: true })
  window.addEventListener('resize', onStoreChange)
  return () => {
    window.removeEventListener('scroll', onStoreChange)
    window.removeEventListener('resize', onStoreChange)
  }
}

function getWindowViewportSnapshot() {
  if (typeof window === 'undefined') {
    return DEFAULT_WINDOW_VIEWPORT_SNAPSHOT
  }

  const scrollY = window.scrollY
  const viewportWidth = window.innerWidth
  if (windowViewportSnapshot.scrollY === scrollY && windowViewportSnapshot.viewportWidth === viewportWidth) {
    return windowViewportSnapshot
  }

  windowViewportSnapshot = {
    scrollY,
    viewportWidth,
  }
  return windowViewportSnapshot
}

function useWindowViewport() {
  return useSyncExternalStore(
    subscribeWindowViewport,
    getWindowViewportSnapshot,
    () => DEFAULT_WINDOW_VIEWPORT_SNAPSHOT,
  )
}

function useHasResolvedMobileBreakpoint() {
  const [hasResolvedMobileBreakpoint, setHasResolvedMobileBreakpoint] = useState(false)

  useEffect(function resolveMobileBreakpointOnMount() {
    let isActive = true

    queueMicrotask(function markBreakpointResolved() {
      if (isActive) {
        setHasResolvedMobileBreakpoint(true)
      }
    })

    return function cancelBreakpointResolution() {
      isActive = false
    }
  }, [])

  return hasResolvedMobileBreakpoint
}

function useSyncUserToClientStore(user: User | null) {
  const prevUserIdRef = useRef<string | null>(null)

  useEffect(function syncServerUserToClientStore() {
    if (user?.id) {
      prevUserIdRef.current = user.id
      useUser.setState(user)
      return
    }

    if (!user && prevUserIdRef.current) {
      prevUserIdRef.current = null
      useUser.setState(null)
    }
  }, [user])
}

function useSetEventInOrderStore(event: Event) {
  const setEvent = useOrder(state => state.setEvent)

  useEffect(function writeEventToOrderStore() {
    setEvent(event)
  }, [event, setEvent])
}

function useOrderBootstrapMarketSelection({
  event,
  marketSlug,
  orderBootstrapTargetMarket,
  currentEventId,
  currentMarketId,
}: {
  event: Event
  marketSlug: string | undefined
  orderBootstrapTargetMarket: Event['markets'][number] | null
  currentEventId: string | undefined
  currentMarketId: string | undefined
}) {
  const appliedMarketSlugRef = useRef<string | null>(null)
  const appliedEventIdRef = useRef<string | null>(null)
  const setMarket = useOrder(state => state.setMarket)
  const setOutcome = useOrder(state => state.setOutcome)

  useEffect(function bootstrapOrderMarketSelection() {
    if (!orderBootstrapTargetMarket) {
      return
    }

    const shouldApplyMarket = marketSlug
      ? appliedMarketSlugRef.current !== marketSlug
      || appliedEventIdRef.current !== event.id
      || !currentMarketId
      : currentEventId !== event.id
        || !currentMarketId

    if (!shouldApplyMarket) {
      return
    }

    const currentOrderState = useOrder.getState()
    const nextSelection = resolveEventOrderBootstrapSelection({
      event,
      targetMarket: orderBootstrapTargetMarket,
      preserveSnapshotMarket: !marketSlug,
      snapshot: {
        eventId: currentOrderState.event?.id,
        market: currentOrderState.market,
        outcome: currentOrderState.outcome,
      },
    })

    setMarket(nextSelection.market)
    if (nextSelection.outcome) {
      setOutcome(nextSelection.outcome)
    }
    appliedMarketSlugRef.current = marketSlug ?? null
    appliedEventIdRef.current = event.id
  }, [currentEventId, currentMarketId, event, marketSlug, orderBootstrapTargetMarket, setMarket, setOutcome])
}

function useInitialMarketAndOutcome({
  event,
  marketSlug,
}: {
  event: Event
  marketSlug: string | undefined
}) {
  const initialMarket = useMemo(() => {
    if (marketSlug) {
      return event.markets.find(market => market.slug === marketSlug) ?? resolveDefaultMarket(event.markets) ?? null
    }
    return resolveDefaultMarket(event.markets) ?? null
  }, [event.markets, marketSlug])

  const initialOutcome = useMemo(() => {
    if (!initialMarket) {
      return null
    }
    return initialMarket.outcomes[0] ?? null
  }, [initialMarket])

  return { initialMarket, initialOutcome }
}

function useSelectedMarketInfo({
  event,
  currentMarketId,
  initialMarket,
}: {
  event: Event
  currentMarketId: string | undefined
  initialMarket: Event['markets'][number] | null
}) {
  const selectedMarket = useMemo(() => {
    if (!currentMarketId) {
      return initialMarket
    }
    return event.markets.find(market => market.condition_id === currentMarketId) ?? initialMarket
  }, [currentMarketId, event.markets, initialMarket])

  const selectedMarketTimelineOutcome = useMemo(() => {
    return selectedMarket && isMarketResolved(selectedMarket)
      ? toResolutionTimelineOutcome(resolveEventResolvedOutcomeIndex(event, selectedMarket))
      : null
  }, [event, selectedMarket])

  return { selectedMarket, selectedMarketTimelineOutcome }
}

function useBackToTopBounds({
  isMobile,
  scrollY,
  viewportWidth,
  contentRef,
  eventMarketsRef,
}: {
  isMobile: boolean
  scrollY: number
  viewportWidth: number
  contentRef: React.RefObject<HTMLDivElement | null>
  eventMarketsRef: React.RefObject<HTMLDivElement | null>
}) {
  return useMemo(() => {
    if (isMobile || !contentRef.current || !eventMarketsRef.current) {
      return null
    }

    const eventMarketsTop = eventMarketsRef.current.getBoundingClientRect().top + scrollY
    if (scrollY < eventMarketsTop - 80) {
      return null
    }

    const rect = contentRef.current.getBoundingClientRect()
    const boundedWidth = viewportWidth > 0 ? Math.min(rect.width, viewportWidth) : rect.width
    return {
      left: rect.left,
      width: boundedWidth,
    }
  }, [contentRef, eventMarketsRef, isMobile, scrollY, viewportWidth])
}

function useAppliedOrderQuerySync({
  resolvedQueryState,
  isMobile,
}: {
  resolvedQueryState: ResolvedEventOrderQueryState | null
  isMobile: boolean
}) {
  const appliedOrderParamsRef = useRef<string | null>(null)
  const setMarket = useOrder(state => state.setMarket)
  const setOutcome = useOrder(state => state.setOutcome)
  const setSide = useOrder(state => state.setSide)
  const setType = useOrder(state => state.setType)
  const setAmount = useOrder(state => state.setAmount)
  const setLimitShares = useOrder(state => state.setLimitShares)
  const setIsMobileOrderPanelOpen = useOrder(state => state.setIsMobileOrderPanelOpen)

  useEffect(function applyOrderQueryParamsToStore() {
    if (!resolvedQueryState) {
      return
    }

    if (appliedOrderParamsRef.current === resolvedQueryState.appliedKey) {
      return
    }
    appliedOrderParamsRef.current = resolvedQueryState.appliedKey

    setMarket(resolvedQueryState.market)
    if (resolvedQueryState.targetOutcome) {
      setOutcome(resolvedQueryState.targetOutcome)
    }

    if (resolvedQueryState.normalizedSide === 'SELL') {
      setSide(ORDER_SIDE.SELL)
    }
    else if (resolvedQueryState.normalizedSide === 'BUY') {
      setSide(ORDER_SIDE.BUY)
    }

    if (resolvedQueryState.normalizedOrderType === 'LIMIT') {
      setType(ORDER_TYPE.LIMIT)
    }
    else if (resolvedQueryState.normalizedOrderType === 'MARKET') {
      setType(ORDER_TYPE.MARKET)
    }

    if (resolvedQueryState.sharesValue) {
      if (resolvedQueryState.normalizedOrderType === 'LIMIT') {
        setLimitShares(resolvedQueryState.sharesValue)
      }
      else if (resolvedQueryState.normalizedSide === 'SELL') {
        setAmount(resolvedQueryState.sharesValue)
      }
    }

    if (isMobile) {
      setIsMobileOrderPanelOpen(true)
    }
  }, [
    isMobile,
    setAmount,
    setIsMobileOrderPanelOpen,
    setLimitShares,
    setMarket,
    setOutcome,
    resolvedQueryState,
    setSide,
    setType,
  ])
}

function EventOrderQuerySync({ event, marketSlug, isMobile }: EventOrderQuerySyncProps) {
  const searchParams = useSearchParams()
  const resolvedQueryState = useMemo(
    () => resolveEventOrderQueryState(event, marketSlug, searchParams),
    [event, marketSlug, searchParams],
  )

  useAppliedOrderQuerySync({
    resolvedQueryState,
    isMobile,
  })

  return null
}

export default function EventContent({
  event,
  user,
  marketContextEnabled,
  changeLogEntries: _changeLogEntries,
  marketSlug,
  seriesEvents = [],
  liveChartConfig = null,
}: EventContentProps) {
  const t = useExtracted()
  const currentEventId = useOrder(state => state.event?.id)
  const currentMarketId = useOrder(state => state.market?.condition_id)
  const isMobile = useIsMobile()
  const clientUser = useUser()
  const contentRef = useRef<HTMLDivElement | null>(null)
  const eventMarketsRef = useRef<HTMLDivElement | null>(null)
  const windowViewport = useWindowViewport()
  const scrollY = windowViewport.scrollY
  const viewportWidth = windowViewport.viewportWidth
  const currentUser = clientUser ?? user
  const isNegRiskEnabled = Boolean(event.enable_neg_risk || event.neg_risk)
  const shouldHideChart = event.total_markets_count > 1 && !isNegRiskEnabled
  const orderBootstrapTargetMarket = useMemo(
    () => resolveBootstrapTargetMarket(event, marketSlug),
    [event, marketSlug],
  )
  const { initialMarket, initialOutcome } = useInitialMarketAndOutcome({ event, marketSlug })
  const hasResolvedMobileBreakpoint = useHasResolvedMobileBreakpoint()
  const { selectedMarket, selectedMarketTimelineOutcome } = useSelectedMarketInfo({
    event,
    currentMarketId,
    initialMarket,
  })
  const singleMarket = event.markets[0]
  const isSingleMarketResolved = isMarketResolved(singleMarket)
  const usesLiveSeriesChart = Boolean(liveChartConfig && shouldUseLiveSeriesChart(event, liveChartConfig))
  const shouldRenderMobileRelated = hasResolvedMobileBreakpoint && isMobile
  const shouldRenderDesktopRelated = hasResolvedMobileBreakpoint && !isMobile
  const backToTopBounds = useBackToTopBounds({
    isMobile,
    scrollY,
    viewportWidth,
    contentRef,
    eventMarketsRef,
  })

  useSyncUserToClientStore(user)
  useSetEventInOrderStore(event)
  useOrderBootstrapMarketSelection({
    event,
    marketSlug,
    orderBootstrapTargetMarket,
    currentEventId,
    currentMarketId,
  })

  function handleBackToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <EventMarketChannelProvider markets={event.markets}>
      <EventOutcomeChanceProvider key={event.id}>
        <OrderLimitPriceSync />
        <Suspense fallback={null}>
          <EventOrderQuerySync event={event} marketSlug={marketSlug} isMobile={isMobile} />
        </Suspense>
        <div className="grid gap-6 pt-5 pb-20 md:pb-0">
          <div className={cn(shouldHideChart ? 'grid gap-2' : 'grid gap-3')} ref={contentRef}>
            <EventCategoryNote event={event} />
            <EventHeader event={event} />

            <div className={cn(shouldHideChart ? 'w-full' : 'min-h-96 w-full')}>
              {usesLiveSeriesChart
                ? (
                    <EventLiveSeriesChart
                      event={event}
                      isMobile={isMobile}
                      seriesEvents={seriesEvents}
                      config={liveChartConfig!}
                    />
                  )
                : (
                    <EventChart event={event} isMobile={isMobile} seriesEvents={seriesEvents} />
                  )}
            </div>

            <div className="grid gap-6">
              <div
                ref={eventMarketsRef}
                id="event-markets"
                className="min-w-0 overflow-x-hidden lg:overflow-x-visible"
              >
                {event.total_markets_count > 1 && <EventMarkets event={event} isMobile={isMobile} />}
              </div>
              {event.total_markets_count === 1 && singleMarket && (
                <div className="grid gap-6">
                  {currentUser && (
                    <EventMarketPositions
                      market={singleMarket}
                      eventId={event.id}
                      eventSlug={event.slug}
                      isNegRiskEnabled={isNegRiskEnabled}
                      isNegRiskAugmented={Boolean(event.neg_risk_augmented)}
                      eventOutcomes={event.markets.map(market => ({
                        conditionId: market.condition_id,
                        questionId: market.question_id,
                        label: market.short_title || market.title,
                        iconUrl: market.icon_url,
                      }))}
                      negRiskMarketId={event.neg_risk_market_id}
                    />
                  )}
                  {!isSingleMarketResolved && (
                    <EventSingleMarketOrderBook
                      market={singleMarket}
                      eventSlug={event.slug}
                      showCompactVolume={usesLiveSeriesChart}
                    />
                  )}
                  {currentUser && <EventMarketOpenOrders market={singleMarket} eventSlug={event.slug} />}
                  {currentUser && <EventMarketHistory market={singleMarket} />}
                </div>
              )}
              {marketContextEnabled && <EventMarketContext event={event} />}
              <EventRules event={event} />
              {event.total_markets_count === 1
                && selectedMarket
                && shouldDisplayResolutionTimeline(selectedMarket) && (
                <div className="rounded-xl border bg-background p-4">
                  <ResolutionTimelinePanel
                    market={selectedMarket}
                    settledUrl={null}
                    outcomeOverride={selectedMarketTimelineOutcome}
                    showLink={false}
                  />
                </div>
              )}
            </div>

            {shouldRenderMobileRelated && (
              <div className="grid gap-4 lg:hidden">
                <h3 className="text-base font-medium">{t('Related')}</h3>
                <EventRelated event={event} />
              </div>
            )}
            <EventTabs event={event} user={currentUser} />
          </div>
        </div>

        {!isMobile && (
          <aside
            className={`
              hidden gap-4
              lg:sticky lg:top-38 lg:grid lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto
            `}
          >
            <div className="grid gap-6">
              <EventOrderPanelForm
                event={event}
                isMobile={false}
                initialMarket={initialMarket}
                initialOutcome={initialOutcome}
              />
              <EventOrderPanelTermsDisclaimer />
              <span className="border border-dashed"></span>
              {shouldRenderDesktopRelated ? <EventRelated event={event} /> : <EventRelatedSkeleton />}
            </div>
          </aside>
        )}

        {!isMobile && backToTopBounds && (
          <div
            className="pointer-events-none fixed bottom-6 hidden md:flex"
            style={{ left: `${backToTopBounds.left}px`, width: `${backToTopBounds.width}px` }}
          >
            <div className="grid w-full grid-cols-3 items-center px-4">
              <div />
              <button
                type="button"
                onClick={handleBackToTop}
                className={`
                  pointer-events-auto justify-self-center rounded-full border bg-background/90 px-4 py-2 text-sm
                  font-medium text-foreground shadow-lg backdrop-blur-sm transition-colors
                  hover:text-muted-foreground
                `}
                aria-label={t('Back to top')}
              >
                <span className="inline-flex items-center gap-2">
                  {t('Back to top')}
                  <ArrowUpIcon className="size-4" />
                </span>
              </button>
            </div>
          </div>
        )}

        {isMobile
          ? <EventOrderPanelMobile event={event} initialMarket={initialMarket} initialOutcome={initialOutcome} />
          : null}
      </EventOutcomeChanceProvider>
    </EventMarketChannelProvider>
  )
}

function OrderLimitPriceSync() {
  useSyncLimitPriceWithOutcome()
  return null
}
