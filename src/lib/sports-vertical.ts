export type SportsVertical = 'sports' | 'esports'

interface SportsVerticalConfig {
  label: string
  basePath: `/${SportsVertical}`
  livePath: `/${SportsVertical}/live`
  mainTag: SportsVertical
  futureLabel: string
  futurePath: string
  futurePathPrefix: string
  futurePathSegment: string
  menuHeaderLabel: string
}

const SPORTS_VERTICAL_CONFIGS: Record<SportsVertical, SportsVerticalConfig> = {
  sports: {
    label: 'Sports',
    basePath: '/sports',
    livePath: '/sports/live',
    mainTag: 'sports',
    futureLabel: 'Futures',
    futurePath: '/sports/futures',
    futurePathPrefix: '/sports/futures',
    futurePathSegment: 'futures',
    menuHeaderLabel: 'All Sports',
  },
  esports: {
    label: 'Esports',
    basePath: '/esports',
    livePath: '/esports/live',
    mainTag: 'esports',
    futureLabel: 'Upcoming',
    futurePath: '/esports/soon',
    futurePathPrefix: '/esports/soon',
    futurePathSegment: 'soon',
    menuHeaderLabel: 'Games',
  },
}

function normalizeTagSlug(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? ''
}

export function getSportsVerticalConfig(vertical: SportsVertical) {
  return SPORTS_VERTICAL_CONFIGS[vertical]
}

export function resolveSportsVerticalFromTags(params: {
  tags?: Array<{ slug?: string | null }> | null
  mainTag?: string | null
}): SportsVertical {
  const normalizedMainTag = normalizeTagSlug(params.mainTag)
  if (normalizedMainTag === 'esports') {
    return 'esports'
  }

  const tagSlugs = new Set(
    (params.tags ?? [])
      .map(tag => normalizeTagSlug(tag.slug))
      .filter(Boolean),
  )

  return tagSlugs.has('esports') ? 'esports' : 'sports'
}
