import type { SupportedLocale } from '@/i18n/locales'
import type { Event } from '@/types'
import HomeClient from '@/app/[locale]/(platform)/(home)/_components/HomeClient'
import { listHomeEventsPage } from '@/lib/home-events-page'

interface HomeContentProps {
  locale: string
  currentTimestamp?: number | null
  initialTag?: string
  initialMainTag?: string
}

export default async function HomeContent({
  locale,
  currentTimestamp = null,
  initialTag,
  initialMainTag,
}: HomeContentProps) {
  const resolvedLocale = locale as SupportedLocale
  const initialTagSlug = initialTag ?? 'trending'
  const initialMainTagSlug = initialMainTag ?? initialTagSlug
  let initialCurrentTimestamp: number | null = null

  let initialEvents: Event[] = []

  try {
    const {
      data: events,
      error,
      currentTimestamp: resolvedCurrentTimestamp,
    } = await listHomeEventsPage({
      tag: initialTagSlug,
      mainTag: initialMainTagSlug,
      search: '',
      userId: '',
      bookmarked: false,
      locale: resolvedLocale,
      currentTimestamp,
    })

    initialCurrentTimestamp = resolvedCurrentTimestamp ?? null

    if (!error) {
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
