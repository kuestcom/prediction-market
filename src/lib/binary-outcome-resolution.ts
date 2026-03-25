import { OUTCOME_INDEX } from '@/lib/constants'

export type BinaryOutcomeIndex = typeof OUTCOME_INDEX.YES | typeof OUTCOME_INDEX.NO
export type OutcomeNumerator = number | string | null | undefined

function toFiniteNumber(value: unknown) {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : null
}

export function resolveUniqueBinaryWinningOutcomeIndexFromPayoutNumerators(
  payoutNumerators: Array<OutcomeNumerator> | null | undefined,
): BinaryOutcomeIndex | null {
  if (!Array.isArray(payoutNumerators) || payoutNumerators.length === 0) {
    return null
  }

  const numericNumerators = payoutNumerators.map(value => toFiniteNumber(value))
  const finiteNumerators = numericNumerators.filter((value): value is number => value != null)
  if (finiteNumerators.length === 0) {
    return null
  }

  const maxValue = Math.max(...finiteNumerators)
  if (!(maxValue > 0)) {
    return null
  }

  const winningIndices = numericNumerators.reduce<number[]>((indices, value, index) => {
    if (value === maxValue) {
      indices.push(index)
    }
    return indices
  }, [])

  if (winningIndices.length !== 1) {
    return null
  }

  const winnerIndex = winningIndices[0]
  if (winnerIndex === OUTCOME_INDEX.YES) {
    return OUTCOME_INDEX.YES
  }
  if (winnerIndex === OUTCOME_INDEX.NO) {
    return OUTCOME_INDEX.NO
  }

  return null
}
