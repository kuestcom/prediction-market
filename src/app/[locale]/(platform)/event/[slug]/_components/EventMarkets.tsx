import type { MarketPositionTag } from '@/app/[locale]/(platform)/event/[slug]/_components/EventMarketCard'
import type { EventMarketRow } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventMarketRows'
import type { MarketDetailTab } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useMarketDetailController'
import type { SharesByCondition } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useUserShareBalances'
import type { OrderBookSummariesResponse } from '@/app/[locale]/(platform)/event/[slug]/_types/EventOrderBookTypes'
import type { DataApiActivity } from '@/lib/data-api/user'
import type { Event, UserPosition } from '@/types'
import { useQuery } from '@tanstack/react-query'
import { CheckIcon, ChevronDownIcon, LockKeyholeIcon, RefreshCwIcon, XIcon } from 'lucide-react'
import { useExtracted, useLocale } from 'next-intl'
import Image from 'next/image'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import SellPositionModal from '@/app/[locale]/(platform)/_components/SellPositionModal'
import EventMarketCard from '@/app/[locale]/(platform)/event/[slug]/_components/EventMarketCard'
import EventMarketHistory from '@/app/[locale]/(platform)/event/[slug]/_components/EventMarketHistory'
import EventMarketOpenOrders from '@/app/[locale]/(platform)/event/[slug]/_components/EventMarketOpenOrders'
import EventMarketPositions from '@/app/[locale]/(platform)/event/[slug]/_components/EventMarketPositions'
import EventOrderBook, { useOrderBookSummaries } from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderBook'
import MarketChannelStatusIndicator from '@/app/[locale]/(platform)/event/[slug]/_components/MarketChannelStatusIndicator'
import MarketOutcomeGraph from '@/app/[locale]/(platform)/event/[slug]/_components/MarketOutcomeGraph'
import ResolutionTimelinePanel from '@/app/[locale]/(platform)/event/[slug]/_components/ResolutionTimelinePanel'
import { useChanceRefresh } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useChanceRefresh'
import { useEventMarketRows } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventMarketRows'
import { useMarketDetailController } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useMarketDetailController'
import { useUserOpenOrdersQuery } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useUserOpenOrdersQuery'
import { useUserShareBalances } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useUserShareBalances'
import { calculateMarketFill, normalizeBookLevels } from '@/app/[locale]/(platform)/event/[slug]/_utils/EventOrderPanelUtils'
import { isResolutionReviewActive } from '@/app/[locale]/(platform)/event/[slug]/_utils/resolution-timeline-builder'
import { Button } from '@/components/ui/button'
import { useOutcomeLabel } from '@/hooks/useOutcomeLabel'
import { useSiteIdentity } from '@/hooks/useSiteIdentity'
import { ORDER_SIDE, ORDER_TYPE, OUTCOME_INDEX } from '@/lib/constants'
import { fetchUserActivityData, fetchUserOtherBalance, fetchUserPositionsForMarket } from '@/lib/data-api/user'
import { formatAmountInputValue, formatSharesLabel, fromMicro } from '@/lib/formatters'
import { buildUmaProposeUrl, buildUmaSettledUrl } from '@/lib/uma'
import { cn } from '@/lib/utils'
import { useIsSingleMarket, useOrder } from '@/stores/useOrder'
import { useUser } from '@/stores/useUser'

interface EventMarketsProps {
  event: Event
  isMobile: boolean
}

