import { describe, expect, it } from 'bun:test'

import { resolveAutomaticSportsSourceCardCandidate } from '@/lib/sports-source/auto-selection'

function makeCandidate(overrides: Partial<{ confidence: number; matchReason: string[] }> = {}) {
  return {
    eventId: '2476379',
    confidence: 0.73,
    matchReason: ['sport', 'league', 'date', 'series'],
    ...overrides,
  }
}

describe('sports source card auto-selection', () => {
  it('selects the only confident parent-card candidate', () => {
    const candidate = makeCandidate()

    expect(resolveAutomaticSportsSourceCardCandidate([candidate])).toBe(candidate)
  })

  it('does not select a normal textual match automatically', () => {
    expect(resolveAutomaticSportsSourceCardCandidate([makeCandidate({ matchReason: ['content', 'date'] })])).toBeNull()
  })

  it('does not select an uncertain or ambiguous card candidate', () => {
    expect(resolveAutomaticSportsSourceCardCandidate([makeCandidate({ confidence: 0.71 })])).toBeNull()
    expect(resolveAutomaticSportsSourceCardCandidate([makeCandidate(), makeCandidate()])).toBeNull()
  })
})
