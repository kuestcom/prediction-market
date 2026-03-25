import type { SupportedLocale } from '@/i18n/locales'
import type { Event } from '@/types'
import { cacheTag } from 'next/cache'
import HomeClient from '@/app/[locale]/(platform)/(home)/_components/HomeClient'
import { cacheTags } from '@/lib/cache-tags'
import { listHomeEventsPage } from '@/lib/home-events-page'

interface HomeContentProps {
  locale: string
  initialTag?: string
  initialMainTag?: string
}

export default async function HomeContent({
  locale,
  initialTag,
  initialMainTag,
}: HomeContentProps) {
  cacheTag(cacheTags.eventsGlobal)
  const resolvedLocale = locale as SupportedLocale
  const initialTagSlug = initialTag ?? 'trending'
  const initialMainTagSlug = initialMainTag ?? initialTagSlug
  let initialCurrentTimestamp: number | null = null

  let initialEvents: Event[] = []

  try {
    const { data: events, error, currentTimestamp } = await listHomeEventsPage({
      tag: initialTagSlug,
      mainTag: initialMainTagSlug,
      search: '',
      userId: '',
      bookmarked: false,
      locale: resolvedLocale,
    })

    initialCurrentTimestamp = currentTimestamp ?? null

    if (error) {
      console.warn('Failed to fetch initial events for static generation:', error)
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
      <HomeClient
        initialEvents={initialEvents}
        initialCurrentTimestamp={initialCurrentTimestamp}
        initialTag={initialTagSlug}
        initialMainTag={initialMainTagSlug}
      />
    </main>
  )
}
