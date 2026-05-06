'use client'

import type { MarketDetailTab } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useMarketDetailController'
import type { SharesByCondition } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useUserShareBalances'
import type { OrderBookSummariesResponse } from '@/app/[locale]/(platform)/event/[slug]/_types/EventOrderBookTypes'
import type { DataApiActivity } from '@/lib/data-api/user'
import type { Event } from '@/types'
import { useQuery } from '@tanstack/react-query'
import { RefreshCwIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useEffect, useMemo } from 'react'
import ConnectionStatusIndicator from '@/app/[locale]/(platform)/event/[slug]/_components/ConnectionStatusIndicator'
import { useMarketChannelStatus } from '@/app/[locale]/(platform)/event/[slug]/_components/EventMarketChannelProvider'
import EventMarketHistory from '@/app/[locale]/(platform)/event/[slug]/_components/EventMarketHistory'
import EventMarketOpenOrders from '@/app/[locale]/(platform)/event/[slug]/_components/EventMarketOpenOrders'
import EventMarketPositions from '@/app/[locale]/(platform)/event/[slug]/_components/EventMarketPositions'
import EventOrderBook from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderBook'
import MarketOutcomeGraph from '@/app/[locale]/(platform)/event/[slug]/_components/MarketOutcomeGraph'
import ResolutionTimelinePanel from '@/app/[locale]/(platform)/event/[slug]/_components/ResolutionTimelinePanel'
import { useUserOpenOrdersQuery } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useUserOpenOrdersQuery'
import { isMarketResolved, POSITION_VISIBILITY_THRESHOLD, resolveWinningOutcomeIndex } from '@/app/[locale]/(platform)/event/[slug]/_utils/eventMarketUtils'
import {
  toResolutionTimelineOutcome,
} from '@/app/[locale]/(platform)/event/[slug]/_utils/eventResolvedOutcome'
import { Button } from '@/components/ui/button'
import { useSiteIdentity } from '@/hooks/useSiteIdentity'
import { OUTCOME_INDEX } from '@/lib/constants'
import { fetchUserActivityData } from '@/lib/data-api/user'
import { buildUmaProposeUrl, buildUmaSettledUrl } from '@/lib/uma'
import { cn } from '@/lib/utils'
import { useUser } from '@/stores/useUser'

export interface MarketDetailTabsProps {
  currentTimestamp: number | null
  market: Event['markets'][number]
  event: Event
  isMobile: boolean
  isNegRiskEnabled: boolean
  isNegRiskAugmented: boolean
  variant?: 'default' | 'resolved'
  resolvedOutcomeIndexOverride?: typeof OUTCOME_INDEX.YES | typeof OUTCOME_INDEX.NO | null
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

export default function MarketDetailTabs({
  currentTimestamp,
  market,
  event,
  isMobile,
  isNegRiskEnabled,
  isNegRiskAugmented,
  variant = 'default',
  resolvedOutcomeIndexOverride = null,
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
  const marketChannelStatus = useMarketChannelStatus()
  const { selected: controlledTab, select } = tabController
  const positionSizeThreshold = POSITION_VISIBILITY_THRESHOLD
  const isResolvedView = variant === 'resolved'
  const isResolvedMarket = isMarketResolved(market)
  const isResolvedContext = isResolvedView || isResolvedMarket
  const shouldHideOrderBook = isResolvedContext
  const marketShares = sharesByCondition?.[market.condition_id]
  const yesShares = marketShares?.[OUTCOME_INDEX.YES] ?? 0
  const noShares = marketShares?.[OUTCOME_INDEX.NO] ?? 0
  const hasPositions = Boolean(
    user?.deposit_wallet_address
    && marketShares
    && (yesShares >= positionSizeThreshold || noShares >= positionSizeThreshold),
  )

  const { data: openOrdersData } = useUserOpenOrdersQuery({
    userId: user?.id,
    eventSlug: event.slug,
    conditionId: market.condition_id,
    enabled: Boolean(user?.id) && !isResolvedContext,
  })
  const hasOpenOrders = useMemo(() => {
    if (isResolvedContext) {
      return false
    }
    const pages = openOrdersData?.pages ?? []
    return pages.some(page => page.data.length > 0)
  }, [isResolvedContext, openOrdersData?.pages])

  const { data: historyPreview } = useQuery<DataApiActivity[]>({
    queryKey: ['user-market-activity-preview', user?.deposit_wallet_address, market.condition_id],
    queryFn: ({ signal }) =>
      fetchUserActivityData({
        pageParam: 0,
        userAddress: user?.deposit_wallet_address ?? '',
        conditionId: market.condition_id,
        signal,
      }),
    enabled: Boolean(user?.deposit_wallet_address && market.condition_id) && !isResolvedContext,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
  })
  const hasHistory = useMemo(
    () => {
      if (isResolvedContext) {
        return false
      }
      return (historyPreview ?? []).some(activity =>
        activity.type?.toLowerCase() === 'trade'
        && activity.conditionId === market.condition_id)
    },
    [historyPreview, isResolvedContext, market.condition_id],
  )

  const visibleTabs = useMemo(() => {
    if (isResolvedContext) {
      return [
        { id: 'graph', label: t('Graph') },
        { id: 'history', label: t('History') },
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
  }, [hasHistory, hasOpenOrders, hasPositions, isResolvedContext, shouldHideOrderBook, t])

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

          {!shouldHideOrderBook && (
            <ConnectionStatusIndicator className="-mt-2" status={marketChannelStatus} />
          )}

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
                  { 'animate-spin': orderBookData.isLoading || orderBookData.isRefetching },
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
            openMobileOrderPanelOnLevelSelect={isMobile}
          />
        )}

        {selectedTab === 'graph' && activeOutcomeForMarket && (
          <MarketOutcomeGraph
            market={market}
            outcome={activeOutcomeForMarket}
            allMarkets={event.markets}
            eventCreatedAt={event.created_at}
            isMobile={isMobile}
            currentTimestamp={currentTimestamp}
          />
        )}

        {selectedTab === 'positions' && (
          <EventMarketPositions
            market={market}
            eventId={event.id}
            eventSlug={event.slug}
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
          <div className="flex items-center justify-between gap-3">
            <ResolutionTimelinePanel
              market={market}
              settledUrl={settledUrl}
              outcomeOverride={toResolutionTimelineOutcome(
                resolvedOutcomeIndexOverride ?? resolveWinningOutcomeIndex(market),
              )}
              className="min-w-0 flex-1"
            />
            {!isMarketResolved(market) && (
              proposeUrl
                ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
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
                      className="shrink-0"
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
