import { describe, expect, it } from 'vitest'
import { shouldHighlightSportsFinalAction } from '@/app/[locale]/admin/events/_components/sports-final-action-state'

function makeEvent(overrides: Partial<Parameters<typeof shouldHighlightSportsFinalAction>[0]> = {}) {
  return {
    sports_ended: false,
    sports_source_event_id: null,
    sports_source_game_id: null,
    sports_source_provider: null,
    ...overrides,
  }
}

describe('shouldHighlightSportsFinalAction', () => {
  it('keeps the trophy highlighted when the sport final state is set manually', () => {
    expect(shouldHighlightSportsFinalAction(makeEvent({
      sports_ended: true,
    }))).toBe(true)
  })

  it('highlights the trophy when TheSportsDB source details are filled', () => {
    expect(shouldHighlightSportsFinalAction(makeEvent({
      sports_source_event_id: '12345',
      sports_source_provider: 'thesportsdb',
    }))).toBe(true)
  })

  it('highlights the trophy when PandaScore source details are filled', () => {
    expect(shouldHighlightSportsFinalAction(makeEvent({
      sports_source_game_id: 'match-123',
      sports_source_provider: 'pandascore',
    }))).toBe(true)
  })

  it('does not highlight the trophy for recognized providers without event details', () => {
    expect(shouldHighlightSportsFinalAction(makeEvent({
      sports_source_provider: 'thesportsdb',
    }))).toBe(false)
  })

  it('does not highlight the trophy for unsupported providers', () => {
    expect(shouldHighlightSportsFinalAction(makeEvent({
      sports_source_event_id: '12345',
      sports_source_provider: 'legacy-provider',
    }))).toBe(false)
  })
})
