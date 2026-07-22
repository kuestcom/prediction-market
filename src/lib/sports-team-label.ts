const COMPACT_SPORTS_TEAM_NAME_MAX_LENGTH = 12

export function resolveCompactSportsTeamName(
  name: string | null | undefined,
  fallback: string,
) {
  const normalizedName = name?.trim().replace(/\s+/g, ' ')
  if (!normalizedName || normalizedName.length <= COMPACT_SPORTS_TEAM_NAME_MAX_LENGTH) {
    return normalizedName || fallback
  }

  const words = normalizedName.split(' ')
  let compactName = words[0] ?? fallback

  for (const word of words.slice(1)) {
    const candidate = `${compactName} ${word}`
    if (candidate.length > COMPACT_SPORTS_TEAM_NAME_MAX_LENGTH) {
      break
    }
    compactName = candidate
  }

  return compactName
}
