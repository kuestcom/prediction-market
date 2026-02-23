interface EventRouteInput {
  slug: string
  sports_sport_slug?: string | null
  sports_event_slug?: string | null
}

function normalizePathSegment(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase()
  return normalized || null
}

export function resolveSportsEventBasePath(event: EventRouteInput) {
  const sportsSportSlug = normalizePathSegment(event.sports_sport_slug)
  const sportsEventSlug = normalizePathSegment(event.sports_event_slug)

  if (sportsSportSlug && sportsEventSlug) {
    return `/sports/${sportsSportSlug}/${sportsEventSlug}`
  }

  return null
}

export function resolveEventPagePath(event: EventRouteInput) {
  return resolveSportsEventBasePath(event) ?? `/event/${event.slug}`
}

export function resolveEventMarketPath(event: EventRouteInput, marketSlug: string) {
  const sportsBasePath = resolveSportsEventBasePath(event)
  if (sportsBasePath) {
    return `${sportsBasePath}/${marketSlug}`
  }

  return `/event/${event.slug}/${marketSlug}`
}
