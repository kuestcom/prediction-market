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
})
