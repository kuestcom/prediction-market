'use client'

import type { ReadonlyURLSearchParams } from 'next/navigation'
import type { Event } from '@/types'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import { resolveEventOrderBootstrapSelection } from '@/app/[locale]/(platform)/event/[slug]/_utils/event-order-bootstrap-selection'
import { useIsMobile } from '@/hooks/useIsMobile'
import { ORDER_SIDE, ORDER_TYPE } from '@/lib/constants'
import { formatAmountInputValue } from '@/lib/formatters'
import { useOrder, useSyncLimitPriceWithOutcome } from '@/stores/useOrder'

interface EventOrderStateSyncProps {
  event: Event
  marketSlug?: string
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

function isMarketResolved(market: Event['markets'][number] | null | undefined) {
  return Boolean(market?.is_resolved || market?.condition?.resolved)
}

function resolveDefaultMarket(markets: Event['markets']) {
  return markets.find(market => market.is_active && !isMarketResolved(market))
    ?? markets.find(market => !isMarketResolved(market))
    ?? markets[0]
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

interface ApplyOrderBootstrapMarketSelectionParams {
  event: Event
  marketSlug: string | undefined
  orderBootstrapTargetMarket: Event['markets'][number] | null
  currentEventId: string | undefined
  currentMarketId: string | undefined
  appliedMarketSlugRef: { current: string | null }
  appliedEventIdRef: { current: string | null }
  setMarket: (market: Event['markets'][number]) => void
  setOutcome: (outcome: Event['markets'][number]['outcomes'][number]) => void
}

function applyOrderBootstrapMarketSelection({
  event,
  marketSlug,
  orderBootstrapTargetMarket,
  currentEventId,
  currentMarketId,
  appliedMarketSlugRef,
  appliedEventIdRef,
  setMarket,
  setOutcome,
}: ApplyOrderBootstrapMarketSelectionParams) {
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
}

interface ApplyOrderQueryParamsToStoreParams {
  resolvedQueryState: ResolvedEventOrderQueryState | null
  isMobile: boolean
  appliedOrderParamsRef: { current: string | null }
  openedMobileOrderPanelParamsRef: { current: string | null }
  setMarket: (market: Event['markets'][number]) => void
  setOutcome: (outcome: Event['markets'][number]['outcomes'][number]) => void
  setSide: (side: typeof ORDER_SIDE.SELL | typeof ORDER_SIDE.BUY) => void
  setType: (type: typeof ORDER_TYPE.LIMIT | typeof ORDER_TYPE.MARKET) => void
  setAmount: (amount: string) => void
  setLimitShares: (shares: string) => void
  setIsMobileOrderPanelOpen: (open: boolean) => void
}

function applyOrderQueryParamsToStore({
  resolvedQueryState,
  isMobile,
  appliedOrderParamsRef,
  openedMobileOrderPanelParamsRef,
  setMarket,
  setOutcome,
  setSide,
  setType,
  setAmount,
  setLimitShares,
  setIsMobileOrderPanelOpen,
}: ApplyOrderQueryParamsToStoreParams) {
  if (!resolvedQueryState) {
    return
  }

  if (appliedOrderParamsRef.current !== resolvedQueryState.appliedKey) {
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
  }

  if (isMobile && openedMobileOrderPanelParamsRef.current !== resolvedQueryState.appliedKey) {
    openedMobileOrderPanelParamsRef.current = resolvedQueryState.appliedKey
    setIsMobileOrderPanelOpen(true)
  }
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
    applyOrderBootstrapMarketSelection({
      event,
      marketSlug,
      orderBootstrapTargetMarket,
      currentEventId,
      currentMarketId,
      appliedMarketSlugRef,
      appliedEventIdRef,
      setMarket,
      setOutcome,
    })
  }, [currentEventId, currentMarketId, event, marketSlug, orderBootstrapTargetMarket, setMarket, setOutcome])
}

function useAppliedOrderQuerySync({
  resolvedQueryState,
  isMobile,
}: {
  resolvedQueryState: ResolvedEventOrderQueryState | null
  isMobile: boolean
}) {
  const appliedOrderParamsRef = useRef<string | null>(null)
  const openedMobileOrderPanelParamsRef = useRef<string | null>(null)
  const setMarket = useOrder(state => state.setMarket)
  const setOutcome = useOrder(state => state.setOutcome)
  const setSide = useOrder(state => state.setSide)
  const setType = useOrder(state => state.setType)
  const setAmount = useOrder(state => state.setAmount)
  const setLimitShares = useOrder(state => state.setLimitShares)
  const setIsMobileOrderPanelOpen = useOrder(state => state.setIsMobileOrderPanelOpen)

  useEffect(function syncOrderQueryParamsToStore() {
    applyOrderQueryParamsToStore({
      resolvedQueryState,
      isMobile,
      appliedOrderParamsRef,
      openedMobileOrderPanelParamsRef,
      setMarket,
      setOutcome,
      setSide,
      setType,
      setAmount,
      setLimitShares,
      setIsMobileOrderPanelOpen,
    })
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

function OrderLimitPriceSync() {
  useSyncLimitPriceWithOutcome()
  return null
}

export default function EventOrderStateSync({ event, marketSlug }: EventOrderStateSyncProps) {
  const currentEventId = useOrder(state => state.event?.id)
  const currentMarketId = useOrder(state => state.market?.condition_id)
  const isMobile = useIsMobile()
  const orderBootstrapTargetMarket = useMemo(
    () => resolveBootstrapTargetMarket(event, marketSlug),
    [event, marketSlug],
  )

  useSetEventInOrderStore(event)
  useOrderBootstrapMarketSelection({
    event,
    marketSlug,
    orderBootstrapTargetMarket,
    currentEventId,
    currentMarketId,
  })

  return (
    <>
      <OrderLimitPriceSync />
      <Suspense fallback={null}>
        <EventOrderQuerySync event={event} marketSlug={marketSlug} isMobile={isMobile} />
      </Suspense>
    </>
  )
}
