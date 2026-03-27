import { getSportsVerticalConfig, resolveSportsVerticalFromTags } from '@/lib/sports-vertical'

interface EventRouteTagInput {
  slug?: string | null
}

interface EventRouteInput {
  slug: string
  main_tag?: string | null
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
    const vertical = resolveSportsVerticalFromTags({
      tags: event.tags,
      mainTag: event.main_tag,
    })

    return `${getSportsVerticalConfig(vertical).basePath}/${sportsSportSlug}/${sportsEventSlug}`
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

interface EventOutcomePathOptions {
  marketSlug?: string | null
  conditionId?: string | null
  outcomeIndex: number
}

export function resolveEventOutcomePath(event: EventRouteInput, options: EventOutcomePathOptions) {
  const basePath = options.marketSlug
    ? resolveEventMarketPath(event, options.marketSlug)
    : resolveEventPagePath(event)
  const searchParams = new URLSearchParams()

  if (!options.marketSlug && options.conditionId?.trim()) {
    searchParams.set('conditionId', options.conditionId.trim())
  }

  searchParams.set('outcomeIndex', String(options.outcomeIndex))

  const query = searchParams.toString()

  return query ? `${basePath}?${query}` : basePath
}
