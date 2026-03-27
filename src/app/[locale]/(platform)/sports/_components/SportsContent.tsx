'use cache'

import type { SupportedLocale } from '@/i18n/locales'
import type { Event } from '@/types'
import { cacheTag } from 'next/cache'
import SportsClient from '@/app/[locale]/(platform)/sports/_components/SportsClient'
import { cacheTags } from '@/lib/cache-tags'
import { EventRepository } from '@/lib/db/queries/event'

type SportsPageMode = 'all' | 'live' | 'futures'
type SportsSection = 'games' | 'props'

interface SportsContentProps {
  locale: string
  initialTag?: string
  mainTag?: string
  initialMode?: SportsPageMode
  sportsSportSlug?: string | null
  sportsSection?: SportsSection | null
}

export default async function SportsContent({
  locale,
  initialTag = 'sports',
  mainTag = initialTag,
  initialMode = 'all',
  sportsSportSlug = null,
  sportsSection = null,
}: SportsContentProps) {
  cacheTag(cacheTags.eventsGlobal)
  const resolvedLocale = locale as SupportedLocale

  let initialEvents: Event[] = []
  const normalizedSportsSportSlug = sportsSportSlug?.trim().toLowerCase() || ''
  const normalizedSportsSection = sportsSection?.trim().toLowerCase() || ''
  const resolvedSportsSection: SportsSection | '' = normalizedSportsSection === 'games' || normalizedSportsSection === 'props'
    ? normalizedSportsSection
    : ''

  try {
    const { data: events, error } = await EventRepository.listEvents({
      tag: initialTag,
      search: '',
      userId: '',
      bookmarked: false,
      locale: resolvedLocale,
      sportsSportSlug: normalizedSportsSportSlug,
      sportsSection: resolvedSportsSection,
    })

    if (error) {
      console.warn('Failed to fetch initial sports events for static generation:', error)
    }
    else {
      initialEvents = events ?? []
    }
  }
  catch {
    initialEvents = []
  }

  return (
    <SportsClient
      initialEvents={initialEvents}
      initialTag={initialTag}
      mainTag={mainTag}
      initialMode={initialMode}
      sportsSportSlug={normalizedSportsSportSlug || null}
      sportsSection={resolvedSportsSection || null}
    />
  )
}
