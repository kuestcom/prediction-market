'use client'

import type { ConditionChangeLogEntry, Event, EventLiveChartConfig, EventSeriesEntry, User } from '@/types'
import { ArrowUpIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
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

function EventOrderQuerySync({ event, marketSlug, isMobile }: EventOrderQuerySyncProps) {
  const searchParams = useSearchParams()
  const setMarket = useOrder(state => state.setMarket)
  const setOutcome = useOrder(state => state.setOutcome)
  const setSide = useOrder(state => state.setSide)
  const setType = useOrder(state => state.setType)
  const setAmount = useOrder(state => state.setAmount)
  const setLimitShares = useOrder(state => state.setLimitShares)
  const setIsMobileOrderPanelOpen = useOrder(state => state.setIsMobileOrderPanelOpen)
  const appliedOrderParamsRef = useRef<string | null>(null)

  useEffect(() => {
    const paramsKey = searchParams.toString()
    if (!paramsKey) {
      return
    }

    const sideParam = searchParams.get('side')?.trim()
    const orderTypeParam = searchParams.get('orderType')?.trim()
    const outcomeIndexParam = searchParams.get('outcomeIndex')?.trim()
    const sharesParam = searchParams.get('shares')?.trim()
    const conditionIdParam = searchParams.get('conditionId')?.trim()

    if (!sideParam && !orderTypeParam && !outcomeIndexParam && !sharesParam && !conditionIdParam) {
      return
    }

    const appliedKey = `${event.id}:${marketSlug ?? ''}:${paramsKey}`
    if (appliedOrderParamsRef.current === appliedKey) {
      return
    }
    appliedOrderParamsRef.current = appliedKey

    const market = conditionIdParam
      ? event.markets.find(item => item.condition_id === conditionIdParam)
      : marketSlug
        ? event.markets.find(item => item.slug === marketSlug)
        : resolveDefaultMarket(event.markets)
    if (!market) {
      return
    }

    setMarket(market)

    const parsedOutcomeIndex = Number.parseInt(outcomeIndexParam ?? '', 10)
    const resolvedOutcomeIndex = Number.isFinite(parsedOutcomeIndex)
      ? parsedOutcomeIndex
      : null
    if (resolvedOutcomeIndex !== null) {
      const targetOutcome = market.outcomes.find(outcome => outcome.outcome_index === resolvedOutcomeIndex)
        ?? market.outcomes[resolvedOutcomeIndex]
      if (targetOutcome) {
        setOutcome(targetOutcome)
      }
    }

    const normalizedSide = sideParam?.toUpperCase()
    if (normalizedSide === 'SELL') {
      setSide(ORDER_SIDE.SELL)
    }
    else if (normalizedSide === 'BUY') {
      setSide(ORDER_SIDE.BUY)
    }

    const normalizedOrderType = orderTypeParam?.toUpperCase()
    if (normalizedOrderType === 'LIMIT') {
      setType(ORDER_TYPE.LIMIT)
    }
    else if (normalizedOrderType === 'MARKET') {
      setType(ORDER_TYPE.MARKET)
    }

    const parsedShares = sharesParam ? Number.parseFloat(sharesParam) : Number.NaN
    if (Number.isFinite(parsedShares) && parsedShares > 0) {
      const sharesValue = formatAmountInputValue(parsedShares)
      if (normalizedOrderType === 'LIMIT') {
        setLimitShares(sharesValue)
      }
      else if (normalizedSide === 'SELL') {
        setAmount(sharesValue)
      }
    }

    if (isMobile) {
      setIsMobileOrderPanelOpen(true)
    }
  }, [
    event,
    isMobile,
    marketSlug,
    searchParams,
    setAmount,
    setIsMobileOrderPanelOpen,
    setLimitShares,
    setMarket,
    setOutcome,
    setSide,
    setType,
  ])

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
  const setEvent = useOrder(state => state.setEvent)
  const setMarket = useOrder(state => state.setMarket)
  const setOutcome = useOrder(state => state.setOutcome)
  const currentEventId = useOrder(state => state.event?.id)
  const currentMarketId = useOrder(state => state.market?.condition_id)
  const isMobile = useIsMobile()
  const clientUser = useUser()
  const prevUserIdRef = useRef<string | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const eventMarketsRef = useRef<HTMLDivElement | null>(null)
  const appliedMarketSlugRef = useRef<string | null>(null)
  const appliedEventIdRef = useRef<string | null>(null)
  const currentUser = clientUser ?? user
  const isNegRiskEnabled = Boolean(event.enable_neg_risk || event.neg_risk)
  const shouldHideChart = event.total_markets_count > 1 && !isNegRiskEnabled
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
  const [hasResolvedMobileBreakpoint, setHasResolvedMobileBreakpoint] = useState(false)
  const [showBackToTop, setShowBackToTop] = useState(false)
  const [backToTopBounds, setBackToTopBounds] = useState<{ left: number, width: number } | null>(null)
  const selectedMarket = useMemo(() => {
    if (!currentMarketId) {
      return initialMarket
    }
    return event.markets.find(market => market.condition_id === currentMarketId) ?? initialMarket
  }, [currentMarketId, event.markets, initialMarket])
  const singleMarket = event.markets[0]
  const isSingleMarketResolved = isMarketResolved(singleMarket)
  const usesLiveSeriesChart = Boolean(liveChartConfig && shouldUseLiveSeriesChart(event, liveChartConfig))
  const shouldRenderMobileRelated = hasResolvedMobileBreakpoint && isMobile
  const shouldRenderDesktopRelated = hasResolvedMobileBreakpoint && !isMobile

  useEffect(() => {
    let isActive = true

    queueMicrotask(() => {
      if (isActive) {
        setHasResolvedMobileBreakpoint(true)
      }
    })

    return () => {
      isActive = false
    }
  }, [])

  useEffect(() => {
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

  useEffect(() => {
    setEvent(event)
  }, [event, setEvent])

  useEffect(() => {
    const targetMarket = marketSlug
      ? event.markets.find(market => market.slug === marketSlug)
      : resolveDefaultMarket(event.markets)
    if (!targetMarket) {
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
      targetMarket,
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
  }, [currentEventId, currentMarketId, event, marketSlug, setMarket, setOutcome])

  useEffect(() => {
    if (isMobile) {
      setShowBackToTop(false)
      setBackToTopBounds(null)
      return
    }

    function handleScroll() {
      if (!eventMarketsRef.current) {
        setShowBackToTop(false)
        return
      }

      const eventMarketsTop = eventMarketsRef.current.getBoundingClientRect().top + window.scrollY
      setShowBackToTop(window.scrollY >= eventMarketsTop - 80)
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [isMobile])

  useEffect(() => {
    if (isMobile) {
      setBackToTopBounds(null)
      return
    }

    function handleResize() {
      if (!contentRef.current) {
        setBackToTopBounds(null)
        return
      }

      const rect = contentRef.current.getBoundingClientRect()
      setBackToTopBounds({ left: rect.left, width: rect.width })
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isMobile])

  function handleBackToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <EventMarketChannelProvider markets={event.markets}>
      <EventOutcomeChanceProvider eventId={event.id}>
        <OrderLimitPriceSync />
        <Suspense fallback={null}>
          <EventOrderQuerySync event={event} marketSlug={marketSlug} isMobile={isMobile} />
        </Suspense>
        <div className="grid gap-6 pt-5 pb-20 md:pb-0">
          <div className={cn(shouldHideChart ? 'grid gap-2' : 'grid gap-3')} ref={contentRef}>
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
                  <ResolutionTimelinePanel market={selectedMarket} settledUrl={null} showLink={false} />
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

        {!isMobile && showBackToTop && backToTopBounds && (
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
