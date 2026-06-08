import type { Market, Outcome } from '@/types'
import { OUTCOME_INDEX } from '@/lib/constants'

export type HomeCardBinaryOutcome = Pick<Outcome, 'outcome_index' | 'outcome_text'>

const HOME_CARD_UNAVAILABLE_CHANCE_LABEL = '—'

const FALLBACK_BINARY_OUTCOME_LABELS = {
  [OUTCOME_INDEX.YES]: 'Yes',
  [OUTCOME_INDEX.NO]: 'No',
} as const

function hasPositiveNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

export function hasHomeCardMarketChance(market: Pick<Market, 'volume' | 'volume_24h' | 'condition'> | null | undefined) {
  return hasPositiveNumber(market?.volume)
    || hasPositiveNumber(market?.volume_24h)
    || hasPositiveNumber(market?.condition?.volume)
}

export function formatHomeCardChanceLabel(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return HOME_CARD_UNAVAILABLE_CHANCE_LABEL
  }

  return `${Math.round(value)}%`
}

export function resolveHomeCardBinaryOutcome(
  market: Pick<Market, 'outcomes'>,
  outcomeIndex: typeof OUTCOME_INDEX.YES | typeof OUTCOME_INDEX.NO,
): HomeCardBinaryOutcome {
  const matchingOutcome = market.outcomes.find(outcome => outcome.outcome_index === outcomeIndex)
  if (matchingOutcome) {
    return {
      outcome_index: matchingOutcome.outcome_index,
      outcome_text: matchingOutcome.outcome_text?.trim() || FALLBACK_BINARY_OUTCOME_LABELS[outcomeIndex],
    }
  }

  const positionalOutcome = market.outcomes[outcomeIndex]
  if (positionalOutcome) {
    return {
      outcome_index: positionalOutcome.outcome_index,
      outcome_text: positionalOutcome.outcome_text?.trim() || FALLBACK_BINARY_OUTCOME_LABELS[outcomeIndex],
    }
  }

  return {
    outcome_index: outcomeIndex,
    outcome_text: FALLBACK_BINARY_OUTCOME_LABELS[outcomeIndex],
  }
}
