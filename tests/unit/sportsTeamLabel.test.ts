import { describe, expect, it } from 'bun:test'

import { resolveSportsOutcomeTeamLabel } from '@/lib/sports-team-label'

describe('resolveSportsOutcomeTeamLabel', () => {
  const teams = [
    { name: 'CYBERSHOKE Esports', abbreviation: 'CS1' },
    { name: 'GenOne', abbreviation: 'G1' },
  ]

  it('uses the matching team abbreviation', () => {
    expect(
      resolveSportsOutcomeTeamLabel({
        outcomeText: 'CYBERSHOKE Esports',
        fallback: 'YES',
        teams,
      }),
    ).toBe('CS1')
  })

  it('keeps non-team outcomes unchanged', () => {
    expect(resolveSportsOutcomeTeamLabel({ outcomeText: 'Over', fallback: 'YES', teams })).toBe('Over')
  })

  it('keeps outcome details when a team name is only part of the label', () => {
    expect(
      resolveSportsOutcomeTeamLabel({
        outcomeText: 'CYBERSHOKE Esports to win by 7+',
        fallback: 'YES',
        teams,
      }),
    ).toBe('CYBERSHOKE Esports to win by 7+')
  })

  it('derives a compact label when an exact team outcome has no abbreviation', () => {
    expect(
      resolveSportsOutcomeTeamLabel({
        outcomeText: 'Team Liquid',
        fallback: 'YES',
        teams: [{ name: 'Team Liquid' }],
      }),
    ).toBe('TL')
  })
})
