export interface SportsSourceSearchTeam {
  name?: string | null
  abbreviation?: string | null
}

function normalizeSearchText(value: string | null | undefined) {
  return value?.replace(/\s+/g, ' ')?.trim() ?? ''
}

function cleanMatchupSide(
  value: string,
  options: { colonMode?: 'prefix' | 'suffix' } = {},
) {
  let cleaned = normalizeSearchText(value)

  for (const marker of ['(', ' - ', ' | ']) {
    const markerIndex = cleaned.indexOf(marker)
    if (markerIndex >= 0) {
      cleaned = cleaned.slice(0, markerIndex)
    }
  }

  const colonIndex = cleaned.indexOf(':')
  if (options.colonMode === 'prefix' && colonIndex >= 0 && colonIndex <= 32) {
    cleaned = cleaned.slice(colonIndex + 1)
  }
  else if (options.colonMode === 'suffix' && colonIndex >= 0) {
    cleaned = cleaned.slice(0, colonIndex)
  }

  return normalizeSearchText(cleaned)
}

const MATCHUP_DELIMITERS = [' vs. ', ' vs ', ' v. ', ' v ', ' x ', ' @ ', ' at ']

function parseMatchupFromTitle(title: string | null | undefined) {
  const normalized = normalizeSearchText(title)
  if (!normalized) {
    return null
  }

  const lowerTitle = normalized.toLowerCase()
  for (const delimiter of MATCHUP_DELIMITERS) {
    const delimiterIndex = lowerTitle.indexOf(delimiter)
    if (delimiterIndex < 0) {
      continue
    }

    const left = cleanMatchupSide(normalized.slice(0, delimiterIndex), { colonMode: 'prefix' })
    const right = cleanMatchupSide(normalized.slice(delimiterIndex + delimiter.length), { colonMode: 'suffix' })
    if (left && right) {
      return `${left} vs ${right}`
    }
  }

  return null
}

export function buildSportsSourceMatchupSearchQuery(
  teams: readonly SportsSourceSearchTeam[] | null | undefined,
  fallbackTitle?: string | null,
) {
  const teamNames = (teams ?? [])
    .map(team => normalizeSearchText(team.name) || normalizeSearchText(team.abbreviation))
    .filter(Boolean)

  if (teamNames.length >= 2) {
    return `${teamNames[0]} vs ${teamNames[1]}`
  }

  return parseMatchupFromTitle(fallbackTitle) ?? normalizeSearchText(fallbackTitle)
}

export function buildSportsSourceDefaultSearchQuery(input: {
  title?: string | null
  teams?: readonly SportsSourceSearchTeam[] | null
  category?: string | null
  tags?: readonly string[] | null
}) {
  const category = input.category?.trim().toLowerCase()
  const tags = new Set((input.tags ?? []).map(tag => tag.trim().toLowerCase()).filter(Boolean))
  if (category === 'esports' || tags.has('esports')) {
    return buildSportsSourceMatchupSearchQuery(input.teams, input.title)
  }

  return normalizeSearchText(input.title)
}
