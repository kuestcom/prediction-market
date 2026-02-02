'use client'

import type { ConditionChangeLogEntry, Event, User } from '@/types'
import { ArrowUpIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import EventHeader from '@/app/[locale]/(platform)/event/[slug]/_components/EventHeader'
import EventMarketChannelProvider from '@/app/[locale]/(platform)/event/[slug]/_components/EventMarketChannelProvider'
import EventMarkets, { ResolvedResolutionPanel, resolveWinningOutcomeIndex } from '@/app/[locale]/(platform)/event/[slug]/_components/EventMarkets'
import EventOrderPanelForm from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelForm'
import EventOrderPanelMobile from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelMobile'
import { EventOutcomeChanceProvider } from '@/app/[locale]/(platform)/event/[slug]/_components/EventOutcomeChanceProvider'
import EventRelated from '@/app/[locale]/(platform)/event/[slug]/_components/EventRelated'
import EventRules from '@/app/[locale]/(platform)/event/[slug]/_components/EventRules'
import EventSingleMarketOrderBook from '@/app/[locale]/(platform)/event/[slug]/_components/EventSingleMarketOrderBook'
import EventTabs from '@/app/[locale]/(platform)/event/[slug]/_components/EventTabs'
import { Teleport } from '@/components/Teleport'
import { useIsMobile } from '@/hooks/useIsMobile'
import { ORDER_SIDE, ORDER_TYPE, OUTCOME_INDEX } from '@/lib/constants'
import { formatAmountInputValue } from '@/lib/formatters'
import { useOrder, useSyncLimitPriceWithOutcome } from '@/stores/useOrder'
import { useUser } from '@/stores/useUser'
import EventChart from './EventChart'
import EventMarketHistory from './EventMarketHistory'
import EventMarketOpenOrders from './EventMarketOpenOrders'
import EventMarketPositions from './EventMarketPositions'

const EventMarketContext = dynamic(
  () => import('@/app/[locale]/(platform)/event/[slug]/_components/EventMarketContext'),
  { ssr: false, loading: () => null },
)

interface EventContentProps {
  event: Event
  user: User | null
  marketContextEnabled: boolean
  changeLogEntries: ConditionChangeLogEntry[]
  marketSlug?: string
}

export default function EventContent({
  event,
  user,
  marketContextEnabled,
  changeLogEntries: _changeLogEntries,
  marketSlug,
}: EventContentProps) {
  const t = useExtracted()
  const setEvent = useOrder(state => state.setEvent)
  const setMarket = useOrder(state => state.setMarket)
  const setOutcome = useOrder(state => state.setOutcome)
  const setSide = useOrder(state => state.setSide)
  const setType = useOrder(state => state.setType)
  const setAmount = useOrder(state => state.setAmount)
  const setLimitShares = useOrder(state => state.setLimitShares)
  const setIsMobileOrderPanelOpen = useOrder(state => state.setIsMobileOrderPanelOpen)
  const currentEventId = useOrder(state => state.event?.id)
  const currentMarketId = useOrder(state => state.market?.condition_id)
  const isMobile = useIsMobile()
  const searchParams = useSearchParams()
  const clientUser = useUser()
  const prevUserId = useRef<string | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const eventMarketsRef = useRef<HTMLDivElement | null>(null)
  const appliedOrderParamsRef = useRef<string | null>(null)
  const appliedMarketSlugRef = useRef<string | null>(null)
  const appliedEventIdRef = useRef<string | null>(null)
  const currentUser = clientUser ?? user
  const [showBackToTop, setShowBackToTop] = useState(false)
  const [backToTopBounds, setBackToTopBounds] = useState<{ left: number, width: number } | null>(null)
  const selectedMarket = useMemo(() => {
    if (!currentMarketId) {
      return null
    }
    return event.markets.find(market => market.condition_id === currentMarketId) ?? null
  }, [currentMarketId, event.markets])
  const selectedMarketResolved = Boolean(selectedMarket?.is_resolved || selectedMarket?.condition?.resolved)
  const selectedResolvedOutcomeIndex = useMemo(() => {
    if (!selectedMarket) {
      return null
    }
    return resolveWinningOutcomeIndex(selectedMarket)
  }, [selectedMarket])
  const selectedResolvedOutcomeLabel = selectedResolvedOutcomeIndex === OUTCOME_INDEX.NO
    ? t('No')
    : selectedResolvedOutcomeIndex === OUTCOME_INDEX.YES
      ? t('Yes')
      : 'Unknown'

  useEffect(() => {
    if (user?.id) {
      prevUserId.current = user.id
      useUser.setState(user)
      return
    }

    if (!user && prevUserId.current) {
      prevUserId.current = null
      useUser.setState(null)
    }
  }, [user])

  useEffect(() => {
    setEvent(event)
  }, [event, setEvent])

  useEffect(() => {
    const targetMarket = marketSlug
      ? event.markets.find(market => market.slug === marketSlug)
      : event.markets[0]
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

    setMarket(targetMarket)
    const defaultOutcome = targetMarket.outcomes[0]
    if (defaultOutcome) {
      setOutcome(defaultOutcome)
    }
    appliedMarketSlugRef.current = marketSlug ?? null
    appliedEventIdRef.current = event.id
  }, [currentEventId, currentMarketId, event, marketSlug, setMarket, setOutcome])

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

    const appliedKey = `${event.id}:${paramsKey}`
    if (appliedOrderParamsRef.current === appliedKey) {
      return
    }
    appliedOrderParamsRef.current = appliedKey

    const market = conditionIdParam
      ? event.markets.find(item => item.condition_id === conditionIdParam)
      : event.markets[0]
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
    searchParams,
    setAmount,
    setIsMobileOrderPanelOpen,
    setLimitShares,
    setMarket,
    setOutcome,
    setSide,
    setType,
  ])

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
        <div className="grid gap-6" ref={contentRef}>
          <EventHeader event={event} />
          <EventChart event={event} isMobile={isMobile} />
          <div
            ref={eventMarketsRef}
            id="event-markets"
            className="min-w-0 overflow-x-hidden lg:overflow-x-visible"
          >
            <EventMarkets event={event} isMobile={isMobile} />
          </div>
          {event.total_markets_count === 1 && (
            <>
              {currentUser && (
                <EventMarketPositions
                  market={event.markets[0]}
                  isNegRiskEnabled={Boolean(event.enable_neg_risk || event.neg_risk)}
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
              <EventSingleMarketOrderBook market={event.markets[0]} eventSlug={event.slug} />
              { currentUser && <EventMarketOpenOrders market={event.markets[0]} eventSlug={event.slug} />}
              { currentUser && <EventMarketHistory market={event.markets[0]} /> }
            </>
          )}
          {marketContextEnabled && <EventMarketContext event={event} />}
          <EventRules event={event} />
          {selectedMarketResolved && (
            <div className="rounded-xl border bg-background p-4">
              <ResolvedResolutionPanel
                outcomeLabel={selectedResolvedOutcomeLabel}
                settledUrl={null}
                showLink={false}
              />
            </div>
          )}
          {isMobile && (
            <>
              <h3 className="text-lg font-medium">Related</h3>
              <EventRelated event={event} />
            </>
          )}
          <EventTabs event={event} user={currentUser} />
        </div>

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
                  font-semibold text-foreground shadow-lg backdrop-blur-sm transition-colors
                  hover:text-muted-foreground
                `}
                aria-label="Back to top"
              >
                <span className="inline-flex items-center gap-2">
                  Back to top
                  <ArrowUpIcon className="size-4" />
                </span>
              </button>
            </div>
          </div>
        )}

        {isMobile
          ? <EventOrderPanelMobile event={event} />
          : (
              <Teleport to="#event-order-panel">
                <EventOrderPanelForm event={event} isMobile={false} />
                <EventRelated event={event} />
              </Teleport>
            )}
      </EventOutcomeChanceProvider>
    </EventMarketChannelProvider>
  )
}

function OrderLimitPriceSync() {
  useSyncLimitPriceWithOutcome()
  return null
}