function toNumber(value: unknown) {
  if (value === null || value === undefined) {
    return null
  }
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function isMarketResolved(market: Event['markets'][number]) {
  return Boolean(market.is_resolved || market.condition?.resolved)
}

function getMarketEndTime(market: Event['markets'][number]) {
  if (!market.end_time) {
    return null
  }
  const parsed = Date.parse(market.end_time)
  return Number.isNaN(parsed) ? null : parsed
}

export function resolveWinningOutcomeIndex(market: Event['markets'][number]) {
  const explicitWinner = market.outcomes.find(outcome => outcome.is_winning_outcome)
  if (explicitWinner && (explicitWinner.outcome_index === OUTCOME_INDEX.YES || explicitWinner.outcome_index === OUTCOME_INDEX.NO)) {
    return explicitWinner.outcome_index
  }

  const payoutNumerators = market.condition?.payout_numerators
  if (!Array.isArray(payoutNumerators) || payoutNumerators.length === 0) {
    return null
  }

  const numericNumerators = payoutNumerators.map(value => Number(value))
  const finiteNumerators = numericNumerators.filter(value => Number.isFinite(value))
  if (finiteNumerators.length === 0) {
    return null
  }

  const maxValue = Math.max(...finiteNumerators)
  if (!(maxValue > 0)) {
    return null
  }

  const winnerIndex = numericNumerators.findIndex(value => value === maxValue)
  if (winnerIndex === OUTCOME_INDEX.YES || winnerIndex === OUTCOME_INDEX.NO) {
    return winnerIndex
  }

  return null
}

interface CashOutModalPayload {
  market: Event['markets'][number]
  outcomeLabel: string
  outcomeIndex: typeof OUTCOME_INDEX.YES | typeof OUTCOME_INDEX.NO
  shares: number
  filledShares: number
  avgPriceCents: number | null
  receiveAmount: number | null
}

export default function EventMarkets({ event, isMobile }: EventMarketsProps) {
  const t = useExtracted()
  const normalizeOutcomeLabel = useOutcomeLabel()
  const selectedMarketId = useOrder(state => state.market?.condition_id)
  const selectedOutcome = useOrder(state => state.outcome)
  const setMarket = useOrder(state => state.setMarket)
  const setOutcome = useOrder(state => state.setOutcome)
  const setSide = useOrder(state => state.setSide)
  const setType = useOrder(state => state.setType)
  const setIsMobileOrderPanelOpen = useOrder(state => state.setIsMobileOrderPanelOpen)
  const setUserShares = useOrder(state => state.setUserShares)
  const setAmount = useOrder(state => state.setAmount)
  const inputRef = useOrder(state => state.inputRef)
  const user = useUser()
  const isSingleMarket = useIsSingleMarket()
  const isNegRiskEnabled = Boolean(event.enable_neg_risk || event.neg_risk)
  const isNegRiskAugmented = Boolean(event.neg_risk_augmented)
  const { rows: marketRows, hasChanceData } = useEventMarketRows(event)
  const { activeMarketRows, resolvedMarketRows } = useMemo(() => {
    if (isNegRiskEnabled) {
      return { activeMarketRows: marketRows, resolvedMarketRows: [] }
    }

    const activeRows: typeof marketRows = []
    const resolvedRows: typeof marketRows = []

    marketRows.forEach((row) => {
      if (isMarketResolved(row.market)) {
        resolvedRows.push(row)
      }
      else {
        activeRows.push(row)
      }
    })

    return { activeMarketRows: activeRows, resolvedMarketRows: resolvedRows }
  }, [isNegRiskEnabled, marketRows])
  const sortedResolvedMarketRows = useMemo(() => {
    if (!resolvedMarketRows.length) {
      return resolvedMarketRows
    }

    return resolvedMarketRows
      .map((row, index) => ({
        row,
        index,
        endTime: getMarketEndTime(row.market),
      }))
      .sort((a, b) => {
        if (a.endTime != null && b.endTime != null) {
          return a.endTime - b.endTime
        }
        return a.index - b.index
      })
      .map(item => item.row)
  }, [resolvedMarketRows])
  const {
    expandedMarketId,
    orderBookPollingEnabled,
    toggleMarket,
    expandMarket,
    selectDetailTab,
    getSelectedDetailTab,
  } = useMarketDetailController(event.id)
  const reviewConditionIds = useMemo(() => {
    const ids = new Set<string>()
    event.markets.forEach((market) => {
      if (isResolutionReviewActive(market)) {
        ids.add(market.condition_id)
      }
    })
    return ids
  }, [event.markets])
  const hasAnyMarketInReview = reviewConditionIds.size > 0
  const chanceRefreshQueryKeys = useMemo(
    () => [
      ['event-price-history', event.id] as const,
      ['event-market-quotes'] as const,
    ],
    [event.id],
  )
  const [chancePulseToken, setChancePulseToken] = useState(0)
  const [showResolvedMarkets, setShowResolvedMarkets] = useState(false)
  const priceHistoryWasFetchingRef = useRef(false)
  const {
    isFetching: isPriceHistoryFetching,
  } = useChanceRefresh({ queryKeys: chanceRefreshQueryKeys })
  const eventTokenIds = useMemo(() => {
    const ids = new Set<string>()

    event.markets.forEach((market) => {
      market.outcomes.forEach((currentOutcome) => {
        if (currentOutcome.token_id) {
          ids.add(currentOutcome.token_id)
        }
      })
    })

    return Array.from(ids)
  }, [event.markets])
  const shouldEnableOrderBookPolling = !isSingleMarket && orderBookPollingEnabled
  const orderBookQuery = useOrderBookSummaries(eventTokenIds, { enabled: shouldEnableOrderBookPolling })
  const orderBookSummaries = orderBookQuery.data
  const isOrderBookLoading = orderBookQuery.isLoading
  const shouldShowOrderBookLoader = !shouldEnableOrderBookPolling || (isOrderBookLoading && !orderBookSummaries)
  const ownerAddress = useMemo(() => {
    if (user && user.proxy_wallet_address && user.proxy_wallet_status === 'deployed') {
      return user.proxy_wallet_address as `0x${string}`
    }
    return '' as `0x${string}`
  }, [user])
  const { sharesByCondition } = useUserShareBalances({ event, ownerAddress })
  const [cashOutPayload, setCashOutPayload] = useState<CashOutModalPayload | null>(null)
  const { data: userPositions } = useQuery<UserPosition[]>({
    queryKey: ['event-user-positions', ownerAddress, event.id],
    enabled: Boolean(ownerAddress),
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 10,
    refetchInterval: ownerAddress ? 15_000 : false,
    refetchIntervalInBackground: true,
    queryFn: ({ signal }) =>
      fetchUserPositionsForMarket({
        pageParam: 0,
        userAddress: ownerAddress,
        status: 'active',
        signal,
      }),
  })
  const { data: otherBalances } = useQuery({
    queryKey: ['event-other-balance', ownerAddress, event.slug],
    enabled: Boolean(ownerAddress && isNegRiskAugmented && userPositions),
    staleTime: 1000 * 60,
    gcTime: 1000 * 60 * 10,
    queryFn: ({ signal }) =>
      fetchUserOtherBalance({
        eventSlug: event.slug,
        userAddress: ownerAddress,
        signal,
      }),
  })
  const otherShares = useMemo(() => {
    if (!otherBalances?.length) {
      return 0
    }
    return otherBalances.reduce((total, entry) => {
      const size = typeof entry.size === 'number' ? entry.size : 0
      return total + (Number.isFinite(size) ? size : 0)
    }, 0)
  }, [otherBalances])
  const shouldShowOtherRow = isNegRiskAugmented && otherShares > 0
  const { data: eventOpenOrdersData } = useUserOpenOrdersQuery({
    userId: user?.id,
    eventSlug: event.slug,
    enabled: Boolean(user?.id),
  })
  const openOrdersCountByCondition = useMemo(() => {
    const pages = eventOpenOrdersData?.pages ?? []
    return pages.reduce<Record<string, number>>((acc, page) => {
      page.data.forEach((order) => {
        const conditionId = order.market?.condition_id
        if (!conditionId) {
          return
        }
        acc[conditionId] = (acc[conditionId] ?? 0) + 1
      })
      return acc
    }, {})
  }, [eventOpenOrdersData?.pages])
  const positionTagsByCondition = useMemo(() => {
    if (!userPositions?.length) {
      return {}
    }

    const validConditionIds = new Set(event.markets.map(market => market.condition_id))
    const aggregated: Record<
      string,
      Record<typeof OUTCOME_INDEX.YES | typeof OUTCOME_INDEX.NO, {
        outcomeIndex: typeof OUTCOME_INDEX.YES | typeof OUTCOME_INDEX.NO
        label: string
        shares: number
        totalCost: number | null
      }>
    > = {}

    userPositions.forEach((position) => {
      const conditionId = position.market?.condition_id
      if (!conditionId || !validConditionIds.has(conditionId)) {
        return
      }

      const quantity = typeof position.total_shares === 'number'
        ? position.total_shares
        : (typeof position.size === 'number' ? position.size : 0)
      if (!quantity || quantity <= 0) {
        return
      }

      const normalizedOutcome = position.outcome_text?.toLowerCase()
      const explicitOutcomeIndex = typeof position.outcome_index === 'number' ? position.outcome_index : undefined
      const resolvedOutcomeIndex = explicitOutcomeIndex != null
        ? explicitOutcomeIndex
        : normalizedOutcome === 'no'
          ? OUTCOME_INDEX.NO
          : OUTCOME_INDEX.YES
      const outcomeLabel = normalizeOutcomeLabel(position.outcome_text)
        || (resolvedOutcomeIndex === OUTCOME_INDEX.NO ? t('No') : t('Yes'))
      const avgPrice = toNumber(position.avgPrice)
        ?? Number(fromMicro(String(position.average_position ?? 0), 6))
      const normalizedAvgPrice = Number.isFinite(avgPrice) ? avgPrice : null

      if (!aggregated[conditionId]) {
        aggregated[conditionId] = {
          [OUTCOME_INDEX.YES]: { outcomeIndex: OUTCOME_INDEX.YES, label: t('Yes'), shares: 0, totalCost: null },
          [OUTCOME_INDEX.NO]: { outcomeIndex: OUTCOME_INDEX.NO, label: t('No'), shares: 0, totalCost: null },
        }
      }

      const bucket = resolvedOutcomeIndex === OUTCOME_INDEX.NO ? OUTCOME_INDEX.NO : OUTCOME_INDEX.YES
      const entry = aggregated[conditionId][bucket]
      entry.shares += quantity
      entry.label = outcomeLabel
      if (typeof normalizedAvgPrice === 'number') {
        const contribution = normalizedAvgPrice * quantity
        entry.totalCost = (entry.totalCost ?? 0) + contribution
      }
    })

    return Object.entries(aggregated).reduce<Record<string, MarketPositionTag[]>>((acc, [conditionId, entries]) => {
      const tags = [entries[OUTCOME_INDEX.YES], entries[OUTCOME_INDEX.NO]]
        .map((entry) => {
          const avgPrice = entry.shares > 0 && typeof entry.totalCost === 'number'
            ? entry.totalCost / entry.shares
            : null
          return {
            outcomeIndex: entry.outcomeIndex,
            label: entry.label,
            shares: entry.shares,
            avgPrice,
          }
        })
        .filter(tag => tag.shares > 0)
      if (tags.length > 0) {
        acc[conditionId] = tags
      }
      return acc
    }, {})
  }, [event.markets, normalizeOutcomeLabel, t, userPositions])

  const convertOptions = useMemo(() => {
    if (!isNegRiskEnabled || !userPositions?.length) {
      return []
    }

    const marketsByConditionId = new Map(
      event.markets.map(market => [market.condition_id, market]),
    )

    return userPositions.reduce<Array<{ id: string, label: string, shares: number, conditionId: string }>>(
      (options, position, index) => {
        const conditionId = position.market?.condition_id
        if (!conditionId) {
          return options
        }
        const market = marketsByConditionId.get(conditionId)
        if (!market) {
          return options
        }

        const normalizedOutcome = position.outcome_text?.toLowerCase()
        const explicitOutcomeIndex = typeof position.outcome_index === 'number' ? position.outcome_index : undefined
        const resolvedOutcomeIndex = explicitOutcomeIndex != null
          ? explicitOutcomeIndex
          : normalizedOutcome === 'no'
            ? OUTCOME_INDEX.NO
            : OUTCOME_INDEX.YES
        if (resolvedOutcomeIndex !== OUTCOME_INDEX.NO) {
          return options
        }

        const quantity = toNumber(position.size)
          ?? (typeof position.total_shares === 'number' ? position.total_shares : 0)
        if (!(quantity > 0)) {
          return options
        }

        options.push({
          id: `${conditionId}-no-${index}`,
          label: market.short_title || market.title,
          conditionId,
          shares: quantity,
        })
        return options
      },
      [],
    )
  }, [event.markets, isNegRiskEnabled, userPositions])

  const eventOutcomes = useMemo(() => {
    return event.markets.map(market => ({
      conditionId: market.condition_id,
      questionId: market.question_id,
      label: market.short_title || market.title,
      iconUrl: market.icon_url,
    }))
  }, [event.markets])

  const handleCashOut = useCallback(async (market: Event['markets'][number], tag: MarketPositionTag) => {
    const outcome = market.outcomes.find(item => item.outcome_index === tag.outcomeIndex)
      ?? market.outcomes[tag.outcomeIndex]
    if (!outcome) {
      return
    }

    const tokenId = outcome.token_id ? String(outcome.token_id) : null
    let summary = tokenId ? orderBookSummaries?.[tokenId] : undefined
    if (!summary && tokenId) {
      try {
        const result = await orderBookQuery.refetch()
        summary = result.data?.[tokenId]
      }
      catch {
        summary = undefined
      }
    }
    const bids = normalizeBookLevels(summary?.bids, 'bid')
    const asks = normalizeBookLevels(summary?.asks, 'ask')
    const fill = calculateMarketFill(ORDER_SIDE.SELL, tag.shares, bids, asks)

    setType(ORDER_TYPE.MARKET)
    setSide(ORDER_SIDE.SELL)
    setMarket(market)
    setOutcome(outcome)
    setAmount(formatAmountInputValue(tag.shares, { roundingMode: 'floor' }))
    if (isMobile) {
      setIsMobileOrderPanelOpen(true)
    }

    setCashOutPayload({
      market,
      outcomeLabel: tag.label,
      outcomeIndex: tag.outcomeIndex,
      shares: tag.shares,
      filledShares: fill.filledShares,
      avgPriceCents: fill.avgPriceCents,
      receiveAmount: fill.totalCost > 0 ? fill.totalCost : null,
    })
  }, [isMobile, orderBookQuery, orderBookSummaries, setAmount, setIsMobileOrderPanelOpen, setMarket, setOutcome, setSide, setType])

  const handleCashOutModalChange = useCallback((open: boolean) => {
    if (!open) {
      setCashOutPayload(null)
    }
  }, [])

  const handleCashOutSubmit = useCallback(() => {
    setCashOutPayload(null)
    const form = document.getElementById('event-order-form') as HTMLFormElement | null
    form?.requestSubmit()
  }, [])

  useEffect(() => {
    if (ownerAddress && Object.keys(sharesByCondition).length > 0) {
      setUserShares(sharesByCondition)
    }
  }, [ownerAddress, setUserShares, sharesByCondition])

  useEffect(() => {
    setChancePulseToken(0)
    priceHistoryWasFetchingRef.current = true
  }, [event.id])

  useEffect(() => {
    const wasFetching = priceHistoryWasFetchingRef.current
    priceHistoryWasFetchingRef.current = isPriceHistoryFetching

    if (hasChanceData && wasFetching && !isPriceHistoryFetching) {
      setChancePulseToken(token => token + 1)
    }
  }, [hasChanceData, isPriceHistoryFetching])

  const handleToggle = useCallback((market: Event['markets'][number]) => {
    toggleMarket(market.condition_id)
    setMarket(market)
    setSide(ORDER_SIDE.BUY)

    if (!selectedOutcome || selectedOutcome.condition_id !== market.condition_id) {
      const defaultOutcome = market.outcomes[0]
      if (defaultOutcome) {
        setOutcome(defaultOutcome)
      }
    }
  }, [toggleMarket, selectedOutcome, setMarket, setOutcome, setSide])

  const handleBuy = useCallback((market: Event['markets'][number], outcomeIndex: number, source: 'mobile' | 'desktop') => {
    expandMarket(market.condition_id)
    setMarket(market)
    const outcome = market.outcomes[outcomeIndex]
    if (outcome) {
      setOutcome(outcome)
    }
    setSide(ORDER_SIDE.BUY)

    if (source === 'mobile') {
      setIsMobileOrderPanelOpen(true)
    }
    else {
      inputRef?.current?.focus()
    }
  }, [expandMarket, inputRef, setIsMobileOrderPanelOpen, setMarket, setOutcome, setSide])

  const allMarketsResolved = !isNegRiskEnabled
    && marketRows.length > 0
    && marketRows.every(row => isMarketResolved(row.market))
  const showResolvedInline = allMarketsResolved
  const primaryMarketRows = showResolvedInline ? sortedResolvedMarketRows : activeMarketRows
  const shouldShowActiveSection = primaryMarketRows.length > 0 || shouldShowOtherRow
  const shouldShowResolvedSection = !showResolvedInline && !isNegRiskEnabled && sortedResolvedMarketRows.length > 0

  if (isSingleMarket) {
    return <></>
  }

  return (
    <>
      <div className="-mr-2 -ml-4 bg-background lg:mx-0">
        {shouldShowActiveSection && <div className="mt-4 mr-2 ml-4 border-b border-border lg:mx-0" />}
        {primaryMarketRows
          .map((row, index, orderedMarkets) => {
            const { market } = row
            const isExpanded = expandedMarketId === market.condition_id
            const activeOutcomeForMarket = selectedOutcome && selectedOutcome.condition_id === market.condition_id
              ? selectedOutcome
              : market.outcomes[0]
            const chanceHighlightKey = `${market.condition_id}-${chancePulseToken}`
            const activeOutcomeIndex = selectedOutcome && selectedOutcome.condition_id === market.condition_id
              ? selectedOutcome.outcome_index
              : null
            const positionTags = positionTagsByCondition[market.condition_id] ?? []
            const shouldShowSeparator = index !== orderedMarkets.length - 1 || shouldShowOtherRow
            const isResolvedInlineRow = showResolvedInline
            const showInReviewTag = hasAnyMarketInReview
              && (isNegRiskEnabled || reviewConditionIds.has(market.condition_id))

            return (
              <div key={market.condition_id} className="transition-colors">
                {isResolvedInlineRow
                  ? (
                      <ResolvedMarketRow
                        row={row}
                        showMarketIcon={Boolean(event.show_market_icons)}
                        isExpanded={isExpanded}
                        onToggle={() => handleToggle(market)}
                      />
                    )
                  : (
                      <EventMarketCard
                        row={row}
                        showMarketIcon={Boolean(event.show_market_icons)}
                        isExpanded={isExpanded}
                        isActiveMarket={selectedMarketId === market.condition_id}
                        showInReviewTag={showInReviewTag}
                        activeOutcomeIndex={activeOutcomeIndex}
                        onToggle={() => handleToggle(market)}
                        onBuy={(cardMarket, outcomeIndex, source) => handleBuy(cardMarket, outcomeIndex, source)}
                        chanceHighlightKey={chanceHighlightKey}
                        positionTags={positionTags}
                        openOrdersCount={openOrdersCountByCondition[market.condition_id] ?? 0}
                        onCashOut={handleCashOut}
                      />
                    )}

                <div
                  className={cn(
                    'overflow-hidden transition-all duration-500 ease-in-out',
                    isExpanded
                      ? 'max-h-160 translate-y-0 opacity-100'
                      : 'pointer-events-none max-h-0 -translate-y-2 opacity-0',
                  )}
                  aria-hidden={!isExpanded}
                >
                  <MarketDetailTabs
                    market={market}
                    event={event}
                    isMobile={isMobile}
                    isNegRiskEnabled={isNegRiskEnabled}
                    isNegRiskAugmented={isNegRiskAugmented}
                    variant={isResolvedInlineRow ? 'resolved' : undefined}
                    convertOptions={convertOptions}
                    eventOutcomes={eventOutcomes}
                    activeOutcomeForMarket={activeOutcomeForMarket}
                    tabController={{
                      selected: getSelectedDetailTab(market.condition_id),
                      select: tabId => selectDetailTab(market.condition_id, tabId),
                    }}
                    orderBookData={{
                      summaries: orderBookSummaries,
                      isLoading: shouldShowOrderBookLoader,
                      refetch: orderBookQuery.refetch,
                      isRefetching: orderBookQuery.isRefetching,
                    }}
                    sharesByCondition={sharesByCondition}
                  />
                </div>

                {shouldShowSeparator && <div className="mr-2 ml-4 border-b border-border lg:mx-0" />}
              </div>
            )
          })}
        {shouldShowOtherRow && (
          <div className="transition-colors">
            <OtherOutcomeRow shares={otherShares} showMarketIcon={Boolean(event.show_market_icons)} />
          </div>
        )}
        {shouldShowActiveSection && (
          <div className="mr-2 mb-4 ml-4 border-b border-border lg:mx-0" />
        )}

        {shouldShowResolvedSection && (
          <div className="pb-4">
            <button
              type="button"
              className={cn(
                'group flex items-center gap-1 px-4 py-2 text-base font-semibold text-foreground',
                'transition-colors hover:text-foreground/80 lg:px-0',
              )}
              onClick={() => setShowResolvedMarkets(open => !open)}
              aria-expanded={showResolvedMarkets}
              data-state={showResolvedMarkets ? 'open' : 'closed'}
            >
              <span>{showResolvedMarkets ? t('Hide resolved') : t('View resolved')}</span>
              <ChevronDownIcon
                className="size-6 transition-transform duration-150 group-data-[state=open]:rotate-180"
              />
            </button>

            {showResolvedMarkets && (
              <div className="mt-4">
                {sortedResolvedMarketRows.map((row, index, orderedMarkets) => {
                  const { market } = row
                  const isExpanded = expandedMarketId === market.condition_id
                  const activeOutcomeForMarket = selectedOutcome && selectedOutcome.condition_id === market.condition_id
                    ? selectedOutcome
                    : market.outcomes[0]
                  const shouldShowSeparator = index !== orderedMarkets.length - 1

                  return (
                    <div key={market.condition_id} className="transition-colors">
                      <ResolvedMarketRow
                        row={row}
                        showMarketIcon={Boolean(event.show_market_icons)}
                        isExpanded={isExpanded}
                        onToggle={() => handleToggle(market)}
                      />

                      <div
                        className={cn(
                          'overflow-hidden transition-all duration-500 ease-in-out',
                          isExpanded
                            ? 'max-h-160 translate-y-0 opacity-100'
                            : 'pointer-events-none max-h-0 -translate-y-2 opacity-0',
                        )}
                        aria-hidden={!isExpanded}
                      >
                        <MarketDetailTabs
                          market={market}
                          event={event}
                          isMobile={isMobile}
                          isNegRiskEnabled={isNegRiskEnabled}
                          isNegRiskAugmented={isNegRiskAugmented}
                          variant="resolved"
                          convertOptions={convertOptions}
                          eventOutcomes={eventOutcomes}
                          activeOutcomeForMarket={activeOutcomeForMarket}
                          tabController={{
                            selected: getSelectedDetailTab(market.condition_id),
                            select: tabId => selectDetailTab(market.condition_id, tabId),
                          }}
                          orderBookData={{
                            summaries: orderBookSummaries,
                            isLoading: shouldShowOrderBookLoader,
                            refetch: orderBookQuery.refetch,
                            isRefetching: orderBookQuery.isRefetching,
                          }}
                          sharesByCondition={sharesByCondition}
                        />
                      </div>

                      {shouldShowSeparator && (
                        <div className="mr-2 ml-4 border-b border-border lg:mx-0" />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {cashOutPayload && (
        <SellPositionModal
          open={Boolean(cashOutPayload)}
          onOpenChange={handleCashOutModalChange}
          outcomeLabel={cashOutPayload.outcomeLabel}
          outcomeShortLabel={cashOutPayload.market.short_title || cashOutPayload.market.title}
          outcomeIconUrl={cashOutPayload.market.icon_url}
          fallbackIconUrl={event.icon_url}
          shares={cashOutPayload.shares}
          filledShares={cashOutPayload.filledShares}
          avgPriceCents={cashOutPayload.avgPriceCents}
          receiveAmount={cashOutPayload.receiveAmount}
          onCashOut={handleCashOutSubmit}
          onEditOrder={() => setCashOutPayload(null)}
        />
      )}
    </>
  )
}

function ResolvedMarketRow({
  row,
  showMarketIcon,
  isExpanded,
  onToggle,
}: {
  row: EventMarketRow
  showMarketIcon: boolean
  isExpanded: boolean
  onToggle: () => void
}) {
  const t = useExtracted()
  const locale = useLocale()
  const normalizeOutcomeLabel = useOutcomeLabel()
  const { market } = row
  const resolvedOutcomeIndex = resolveWinningOutcomeIndex(market)
  const hasResolvedOutcome = resolvedOutcomeIndex === OUTCOME_INDEX.YES || resolvedOutcomeIndex === OUTCOME_INDEX.NO
  const isYesOutcome = resolvedOutcomeIndex !== OUTCOME_INDEX.NO
  const resolvedOutcomeText = market.outcomes.find(
    outcome => outcome.outcome_index === resolvedOutcomeIndex,
  )?.outcome_text
  const resolvedOutcomeLabel = (resolvedOutcomeText ? normalizeOutcomeLabel(resolvedOutcomeText) : '')
    || resolvedOutcomeText
    || (isYesOutcome ? t('Yes') : t('No'))
  const resolvedVolume = Number.isFinite(market.volume) ? market.volume : 0
  const shouldShowIcon = showMarketIcon && Boolean(market.icon_url)

  return (
    <div
      className={cn(
        `
          group relative z-0 flex w-full cursor-pointer flex-col items-start py-3 pr-2 pl-4 transition-all duration-200
          ease-in-out
          before:pointer-events-none before:absolute before:inset-y-0 before:-right-3 before:-left-3 before:-z-10
          before:rounded-lg before:bg-black/5 before:opacity-0 before:transition-opacity before:duration-200
          before:content-['']
          hover:before:opacity-100
          lg:flex-row lg:items-center lg:rounded-lg lg:px-0
          dark:before:bg-white/5
        `,
      )}
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
      onClick={onToggle}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onToggle()
        }
      }}
    >
      <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex w-full items-start gap-3 lg:w-2/5">
          {shouldShowIcon && (
            <Image
              src={market.icon_url}
              alt={market.title}
              width={42}
              height={42}
              className="shrink-0 rounded-md"
            />
          )}
          <div>
            <div className="text-sm font-bold underline-offset-2 group-hover:underline">
              {market.short_title || market.title}
            </div>
            <div className="text-sm text-muted-foreground">
              $
              {t('{amount} Vol.', {
                amount: `$${resolvedVolume.toLocaleString(locale, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`,
              })}
            </div>
          </div>
        </div>

        <div className="flex w-full justify-end lg:ms-auto lg:w-auto">
          {hasResolvedOutcome
            ? (
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                  <span className="text-base font-bold">{resolvedOutcomeLabel}</span>
                  <span className={cn(
                    'flex size-4 items-center justify-center rounded-full',
                    isYesOutcome ? 'bg-yes' : 'bg-no',
                  )}
                  >
                    {isYesOutcome
                      ? <CheckIcon className="size-3 text-background" strokeWidth={2.5} />
                      : <XIcon className="size-3 text-background" strokeWidth={2.5} />}
                  </span>
                </span>
              )
            : (
                <span className="text-sm font-semibold text-muted-foreground">{t('Resolved')}</span>
              )}
        </div>
      </div>
    </div>
  )
}

function OtherOutcomeRow({ shares, showMarketIcon }: { shares: number, showMarketIcon?: boolean }) {
  const t = useExtracted()
  const sharesLabel = formatSharesLabel(shares, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  return (
    <div
      className={cn(
        `
          relative z-0 flex w-full cursor-default flex-col items-start py-3 pr-2 pl-4 transition-all duration-200
          ease-in-out
          before:pointer-events-none before:absolute before:inset-y-0 before:-right-3 before:-left-3 before:-z-10
          before:rounded-lg before:bg-black/5 before:opacity-0 before:transition-opacity before:duration-200
          before:content-['']
          hover:before:opacity-100
          lg:flex-row lg:items-center lg:rounded-lg lg:px-0
          dark:before:bg-white/5
        `,
      )}
    >
      <div className="flex w-full flex-col gap-2 lg:w-2/5">
        <div className="flex items-start gap-3">
          {showMarketIcon && (
            <div className="size-10.5 shrink-0 rounded-md bg-muted/60" aria-hidden="true" />
          )}
          <div className="text-sm font-bold text-foreground">{t('Other')}</div>
        </div>
        <div>
          <span className={cn(
            `
              inline-flex items-center gap-1 rounded-sm bg-yes/15 px-1.5 py-0.5 text-xs/tight font-semibold
              text-yes-foreground
            `,
          )}
          >
            <LockKeyholeIcon className="size-3 text-yes" />
            <span className="tabular-nums">{sharesLabel}</span>
            <span>{t('Yes')}</span>
          </span>
        </div>
      </div>
    </div>
  )
}

interface MarketDetailTabsProps {
  market: Event['markets'][number]
  event: Event
  isMobile: boolean
  isNegRiskEnabled: boolean
  isNegRiskAugmented: boolean
  variant?: 'default' | 'resolved'
  convertOptions: Array<{ id: string, label: string, shares: number, conditionId: string }>
  eventOutcomes: Array<{ conditionId: string, questionId?: string, label: string, iconUrl?: string | null }>
  activeOutcomeForMarket: Event['markets'][number]['outcomes'][number] | undefined
  tabController: {
    selected: MarketDetailTab | undefined
    select: (tabId: MarketDetailTab) => void
  }
  orderBookData: {
    summaries: OrderBookSummariesResponse | undefined
    isLoading: boolean
    refetch: () => Promise<unknown>
    isRefetching: boolean
  }
  sharesByCondition: SharesByCondition
}

function MarketDetailTabs({
  market,
  event,
  isMobile,
  isNegRiskEnabled,
  isNegRiskAugmented,
  variant = 'default',
  convertOptions,
  eventOutcomes,
  activeOutcomeForMarket,
  tabController,
  orderBookData,
  sharesByCondition,
}: MarketDetailTabsProps) {
  const t = useExtracted()
  const { name: siteName } = useSiteIdentity()
  const user = useUser()
  const { selected: controlledTab, select } = tabController
  const positionSizeThreshold = 0.01
  const isResolvedView = variant === 'resolved'
  const isResolvedMarket = isMarketResolved(market)
  const shouldHideOrderBook = isResolvedView || isResolvedMarket
  const marketShares = sharesByCondition?.[market.condition_id]
  const yesShares = marketShares?.[OUTCOME_INDEX.YES] ?? 0
  const noShares = marketShares?.[OUTCOME_INDEX.NO] ?? 0
  const hasPositions = Boolean(
    user?.proxy_wallet_address
    && marketShares
    && (yesShares >= positionSizeThreshold || noShares >= positionSizeThreshold),
  )

  const { data: openOrdersData } = useUserOpenOrdersQuery({
    userId: user?.id,
    eventSlug: event.slug,
    conditionId: market.condition_id,
    enabled: Boolean(user?.id) && !isResolvedView,
  })
  const hasOpenOrders = useMemo(() => {
    if (isResolvedView) {
      return false
    }
    const pages = openOrdersData?.pages ?? []
    return pages.some(page => page.data.length > 0)
  }, [isResolvedView, openOrdersData?.pages])

  const { data: historyPreview } = useQuery<DataApiActivity[]>({
    queryKey: ['user-market-activity-preview', user?.proxy_wallet_address, market.condition_id],
    queryFn: ({ signal }) =>
      fetchUserActivityData({
        pageParam: 0,
        userAddress: user?.proxy_wallet_address ?? '',
        conditionId: market.condition_id,
        signal,
      }),
    enabled: Boolean(user?.proxy_wallet_address && market.condition_id) && !isResolvedView,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
  })
  const hasHistory = useMemo(
    () => {
      if (isResolvedView) {
        return false
      }
      return (historyPreview ?? []).some(activity =>
        activity.type?.toLowerCase() === 'trade'
        && activity.conditionId === market.condition_id)
    },
    [historyPreview, isResolvedView, market.condition_id],
  )

  const visibleTabs = useMemo(() => {
    if (isResolvedView) {
      return [
        { id: 'graph', label: t('Graph') },
        { id: 'resolution', label: t('Resolution') },
      ] satisfies Array<{ id: MarketDetailTab, label: string }>
    }

    const tabs: Array<{ id: MarketDetailTab, label: string }> = [
      { id: 'graph', label: t('Graph') },
    ]

    if (!shouldHideOrderBook) {
      tabs.unshift({ id: 'orderBook', label: t('Order Book') })
    }

    if (hasOpenOrders) {
      const graphTabIndex = tabs.findIndex(tab => tab.id === 'graph')
      const insertionIndex = graphTabIndex === -1 ? tabs.length : graphTabIndex
      tabs.splice(insertionIndex, 0, { id: 'openOrders', label: t('Open Orders') })
    }
    if (hasPositions) {
      tabs.unshift({ id: 'positions', label: t('Positions') })
    }
    if (hasHistory) {
      tabs.push({ id: 'history', label: t('History') })
    }
    tabs.push({ id: 'resolution', label: t('Resolution') })
    return tabs
  }, [hasHistory, hasOpenOrders, hasPositions, isResolvedView, shouldHideOrderBook, t])

  const selectedTab = useMemo<MarketDetailTab>(() => {
    if (controlledTab && visibleTabs.some(tab => tab.id === controlledTab)) {
      return controlledTab
    }
    return visibleTabs[0]?.id ?? 'graph'
  }, [controlledTab, visibleTabs])

  const proposeUrl = useMemo(
    () => buildUmaProposeUrl(market.condition, siteName),
    [market.condition, siteName],
  )
  const settledUrl = useMemo(
    () => buildUmaSettledUrl(market.condition, siteName) ?? buildUmaProposeUrl(market.condition, siteName),
    [market.condition, siteName],
  )

  useEffect(() => {
    if (selectedTab !== controlledTab) {
      select(selectedTab)
    }
  }, [controlledTab, select, selectedTab])

  return (
    <div className="pt-0">
      <div className="px-0">
        <div className="flex items-center gap-2 border-b">
          <div className="flex w-0 flex-1 gap-4 overflow-x-auto">
            {visibleTabs.map((tab) => {
              const isActive = selectedTab === tab.id
              return (
                <button
                  key={`${market.condition_id}-${tab.id}`}
                  type="button"
                  className={cn(
                    `border-b-2 border-transparent pt-1 pb-2 text-sm font-semibold whitespace-nowrap transition-colors`,
                    isActive
                      ? 'border-primary text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                  onClick={(event) => {
                    event.stopPropagation()
                    select(tab.id)
                  }}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>

          <MarketChannelStatusIndicator className="-mt-2" />

          {!shouldHideOrderBook && (
            <button
              type="button"
              className={cn(
                `
                  -mt-1 ml-auto inline-flex size-7 items-center justify-center rounded-sm text-muted-foreground
                  transition-colors
                `,
                'hover:bg-muted/70 hover:text-foreground',
                'focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none',
              )}
              aria-label={t('Refresh order book')}
              title={t('Refresh order book')}
              onClick={() => { void orderBookData.refetch() }}
              disabled={orderBookData.isLoading || orderBookData.isRefetching}
            >
              <RefreshCwIcon
                className={cn(
                  'size-3',
                  (orderBookData.isLoading || orderBookData.isRefetching) && 'animate-spin',
                )}
              />
            </button>
          )}
        </div>
      </div>

      <div className={cn('px-0', selectedTab === 'orderBook' ? 'pt-4 pb-0' : 'py-4')}>
        {selectedTab === 'orderBook' && !shouldHideOrderBook && (
          <EventOrderBook
            market={market}
            outcome={activeOutcomeForMarket}
            summaries={orderBookData.summaries}
            isLoadingSummaries={orderBookData.isLoading}
            eventSlug={event.slug}
          />
        )}

        {selectedTab === 'graph' && activeOutcomeForMarket && (
          <MarketOutcomeGraph
            market={market}
            outcome={activeOutcomeForMarket}
            allMarkets={event.markets}
            eventCreatedAt={event.created_at}
            isMobile={isMobile}
          />
        )}

        {selectedTab === 'positions' && (
          <EventMarketPositions
            market={market}
            isNegRiskEnabled={isNegRiskEnabled}
            isNegRiskAugmented={isNegRiskAugmented}
            convertOptions={convertOptions}
            eventOutcomes={eventOutcomes}
            negRiskMarketId={event.neg_risk_market_id}
          />
        )}

        {selectedTab === 'openOrders' && <EventMarketOpenOrders market={market} eventSlug={event.slug} />}

        {selectedTab === 'history' && <EventMarketHistory market={market} />}

        {selectedTab === 'resolution' && (
          <div className="flex flex-col gap-3">
            <ResolutionTimelinePanel market={market} settledUrl={settledUrl} />
            {!isMarketResolved(market) && (
              proposeUrl
                ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mb-3"
                      asChild
                      onClick={event => event.stopPropagation()}
                    >
                      <a href={proposeUrl} target="_blank" rel="noopener noreferrer">
                        {t('Propose resolution')}
                      </a>
                    </Button>
                  )
                : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mb-3"
                      disabled
                      onClick={event => event.stopPropagation()}
                    >
                      {t('Propose resolution')}
                    </Button>
                  )
            )}
          </div>
        )}
      </div>
    </div>
  )
}
