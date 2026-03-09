interface EventRouteInput {
  slug: string
  sports_sport_slug?: string | null
  sports_event_slug?: string | null
}

function normalizePathSegment(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase()
  return normalized || null
}

export function resolveEventBasePath(event: EventRouteInput) {
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
