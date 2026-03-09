'use client'

import type { Market } from '@/types'
import type { EventCardProps } from '@/types/EventCardTypes'
import EventCardFooter from '@/app/[locale]/(platform)/(home)/_components/EventCardFooter'
import EventCardHeader from '@/app/[locale]/(platform)/(home)/_components/EventCardHeader'
import EventCardMarketsList from '@/app/[locale]/(platform)/(home)/_components/EventCardMarketsList'
import EventCardSingleMarketActions from '@/app/[locale]/(platform)/(home)/_components/EventCardSingleMarketActions'
import EventCardSportsMoneyline from '@/app/[locale]/(platform)/(home)/_components/EventCardSportsMoneyline'
import { Card, CardContent } from '@/components/ui/card'
import { OUTCOME_INDEX } from '@/lib/constants'
import { shouldShowEventNewBadge } from '@/lib/event-new-badge'
import { formatDate } from '@/lib/formatters'
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
  const isResolvedEvent = event.status === 'resolved'
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
              />
            )}

            {isSingleMarket && yesOutcome && noOutcome && (
              <EventCardSingleMarketActions
                event={event}
                yesOutcome={yesOutcome}
                noOutcome={noOutcome}
                primaryMarket={primaryMarket}
                isResolvedEvent={isResolvedEvent}
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
