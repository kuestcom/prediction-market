import type { Market, Outcome } from '@/types'
import { CheckIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useOutcomeLabel } from '@/hooks/useOutcomeLabel'
import { OUTCOME_INDEX } from '@/lib/constants'
import { cn } from '@/lib/utils'

interface EventCardSingleMarketActionsProps {
  yesOutcome: Outcome
  noOutcome: Outcome
  primaryMarket: Market | undefined
  isLoading: boolean
  isResolvedEvent: boolean
  onTrade: (outcome: Outcome, market: Market, variant: 'yes' | 'no') => void
  onToggle: () => void
}

export default function EventCardSingleMarketActions({
  yesOutcome,
  noOutcome,
  primaryMarket,
  isLoading,
  isResolvedEvent,
  onTrade,
  onToggle,
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
                flex h-12 w-full cursor-default items-center justify-center gap-2 rounded-md bg-(--card-hover) px-3
                text-sm font-semibold text-foreground transition-colors
                group-hover:bg-card
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
                flex h-10 w-full cursor-default items-center justify-center rounded-md bg-(--card-hover) px-3 text-sm
                font-semibold text-muted-foreground transition-colors
                group-hover:bg-card
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
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onTrade(yesOutcome, primaryMarket, 'yes')
          onToggle()
        }}
        disabled={isLoading}
        variant="yes"
        size="outcome"
      >
        <span className="truncate">{normalizeOutcomeLabel(yesOutcome.outcome_text) ?? yesOutcome.outcome_text}</span>
      </Button>
      <Button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onTrade(noOutcome, primaryMarket, 'no')
          onToggle()
        }}
        disabled={isLoading}
        variant="no"
        size="outcome"
      >
        <span className="truncate">{normalizeOutcomeLabel(noOutcome.outcome_text) ?? noOutcome.outcome_text}</span>
      </Button>
    </div>
  )
}
