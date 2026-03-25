import { describe, expect, it } from 'vitest'
import { resolveUniqueBinaryWinningOutcomeIndexFromPayoutNumerators } from '@/lib/binary-outcome-resolution'
import { OUTCOME_INDEX } from '@/lib/constants'

describe('resolveUniqueBinaryWinningOutcomeIndexFromPayoutNumerators', () => {
  it('returns yes when yes is the unique highest payout', () => {
    expect(resolveUniqueBinaryWinningOutcomeIndexFromPayoutNumerators([3, 1])).toBe(OUTCOME_INDEX.YES)
  })

  it('returns no when no is the unique highest payout', () => {
    expect(resolveUniqueBinaryWinningOutcomeIndexFromPayoutNumerators([1, 4])).toBe(OUTCOME_INDEX.NO)
  })

  it('returns null when payout numerators are tied for the highest value', () => {
    expect(resolveUniqueBinaryWinningOutcomeIndexFromPayoutNumerators([5, 5])).toBeNull()
    expect(resolveUniqueBinaryWinningOutcomeIndexFromPayoutNumerators([7, 3, 7])).toBeNull()
    expect(resolveUniqueBinaryWinningOutcomeIndexFromPayoutNumerators([5, 1, 5])).toBeNull()
  })

  it('returns null when the highest payout is not on a binary outcome index', () => {
    expect(resolveUniqueBinaryWinningOutcomeIndexFromPayoutNumerators([1, 2, 4])).toBeNull()
  })

  it('returns null when payout numerators are not a complete binary pair', () => {
    expect(resolveUniqueBinaryWinningOutcomeIndexFromPayoutNumerators([5])).toBeNull()
    expect(resolveUniqueBinaryWinningOutcomeIndexFromPayoutNumerators([5, null])).toBeNull()
    expect(resolveUniqueBinaryWinningOutcomeIndexFromPayoutNumerators([undefined, 5])).toBeNull()
    expect(resolveUniqueBinaryWinningOutcomeIndexFromPayoutNumerators([5, 1, 0])).toBeNull()
  })

  it('returns null when all payout numerators are non-positive', () => {
    expect(resolveUniqueBinaryWinningOutcomeIndexFromPayoutNumerators([0, 0])).toBeNull()
    expect(resolveUniqueBinaryWinningOutcomeIndexFromPayoutNumerators([-1, -2])).toBeNull()
  })
})
