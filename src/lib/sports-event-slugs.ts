export type SportsEventMarketViewKey = 'gameLines' | 'exactScore' | 'goalscorers' | 'halftimeResult'

export const SPORTS_EVENT_MARKET_VIEW_LABELS: Record<SportsEventMarketViewKey, string> = {
  gameLines: 'Game Lines',
  exactScore: 'Exact Score',
  goalscorers: 'Goalscorers',
  halftimeResult: 'Halftime Result',
}

export const SPORTS_EVENT_MARKET_VIEW_ORDER: SportsEventMarketViewKey[] = [
  'gameLines',
  'exactScore',
  'goalscorers',
  'halftimeResult',
]

const MORE_MARKETS_SUFFIX_REGEX = /-more-markets(?:-\d+)?$/i
const EXACT_SCORE_SUFFIX_REGEX = /-exact-score$/i
const GOALSCORERS_SUFFIX_REGEX = /-goalscorers?$/i
const HALFTIME_RESULT_SUFFIX_REGEX = /-halftime-result$/i
const SPORTS_AUXILIARY_SUFFIX_REGEX = /(?:-more-markets(?:-\d+)?|-exact-score|-goalscorers?|-halftime-result)$/i

export const SPORTS_AUXILIARY_SLUG_SQL_REGEX = '(-more-markets(?:-[0-9]+)?|-exact-score|-goalscorers?|-halftime-result)$'

export function isSportsMoreMarketsSlug(slug: string | null | undefined) {
  return MORE_MARKETS_SUFFIX_REGEX.test(slug?.trim() ?? '')
}

export function isSportsAuxiliaryEventSlug(slug: string | null | undefined) {
  return SPORTS_AUXILIARY_SUFFIX_REGEX.test(slug?.trim() ?? '')
}

export function stripSportsAuxiliaryEventSuffix(slug: string) {
  return slug.replace(SPORTS_AUXILIARY_SUFFIX_REGEX, '')
}

export function resolveSportsEventMarketViewKey(slug: string | null | undefined): SportsEventMarketViewKey {
  const normalizedSlug = slug?.trim() ?? ''

  if (EXACT_SCORE_SUFFIX_REGEX.test(normalizedSlug)) {
    return 'exactScore'
  }

  if (GOALSCORERS_SUFFIX_REGEX.test(normalizedSlug)) {
    return 'goalscorers'
  }

  if (HALFTIME_RESULT_SUFFIX_REGEX.test(normalizedSlug)) {
    return 'halftimeResult'
  }

  return 'gameLines'
}
