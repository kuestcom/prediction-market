'use cache'

import type { SupportedLocale } from '@/i18n/locales'
import type { Event } from '@/types'
import { cacheTag } from 'next/cache'
import SportsClient from '@/app/[locale]/(platform)/sports/_components/SportsClient'
import { cacheTags } from '@/lib/cache-tags'
import { EventRepository } from '@/lib/db/queries/event'

type SportsPageMode = 'all' | 'live' | 'futures'

interface SportsContentProps {
  locale: string
  initialTag?: string
  initialMode?: SportsPageMode
  sportsSportSlug?: string | null
  activeSportSlug?: string | null
  selectedTitle?: string
}

export default async function SportsContent({
  locale,
  initialTag = 'sports',
  initialMode = 'all',
  sportsSportSlug = null,
  activeSportSlug = null,
  selectedTitle,
}: SportsContentProps) {
  cacheTag(cacheTags.eventsGlobal)
  const resolvedLocale = locale as SupportedLocale

  let initialEvents: Event[] = []
  const normalizedSportsSportSlug = sportsSportSlug?.trim().toLowerCase() || ''

  try {
    const { data: events, error } = await EventRepository.listEvents({
      tag: initialTag,
      search: '',
      userId: '',
      bookmarked: false,
      locale: resolvedLocale,
      sportsSportSlug: normalizedSportsSportSlug,
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
    <main className="container grid gap-4 py-4">
      <SportsClient
        initialEvents={initialEvents}
        initialTag={initialTag}
        initialMode={initialMode}
        sportsSportSlug={normalizedSportsSportSlug || null}
        activeSportSlug={activeSportSlug}
        selectedTitle={selectedTitle}
      />
    </main>
  )
}
