interface EventRouteTagInput {
  slug?: string | null
}

interface EventRouteInput {
  slug: string
  sports_sport_slug?: string | null
  sports_event_slug?: string | null
  sports_section?: 'games' | 'props' | '' | null
  tags?: EventRouteTagInput[] | null
}

function normalizePathSegment(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase()
  return normalized || null
}

export function resolveSportsSection(input: {
  sports_section?: 'games' | 'props' | '' | null
  tags?: EventRouteTagInput[] | null
}): 'games' | 'props' | null {
  const explicitSection = normalizePathSegment(input.sports_section)
  if (explicitSection === 'games' || explicitSection === 'props') {
    return explicitSection
  }

  const tagSlugs = new Set(
    (input.tags ?? [])
      .map(tag => normalizePathSegment(tag.slug))
      .filter((slug): slug is string => Boolean(slug)),
  )

  if (tagSlugs.has('props') || tagSlugs.has('prop')) {
    return 'props'
  }

  if (tagSlugs.has('games') || tagSlugs.has('game')) {
    return 'games'
  }

  return null
}

export function resolveEventBasePath(event: EventRouteInput) {
  if (resolveSportsSection(event) === 'props') {
    return null
  }

  const sportsSportSlug = normalizePathSegment(event.sports_sport_slug)
  const sportsEventSlug = normalizePathSegment(event.sports_event_slug)

  if (sportsSportSlug && sportsEventSlug) {
    return `/sports/${sportsSportSlug}/${sportsEventSlug}`
  }

  return null
}

export function resolveEventPagePath(event: EventRouteInput) {
  return resolveEventBasePath(event) ?? `/event/${event.slug}`
}

export function resolveEventMarketPath(event: EventRouteInput, marketSlug: string) {
  const sportsBasePath = resolveEventBasePath(event)
  if (sportsBasePath) {
    return `${sportsBasePath}/${marketSlug}`
  }

  return `/event/${event.slug}/${marketSlug}`
}
