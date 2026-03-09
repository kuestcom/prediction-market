import type { Market, Outcome } from '@/types'
import { CheckIcon, XIcon } from 'lucide-react'
import IntentPrefetchLink from '@/components/IntentPrefetchLink'
import { Button } from '@/components/ui/button'
import { useOutcomeLabel } from '@/hooks/useOutcomeLabel'
import { OUTCOME_INDEX } from '@/lib/constants'
import { resolveEventOutcomePath } from '@/lib/events-routing'
import { cn } from '@/lib/utils'

interface EventCardSingleMarketActionsProps {
  event: {
    slug: string
    sports_sport_slug?: string | null
    sports_event_slug?: string | null
  }
  yesOutcome: Outcome
  noOutcome: Outcome
  primaryMarket: Market | undefined
  isResolvedEvent: boolean
}

export default function EventCardSingleMarketActions({
  event,
  yesOutcome,
  noOutcome,
  primaryMarket,
  isResolvedEvent,
}: EventCardSingleMarketActionsProps) {
  const normalizeOutcomeLabel = useOutcomeLabel()
  if (!primaryMarket) {
    return null
  }

  if (isResolvedEvent) {
    const resolvedOutcome = primaryMarket.outcomes.find(outcome => outcome.is_winning_outcome)
    const resolvedLabel = normalizeOutcomeLabel(resolvedOutcome?.outcome_text) ?? resolvedOutcome?.outcome_text
    const isYesOutcome = resolvedOutcome?.outcome_index === OUTCOME_INDEX.YES

    return (
      <div className="mt-auto mb-0">
        {resolvedOutcome
          ? (
              <div className={`
                flex h-12 w-full cursor-default items-center justify-center gap-2 rounded-md border px-3 text-sm
                font-semibold text-foreground transition-colors
                dark:border-none dark:bg-secondary
                dark:group-hover:bg-card
              `}
              >
                <span className="min-w-8 text-right">{resolvedLabel}</span>
                <span className={cn(`flex size-4 items-center justify-center rounded-full ${isYesOutcome
                  ? 'bg-yes'
                  : `bg-no`}`)}
                >
                  {isYesOutcome
                    ? <CheckIcon className="size-3 text-background" strokeWidth={2.5} />
                    : <XIcon className="size-3 text-background" strokeWidth={2.5} />}
                </span>
              </div>
            )
          : (
              <div className={`
                flex h-10 w-full cursor-default items-center justify-center rounded-md px-3 text-sm font-semibold
                text-muted-foreground transition-colors
                dark:group-hover:bg-card
              `}
              >
                Resolved
              </div>
            )}
      </div>
    )
  }

  return (
    <div className="mt-auto mb-2 grid grid-cols-2 gap-2">
      <Button
        asChild
        variant="yes"
        size="outcome"
      >
        <IntentPrefetchLink
          href={resolveEventOutcomePath(event, {
            marketSlug: primaryMarket.slug,
            conditionId: primaryMarket.condition_id,
            outcomeIndex: OUTCOME_INDEX.YES,
          })}
        >
          <span className="truncate">{normalizeOutcomeLabel(yesOutcome.outcome_text) ?? yesOutcome.outcome_text}</span>
        </IntentPrefetchLink>
      </Button>
      <Button
        asChild
        variant="no"
        size="outcome"
      >
        <IntentPrefetchLink
          href={resolveEventOutcomePath(event, {
            marketSlug: primaryMarket.slug,
            conditionId: primaryMarket.condition_id,
            outcomeIndex: OUTCOME_INDEX.NO,
          })}
        >
          <span className="truncate">{normalizeOutcomeLabel(noOutcome.outcome_text) ?? noOutcome.outcome_text}</span>
        </IntentPrefetchLink>
      </Button>
    </div>
  )
}
