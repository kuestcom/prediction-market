import type { ActivityOrder } from '@/types'
import { OUTCOME_INDEX } from '@/lib/constants'

export function resolveEventActivityOutcomeColorClass(
  activity: Pick<ActivityOrder, 'outcome'>,
  isSportsEvent: boolean,
) {
  if (isSportsEvent) {
    return 'text-primary'
  }

  const outcomeTokens = new Set(
    (activity.outcome.text || '')
      .trim()
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean),
  )
  const isNegativeOutcomeText = outcomeTokens.has('no')
    || outcomeTokens.has('down')
    || outcomeTokens.has('false')
  const isPositiveOutcomeText = outcomeTokens.has('yes')
    || outcomeTokens.has('up')
    || outcomeTokens.has('true')

  if (isNegativeOutcomeText && !isPositiveOutcomeText) {
    return 'text-no'
  }
  if (isPositiveOutcomeText && !isNegativeOutcomeText) {
    return 'text-yes'
  }

  return activity.outcome.index === OUTCOME_INDEX.NO ? 'text-no' : 'text-yes'
}
