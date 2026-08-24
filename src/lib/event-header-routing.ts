import type { Event } from '@/types'

import { PLATFORM_RESERVED_MAIN_CATEGORY_SLUGS } from '@/lib/platform-routing'

function normalizeHeaderRouteSlug(value: string) {
  return value.trim().toLowerCase()
}

function hasStructuredSportsMetadata(
  event: Pick<Event, 'sports_event_id' | 'sports_event_slug' | 'sports_sport_slug' | 'sports_teams'>,
) {
  return Boolean(
    event.sports_event_id ||
    event.sports_event_slug?.trim() ||
    event.sports_sport_slug?.trim() ||
    event.sports_teams?.length,
  )
}

export function resolveEventHeaderSubcategoryHref({
  event,
  mainSlug,
  subcategorySlug,
}: {
  event: Pick<Event, 'sports_event_id' | 'sports_event_slug' | 'sports_sport_slug' | 'sports_teams'>
  mainSlug: string
  subcategorySlug: string
}) {
  const normalizedMainSlug = normalizeHeaderRouteSlug(mainSlug)
  const normalizedSubcategorySlug = normalizeHeaderRouteSlug(subcategorySlug)

  if (!normalizedMainSlug || !normalizedSubcategorySlug) {
    return null
  }

  if (PLATFORM_RESERVED_MAIN_CATEGORY_SLUGS.has(normalizedMainSlug) && !hasStructuredSportsMetadata(event)) {
    return `/predictions/${normalizedSubcategorySlug}`
  }

  return `/${normalizedMainSlug}/${normalizedSubcategorySlug}`
}
