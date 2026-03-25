export interface ComparableSportsTeam {
  name: string | null | undefined
  abbreviation?: string | null | undefined
}

export function normalizeComparableText(value: string | null | undefined) {
  return value
    ?.normalize('NFKD')
    .replace(/[\u0300-\u036F]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    ?? ''
}

export function parseSportsScore(value: string | null | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) {
    return null
  }

  const match = trimmed.match(/(\d+)\D+(\d+)/)
  if (!match) {
    return null
  }

  const team1 = Number.parseInt(match[1] ?? '', 10)
  const team2 = Number.parseInt(match[2] ?? '', 10)
  if (!Number.isFinite(team1) || !Number.isFinite(team2)) {
    return null
  }

  return { team1, team2 }
}

export function findMatchingTeamInText<T extends ComparableSportsTeam>(
  value: string | null | undefined,
  teams: T[],
) {
  const normalizedValue = normalizeComparableText(value)
  if (!normalizedValue) {
    return null
  }

  const teamsByLength = [...teams].sort((left, right) => {
    const leftNameLength = normalizeComparableText(left.name).length
    const rightNameLength = normalizeComparableText(right.name).length
    return rightNameLength - leftNameLength
  })
  const matchedByName = teamsByLength.find((team) => {
    const normalizedName = normalizeComparableText(team.name)
    return normalizedName.length > 0 && normalizedValue.includes(normalizedName)
  })
  if (matchedByName) {
    return matchedByName
  }

  const tokens = new Set(normalizedValue.split(' ').filter(Boolean))
  return teamsByLength.find((team) => {
    const normalizedAbbreviation = normalizeComparableText(team.abbreviation)
    return normalizedAbbreviation.length > 0 && tokens.has(normalizedAbbreviation)
  }) ?? null
}

export function doesTextMatchTeam<T extends ComparableSportsTeam>(
  value: string | null | undefined,
  team: T | null | undefined,
) {
  if (!team) {
    return false
  }

  return findMatchingTeamInText(value, [team]) != null
}
