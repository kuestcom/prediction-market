'use client'

import type { Market } from '@/types'
import type { EventCardProps } from '@/types/EventCardTypes'
import { useMemo } from 'react'
import EventCardFooter from '@/app/[locale]/(platform)/(home)/_components/EventCardFooter'
import EventCardHeader from '@/app/[locale]/(platform)/(home)/_components/EventCardHeader'
import EventCardMarketsList from '@/app/[locale]/(platform)/(home)/_components/EventCardMarketsList'
import EventCardSingleMarketActions from '@/app/[locale]/(platform)/(home)/_components/EventCardSingleMarketActions'
import EventCardSportsMoneyline from '@/app/[locale]/(platform)/(home)/_components/EventCardSportsMoneyline'
import {
  resolveEventCardResolvedOutcomeIndex,
  shouldUseResolvedXTracker,
} from '@/app/[locale]/(platform)/(home)/_utils/eventCardResolvedOutcome'
import { useXTrackerTweetCount } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useXTrackerTweetCount'
import { Card, CardContent } from '@/components/ui/card'
import { OUTCOME_INDEX } from '@/lib/constants'
import { shouldShowEventNewBadge } from '@/lib/event-new-badge'
import { formatDate } from '@/lib/formatters'
import { isHomeEventResolvedLike } from '@/lib/home-events'
import { buildChanceByMarket } from '@/lib/market-chance'
import { buildHomeSportsMoneylineModel } from '@/lib/sports-home-card'
import { cn } from '@/lib/utils'

const EMPTY_PRICE_OVERRIDES: Record<string, number> = {}

function isMarketResolved(market: Market) {
  return Boolean(market.is_resolved || market.condition?.resolved)
}

function resolveBinaryOutcome(market: Market | undefined, outcomeIndex: typeof OUTCOME_INDEX.YES | typeof OUTCOME_INDEX.NO) {
  if (!market) {
    return null
  }

  return market.outcomes.find(outcome => outcome.outcome_index === outcomeIndex)
    ?? market.outcomes[outcomeIndex]
    ?? null
}

