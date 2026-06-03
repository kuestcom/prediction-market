import { describe, expect, it } from 'vitest'
import { resolveEventActivityOutcomeColorClass } from '@/app/[locale]/(platform)/event/[slug]/_components/event-activity-utils'
import { OUTCOME_INDEX } from '@/lib/constants'

function createActivityOutcome(index: number, text: string) {
  return {
    outcome: {
      index,
      text,
    },
  }
}

describe('resolveEventActivityOutcomeColorClass', () => {
  it('colors the first binary outcome green even when the label is not Yes', () => {
    expect(resolveEventActivityOutcomeColorClass(
      createActivityOutcome(OUTCOME_INDEX.YES, 'Up'),
      false,
    )).toBe('text-yes')
  })

  it('colors the second binary outcome red', () => {
    expect(resolveEventActivityOutcomeColorClass(
      createActivityOutcome(OUTCOME_INDEX.NO, 'Down'),
      false,
    )).toBe('text-no')
  })

  it('keeps sports activity neutral', () => {
    expect(resolveEventActivityOutcomeColorClass(
      createActivityOutcome(OUTCOME_INDEX.YES, 'Home'),
      true,
    )).toBe('text-primary')
  })
})
