const CROPPED_TEAM_LOGO_SPORTS = new Set([
  'mlb',
  'nba',
  'nhl',
])

export function shouldUseCroppedSportsTeamLogo(sportSlug: string | null | undefined) {
  const normalizedSportSlug = sportSlug?.trim().toLowerCase()

  if (!normalizedSportSlug) {
    return false
  }

  return CROPPED_TEAM_LOGO_SPORTS.has(normalizedSportSlug)
}
