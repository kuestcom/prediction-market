import type { SportsVertical } from '@/lib/sports-vertical'
import { getSportsVerticalConfig } from '@/lib/sports-vertical'

export const SPORTS_SIDEBAR_LIVE_COUNT_KEY = '__live__'
export const SPORTS_SIDEBAR_FUTURE_COUNT_KEY = '__future__'
const SPORTS_SIDEBAR_SECTION_DELIMITER = '::'

function resolveSportsSidebarSoonPath(vertical: SportsVertical) {
  return vertical === 'sports' ? '/sports/soon' : '/esports/soon'
}

function normalizeComparableValue(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? ''
}

function resolveSportsSidebarHrefSection(value: string | null | undefined) {
  const normalizedValue = normalizeComparableValue(value)

  if (normalizedValue.endsWith('/games')) {
    return 'games' as const
  }

  if (normalizedValue.endsWith('/props')) {
    return 'props' as const
  }

  return null
}

export function resolveSportsSidebarMenuSlugCountKey(input: {
  href?: string | null
  menuSlug?: string | null
}) {
  const normalizedMenuSlug = normalizeComparableValue(input.menuSlug)
  if (!normalizedMenuSlug) {
    return null
  }

  const section = resolveSportsSidebarHrefSection(input.href)
  if (!section) {
    return normalizedMenuSlug
  }

  return `${normalizedMenuSlug}${SPORTS_SIDEBAR_SECTION_DELIMITER}${section}`
}

export function isSportsSidebarLiveHref(value: string | null | undefined, vertical: SportsVertical) {
  return normalizeComparableValue(value) === normalizeComparableValue(getSportsVerticalConfig(vertical).livePath)
}

export function isSportsSidebarSoonHref(value: string | null | undefined, vertical: SportsVertical) {
  return normalizeComparableValue(value) === normalizeComparableValue(resolveSportsSidebarSoonPath(vertical))
}

export function isSportsSidebarFutureHref(value: string | null | undefined, vertical: SportsVertical) {
  if (vertical !== 'sports') {
    return false
  }

  return normalizeComparableValue(value)
    .startsWith(normalizeComparableValue(getSportsVerticalConfig(vertical).futurePathPrefix))
}

export function resolveSportsSidebarCountKey(input: {
  href?: string | null
  menuSlug?: string | null
  vertical: SportsVertical
}) {
  if (isSportsSidebarLiveHref(input.href, input.vertical)) {
    return SPORTS_SIDEBAR_LIVE_COUNT_KEY
  }

  if (
    isSportsSidebarSoonHref(input.href, input.vertical)
    || isSportsSidebarFutureHref(input.href, input.vertical)
  ) {
    return SPORTS_SIDEBAR_FUTURE_COUNT_KEY
  }

  return resolveSportsSidebarMenuSlugCountKey(input)
}
