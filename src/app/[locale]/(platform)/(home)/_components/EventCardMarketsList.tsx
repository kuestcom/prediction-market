import type { Event, Market } from '@/types'
import { CheckIcon, XIcon } from 'lucide-react'
import { resolveBinaryOutcomeByIndex } from '@/app/[locale]/(platform)/(home)/_utils/eventCardResolvedOutcome'
import IntentPrefetchLink from '@/components/IntentPrefetchLink'
import { Button } from '@/components/ui/button'
import { useOutcomeLabel } from '@/hooks/useOutcomeLabel'
import { OUTCOME_INDEX } from '@/lib/constants'
import { resolveEventMarketPath, resolveEventOutcomePath } from '@/lib/events-routing'
import { cn } from '@/lib/utils'

interface EventCardMarketsListProps {
  event: Event
  markets: Market[]
  isResolvedEvent: boolean
  getDisplayChance: (marketId: string) => number
  resolvedOutcomeIndexByConditionId: Partial<Record<string, typeof OUTCOME_INDEX.YES | typeof OUTCOME_INDEX.NO>>
}

export default function EventCardMarketsList({
  event,
  markets,
  isResolvedEvent,
  getDisplayChance,
  resolvedOutcomeIndexByConditionId,
}: EventCardMarketsListProps) {
  const normalizeOutcomeLabel = useOutcomeLabel()
  const marketsToRender = isResolvedEvent
    ? markets
        .map((market, index) => {
          const resolvedOutcomeIndex = resolvedOutcomeIndexByConditionId[market.condition_id] ?? null
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
    : markets

  return (
    <div
      className={cn(
        'max-h-16 space-y-2 overflow-y-auto',
        isResolvedEvent ? 'mb-1' : 'mb-2',
      )}
    >
      {marketsToRender.map((market) => {
        const resolvedOutcomeIndex = isResolvedEvent
          ? resolvedOutcomeIndexByConditionId[market.condition_id] ?? null
          : null
        const resolvedOutcome = isResolvedEvent
          ? resolveBinaryOutcomeByIndex(market, resolvedOutcomeIndex)
          : null
        const yesOutcome = market.outcomes.find(outcome => outcome.outcome_index === OUTCOME_INDEX.YES) ?? market.outcomes[0]
        const noOutcome = market.outcomes.find(outcome => outcome.outcome_index === OUTCOME_INDEX.NO) ?? market.outcomes[1]
        const resolvedLabel = resolvedOutcome?.outcome_text
        const isYesOutcome = resolvedOutcomeIndex === OUTCOME_INDEX.YES
        const displayResolvedLabel = normalizeOutcomeLabel(resolvedLabel) ?? resolvedLabel

        return (
          <div
            key={market.condition_id}
            className="flex items-center justify-between"
          >
            <IntentPrefetchLink
              href={resolveEventMarketPath(event, market.slug)}
              className="block min-w-0 flex-1 truncate text-[13px] underline-offset-2 hover:underline dark:text-white"
              title={market.short_title || market.title}
            >
              {market.short_title || market.title}
            </IntentPrefetchLink>
            <div className="ml-2 flex items-center gap-2">
              {isResolvedEvent
                ? (
                    resolvedOutcome
                      ? (
                          <span className={`
                            inline-flex items-center gap-2 rounded-md px-2.5 py-1 text-sm font-semibold text-foreground
                            transition-colors
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
                            inline-flex items-center rounded-md px-2.5 py-1 text-sm font-semibold text-muted-foreground
                            transition-colors
                            group-hover:bg-card
                          `}
                          >
                            Resolved
                          </span>
                        )
                  )
                : (
                    (() => {
                      if (!yesOutcome || !noOutcome) {
                        return null
                      }

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
                              asChild
                              variant="yes"
                              className="group/yes h-7 w-10 px-2 py-1 text-xs"
                            >
                              <IntentPrefetchLink
                                href={resolveEventOutcomePath(event, {
                                  marketSlug: market.slug,
                                  outcomeIndex: yesOutcome.outcome_index,
                                })}
                              >
                                <span className="truncate group-hover/yes:hidden">
                                  {normalizeOutcomeLabel(yesOutcome.outcome_text) ?? yesOutcome.outcome_text}
                                </span>
                                <span className="hidden group-hover/yes:inline">
                                  {displayChance}
                                  %
                                </span>
                              </IntentPrefetchLink>
                            </Button>
                            <Button
                              asChild
                              variant="no"
                              size="sm"
                              className="group/no h-auto w-11 px-2 py-1 text-xs"
                            >
                              <IntentPrefetchLink
                                href={resolveEventOutcomePath(event, {
                                  marketSlug: market.slug,
                                  outcomeIndex: noOutcome.outcome_index,
                                })}
                              >
                                <span className="truncate group-hover/no:hidden">
                                  {normalizeOutcomeLabel(noOutcome.outcome_text) ?? noOutcome.outcome_text}
                                </span>
                                <span className="hidden group-hover/no:inline">
                                  {oppositeChance}
                                  %
                                </span>
                              </IntentPrefetchLink>
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
