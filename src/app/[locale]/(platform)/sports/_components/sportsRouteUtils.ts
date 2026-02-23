import { SPORTS_MENU_ENTRIES } from '@/app/[locale]/(platform)/sports/_components/sportsMenuData'

export function normalizeSportsSlug(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase()
  return normalized || null
}

export function formatSportsSlugAsTitle(sportSlug: string) {
  return sportSlug
    .split('-')
    .filter(Boolean)
    .map((segment) => {
      return segment.charAt(0).toUpperCase() + segment.slice(1)
    })
    .join(' ')
}

function resolveSportsTagSlugFromHref(href: string) {
  const segments = href
    .split('/')
    .map(segment => segment.trim().toLowerCase())
    .filter(Boolean)
  const sportsIndex = segments.indexOf('sports')
  if (sportsIndex === -1) {
    return null
  }

  const nextSegment = segments[sportsIndex + 1]
  if (!nextSegment || nextSegment === 'live' || nextSegment === 'futures') {
    return null
  }

  return nextSegment
}

const SPORTS_TITLE_BY_TAG_SLUG = (() => {
  const titleByTag = new Map<string, string>()

  for (const entry of SPORTS_MENU_ENTRIES) {
    if (entry.type === 'link') {
      const tagSlug = resolveSportsTagSlugFromHref(entry.href)
      if (tagSlug && !titleByTag.has(tagSlug)) {
        titleByTag.set(tagSlug, entry.label)
      }
      continue
    }

    if (entry.type !== 'group') {
      continue
    }

    for (const child of entry.links) {
      const tagSlug = resolveSportsTagSlugFromHref(child.href)
      if (tagSlug && !titleByTag.has(tagSlug)) {
        titleByTag.set(tagSlug, child.label)
      }
    }
  }

  return titleByTag
})()

const SPORTS_TITLE_ALIASES: Record<string, string[]> = {
  'cbb': ['ncaab'],
  'ncaab': ['cbb'],
  'counter-strike': ['cs2'],
  'cs2': ['counter-strike'],
  'league-of-legends': ['lol'],
  'lol': ['league-of-legends'],
}

export function resolveSportsTitleBySlug(sportSlug: string | null | undefined) {
  const normalizedSportSlug = normalizeSportsSlug(sportSlug)
  if (!normalizedSportSlug) {
    return null
  }

  const directTitle = SPORTS_TITLE_BY_TAG_SLUG.get(normalizedSportSlug)
  if (directTitle) {
    return directTitle
  }

  for (const alias of SPORTS_TITLE_ALIASES[normalizedSportSlug] ?? []) {
    const aliasedTitle = SPORTS_TITLE_BY_TAG_SLUG.get(alias)
    if (aliasedTitle) {
      return aliasedTitle
    }
  }

  return formatSportsSlugAsTitle(normalizedSportSlug)
}
