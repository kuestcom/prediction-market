import { describe, expect, it } from 'vitest'
import { shouldUseCroppedSportsTeamLogo } from '@/lib/sports-team-logo'

describe('sportsTeamLogo', () => {
  it('uses cropped logos only for mlb, nba, and nhl', () => {
    expect(shouldUseCroppedSportsTeamLogo('mlb')).toBe(true)
    expect(shouldUseCroppedSportsTeamLogo('nba')).toBe(true)
    expect(shouldUseCroppedSportsTeamLogo('nhl')).toBe(true)
    expect(shouldUseCroppedSportsTeamLogo('soccer')).toBe(false)
  })

  it('normalizes the incoming slug', () => {
    expect(shouldUseCroppedSportsTeamLogo(' MLB ')).toBe(true)
    expect(shouldUseCroppedSportsTeamLogo(null)).toBe(false)
  })
})
