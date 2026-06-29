import type { SupportedLocale } from '@/i18n/locales'
import type { Event, HomeFeaturedEventCard, HomeFeaturedHotTopic, HomeFeaturedSideCardSettings } from '@/types'
import HomeClient from '@/app/[locale]/(platform)/(home)/_components/HomeClient'
import { listHomeEventsPage } from '@/lib/home-events-page'
import { getHomeFeaturedSideCard, listHomeFeaturedEvents, listHomeFeaturedHotTopics } from '@/lib/home-featured-events'
import { DEFAULT_HOME_FEATURED_SETTINGS } from '@/lib/home-featured-settings'
import { getInitialHomeEventsSortBy } from '@/lib/home-route-sort'

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
  const shouldLoadFeaturedEvents = initialTagSlug === 'trending' && initialMainTagSlug === 'trending'
  const initialSortBy = getInitialHomeEventsSortBy(initialTagSlug)
  let initialCurrentTimestamp: number | null = null

  let initialEvents: Event[] = []
  let initialFeaturedEvents: HomeFeaturedEventCard[] = []
  let initialFeaturedHotTopics: HomeFeaturedHotTopic[] = []
  let initialFeaturedSideCard: HomeFeaturedSideCardSettings = DEFAULT_HOME_FEATURED_SETTINGS.sideCard

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
      ...(initialSortBy && { sortBy: initialSortBy }),
    })

    initialCurrentTimestamp = resolvedCurrentTimestamp ?? null

    if (!error) {
      initialEvents = events ?? []
    }
  }
  catch (error) {
    console.error('Failed to load initial home events', error)
    initialEvents = []
  }

  if (shouldLoadFeaturedEvents) {
    try {
      initialFeaturedEvents = await listHomeFeaturedEvents(resolvedLocale)
      initialFeaturedHotTopics = initialFeaturedEvents.length > 0
        ? await listHomeFeaturedHotTopics(resolvedLocale)
        : []
      initialFeaturedSideCard = initialFeaturedEvents.length > 0
        ? await getHomeFeaturedSideCard(initialFeaturedEvents, initialFeaturedHotTopics)
        : DEFAULT_HOME_FEATURED_SETTINGS.sideCard
    }
    catch (error) {
      console.error('Failed to load home featured events', error)
      initialFeaturedEvents = []
      initialFeaturedHotTopics = []
      initialFeaturedSideCard = DEFAULT_HOME_FEATURED_SETTINGS.sideCard
    }
  }

  return (
    <main className="container grid gap-4 py-4">
      <HomeClient
        initialFeaturedEvents={initialFeaturedEvents}
        initialFeaturedHotTopics={initialFeaturedHotTopics}
        initialFeaturedSideCard={initialFeaturedSideCard}
        initialEvents={initialEvents}
        initialCurrentTimestamp={initialCurrentTimestamp}
        initialTag={initialTagSlug}
        initialMainTag={initialMainTagSlug}
      />
    </main>
  )
}
