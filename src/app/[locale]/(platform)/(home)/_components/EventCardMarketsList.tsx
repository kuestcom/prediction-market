import type { Event, Market, Outcome } from '@/types'
import { CheckIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useOutcomeLabel } from '@/hooks/useOutcomeLabel'
import { Link } from '@/i18n/navigation'
import { OUTCOME_INDEX } from '@/lib/constants'
import { cn } from '@/lib/utils'

interface EventCardMarketsListProps {
  event: Event
  isResolvedEvent: boolean
  getDisplayChance: (marketId: string) => number
  onTrade: (outcome: Outcome, market: Market, variant: 'yes' | 'no') => void
  onToggle: () => void
}

export default function EventCardMarketsList({
  event,
  isResolvedEvent,
  getDisplayChance,
  onTrade,
  onToggle,
}: EventCardMarketsListProps) {
  const normalizeOutcomeLabel = useOutcomeLabel()
  const marketsToRender = isResolvedEvent
    ? event.markets
        .map((market, index) => {
          const resolvedOutcome = market.outcomes.find(outcome => outcome.is_winning_outcome)
          const resolvedOutcomeIndex = resolvedOutcome?.outcome_index ?? null
          const rank = resolvedOutcomeIndex === OUTCOME_INDEX.YES
            ? 0
            : resolvedOutcomeIndex === OUTCOME_INDEX.NO
              ? 1
              : 2

          return {
            market,
            index,
            rank,
          }
        })
        .sort((a, b) => (a.rank - b.rank) || (a.index - b.index))
        .map(item => item.market)
    : event.markets

  return (
    <div
      className={cn(
        'max-h-16 space-y-2 overflow-y-auto',
        isResolvedEvent ? 'mb-1' : 'mb-2',
      )}
    >
      {marketsToRender.map((market) => {
        const resolvedOutcome = isResolvedEvent
          ? market.outcomes.find(outcome => outcome.is_winning_outcome)
          : null
        const resolvedLabel = resolvedOutcome?.outcome_text
        const isYesOutcome = resolvedOutcome?.outcome_index === OUTCOME_INDEX.YES
        const displayResolvedLabel = normalizeOutcomeLabel(resolvedLabel) ?? resolvedLabel

        return (
          <div
            key={market.condition_id}
            className="flex items-center justify-between"
          >
            <Link
              href={`/event/${event.slug}/${market.slug}`}
              className="block min-w-0 flex-1 truncate text-[13px] underline-offset-2 hover:underline dark:text-white"
              title={market.short_title || market.title}
            >
              {market.short_title || market.title}
            </Link>
            <div className="ml-2 flex items-center gap-2">
              {isResolvedEvent
                ? (
                    resolvedOutcome
                      ? (
                          <span className={`
                            inline-flex items-center gap-2 rounded-md bg-(--card-hover) px-2.5 py-1 text-sm
                            font-semibold text-foreground transition-colors
                            group-hover:bg-card
                          `}
                          >
                            <span className={cn(`flex size-4 items-center justify-center rounded-full ${isYesOutcome
                              ? `bg-yes`
                              : `bg-no`}`)}
                            >
                              {isYesOutcome
                                ? <CheckIcon className="size-3 text-background" strokeWidth={2.5} />
                                : <XIcon className="size-3 text-background" strokeWidth={2.5} />}
                            </span>
                            <span className="min-w-8 text-left">{displayResolvedLabel}</span>
                          </span>
                        )
                      : (
                          <span className={`
                            inline-flex items-center rounded-md bg-(--card-hover) px-2.5 py-1 text-sm font-semibold
                            text-muted-foreground transition-colors
                            group-hover:bg-card
                          `}
                          >
                            Resolved
                          </span>
                        )
                  )
                : (
                    (() => {
                      const displayChance = Math.round(getDisplayChance(market.condition_id))
                      const oppositeChance = Math.max(0, Math.min(100, 100 - displayChance))
                      return (
                        <>
                          <span className="text-base font-semibold text-foreground">
                            {displayChance}
                            %
                          </span>
                          <div className="flex gap-1">
                            <Button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                onTrade(market.outcomes[0], market, 'yes')
                                onToggle()
                              }}
                              variant="yes"
                              className="group h-7 w-10 px-2 py-1 text-xs"
                            >
                              <span className="truncate group-hover:hidden">
                                {normalizeOutcomeLabel(market.outcomes[0].outcome_text) ?? market.outcomes[0].outcome_text}
                              </span>
                              <span className="hidden group-hover:inline">
                                {displayChance}
                                %
                              </span>
                            </Button>
                            <Button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                onTrade(market.outcomes[1], market, 'no')
                                onToggle()
                              }}
                              variant="no"
                              size="sm"
                              className="group h-auto w-11 px-2 py-1 text-xs"
                            >
                              <span className="truncate group-hover:hidden">
                                {normalizeOutcomeLabel(market.outcomes[1].outcome_text) ?? market.outcomes[1].outcome_text}
                              </span>
                              <span className="hidden group-hover:inline">
                                {oppositeChance}
                                %
                              </span>
                            </Button>
                          </div>
                        </>
                      )
                    })()
                  )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