export default function EventCard({
  event,
  priceOverridesByMarket = EMPTY_PRICE_OVERRIDES,
  enableHomeSportsMoneylineLayout = false,
  currentTimestamp = null,
}: EventCardProps) {
  const isResolvedEvent = isHomeEventResolvedLike(event)
  const canUseXTrackerResolvedOutcomes = useMemo(
    () => shouldUseResolvedXTracker(event),
    [event],
  )
  const xtrackerTweetCountQuery = useXTrackerTweetCount(event, isResolvedEvent && canUseXTrackerResolvedOutcomes)
  const marketsToDisplay = isResolvedEvent
    ? event.markets
    : (() => {
        const activeMarkets = event.markets.filter(market => !isMarketResolved(market))
        return activeMarkets.length > 0 ? activeMarkets : event.markets
      })()
  const isSingleMarket = marketsToDisplay.length === 1
  const primaryMarket = marketsToDisplay[0]
  const originalMarketCount = Math.max(event.total_markets_count, event.markets.length)
  const shouldUsePrimaryMarketTitle = !isResolvedEvent && isSingleMarket && originalMarketCount > 1
  const cardTitle = shouldUsePrimaryMarketTitle
    ? (primaryMarket?.question || primaryMarket?.short_title || primaryMarket?.title || event.title)
    : event.title
  const yesOutcome = resolveBinaryOutcome(primaryMarket, OUTCOME_INDEX.YES)
  const noOutcome = resolveBinaryOutcome(primaryMarket, OUTCOME_INDEX.NO)
  const shouldShowNewBadge = shouldShowEventNewBadge(event, currentTimestamp)
  const shouldShowLiveBadge = !isResolvedEvent && Boolean(event.has_live_chart)
  const chanceByMarket = buildChanceByMarket(event.markets, priceOverridesByMarket)
  const homeSportsMoneylineModel = enableHomeSportsMoneylineLayout
    ? buildHomeSportsMoneylineModel(event)
    : null
  const resolvedOutcomeIndexByConditionId = useMemo<Partial<Record<string, typeof OUTCOME_INDEX.YES | typeof OUTCOME_INDEX.NO>>>(() => {
    if (!isResolvedEvent) {
      return {}
    }

    const totalCount = xtrackerTweetCountQuery.data?.totalCount ?? null
    return Object.fromEntries(
      event.markets
        .map((market) => {
          const resolvedOutcomeIndex = resolveEventCardResolvedOutcomeIndex(market, {
            isTweetMarketEvent: canUseXTrackerResolvedOutcomes,
            isTweetMarketFinal: true,
            totalCount,
          })

          return resolvedOutcomeIndex == null
            ? null
            : [market.condition_id, resolvedOutcomeIndex] as const
        })
        .filter((entry): entry is readonly [string, 0 | 1] => entry != null),
    )
  }, [canUseXTrackerResolvedOutcomes, event.markets, isResolvedEvent, xtrackerTweetCountQuery.data?.totalCount])

  function getDisplayChance(marketId: string) {
    return chanceByMarket[marketId] ?? 0
  }

  const primaryDisplayChance = primaryMarket ? getDisplayChance(primaryMarket.condition_id) : 0
  const roundedPrimaryDisplayChance = Math.round(primaryDisplayChance)
  const endedLabel = !isResolvedEvent || !isSingleMarket || !event.resolved_at
    ? null
    : (() => {
        const resolvedDate = new Date(event.resolved_at)
        if (Number.isNaN(resolvedDate.getTime())) {
          return null
        }
        return `Ended ${formatDate(resolvedDate)}`
      })()
  const resolvedVolume = event.volume ?? 0

  if (homeSportsMoneylineModel) {
    return (
      <EventCardSportsMoneyline
        event={event}
        model={homeSportsMoneylineModel}
        getDisplayChance={getDisplayChance}
        currentTimestamp={currentTimestamp}
      />
    )
  }

  return (
    <Card
      className={cn(`
        group flex h-45 flex-col overflow-hidden rounded-xl shadow-md shadow-black/4 transition-all
        hover:-translate-y-0.5 hover:shadow-black/8
        dark:hover:bg-secondary
      `)}
    >
      <CardContent
        className={
          cn(`
            flex h-full flex-col px-3 pt-3
            ${isResolvedEvent ? 'pb-3' : 'pb-3 md:pb-1'}
          `)
        }
      >
        <EventCardHeader
          event={event}
          title={cardTitle}
          isSingleMarket={isSingleMarket}
          primaryMarket={primaryMarket}
          roundedPrimaryDisplayChance={roundedPrimaryDisplayChance}
        />

        <div className="flex flex-1 flex-col">
          <div
            className={
              cn(isResolvedEvent && isSingleMarket
                ? 'mt-6'
                : isResolvedEvent && !isSingleMarket
                  ? 'mt-1'
                  : 'mt-auto')
            }
          >
            {!isSingleMarket && (
              <EventCardMarketsList
                event={event}
                markets={marketsToDisplay}
                isResolvedEvent={isResolvedEvent}
                getDisplayChance={getDisplayChance}
                resolvedOutcomeIndexByConditionId={resolvedOutcomeIndexByConditionId}
              />
            )}

            {isSingleMarket && yesOutcome && noOutcome && (
              <EventCardSingleMarketActions
                event={event}
                yesOutcome={yesOutcome}
                noOutcome={noOutcome}
                primaryMarket={primaryMarket}
                isResolvedEvent={isResolvedEvent}
                resolvedOutcomeIndexByConditionId={resolvedOutcomeIndexByConditionId}
              />
            )}
          </div>
        </div>

        <EventCardFooter
          event={event}
          shouldShowNewBadge={shouldShowNewBadge}
          showLiveBadge={shouldShowLiveBadge}
          resolvedVolume={resolvedVolume}
          endedLabel={endedLabel}
        />
      </CardContent>
    </Card>
  )
}
