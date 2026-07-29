import type { Event } from '@/types'

import { resolveUniqueBinaryWinningOutcomeIndexFromPayoutNumerators } from '@/lib/binary-outcome-resolution'
import { OUTCOME_INDEX } from '@/lib/constants'

export const POSITION_VISIBILITY_THRESHOLD = 0.01

export function isMarketResolved(market: Event['markets'][number]) {
  return Boolean(market.is_resolved || market.condition?.resolved)
}

export function resolveWinningOutcomeIndex(market: Event['markets'][number]) {
  const explicitWinner = market.outcomes.find((outcome) => outcome.is_winning_outcome)
  if (
    explicitWinner &&
    (explicitWinner.outcome_index === OUTCOME_INDEX.YES || explicitWinner.outcome_index === OUTCOME_INDEX.NO)
  ) {
    return explicitWinner.outcome_index
  }

  return resolveUniqueBinaryWinningOutcomeIndexFromPayoutNumerators(market.condition?.payout_numerators)
}
