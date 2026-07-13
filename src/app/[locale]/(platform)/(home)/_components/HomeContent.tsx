import type { SupportedLocale } from '@/i18n/locales'
import type { CategoryFaqContext } from '@/lib/category-faq'
import type { Event, HomeFeaturedEventCard, HomeFeaturedHotTopic, HomeFeaturedSideCardSettings } from '@/types'
import { cacheLife, cacheTag } from 'next/cache'
import HomeClient from '@/app/[locale]/(platform)/(home)/_components/HomeClient'
import {
  HOME_INITIAL_EVENTS_CACHE_LIFE,
} from '@/app/[locale]/(platform)/(home)/_utils/homeInitialEventsCache'
import FaqStructuredData from '@/components/seo/FaqStructuredData'
import { cacheTags } from '@/lib/cache-tags'
import { buildTranslatedCategoryFaqItems } from '@/lib/category-faq-server'
import { listHomeEventsPage } from '@/lib/home-events-page'
import { getHomeFeaturedSideCard, listHomeFeaturedEvents, listHomeFeaturedHotTopics } from '@/lib/home-featured-events'
import { DEFAULT_HOME_FEATURED_SETTINGS } from '@/lib/home-featured-settings'
import { getInitialHomeEventsSortBy } from '@/lib/home-route-sort'
import { loadRuntimeThemeSiteName } from '@/lib/theme-settings'

interface HomeContentProps {
  categoryFaqContext?: CategoryFaqContext
  locale: string
  currentTimestamp: number | null
  initialTag?: string
  initialMainTag?: string
}

export default async function HomeContent({
  categoryFaqContext,
  locale,
  currentTimestamp,
  initialTag,
  initialMainTag,
}: HomeContentProps) {
  'use cache'
  cacheLife(HOME_INITIAL_EVENTS_CACHE_LIFE)
  cacheTag(cacheTags.events('guest'))
  cacheTag(cacheTags.eventsList)
  cacheTag(cacheTags.homeFeaturedEvents)
  cacheTag(cacheTags.settings)

  const resolvedLocale = locale as SupportedLocale
  const initialTagSlug = initialTag ?? 'trending'
  const initialMainTagSlug = initialMainTag ?? initialTagSlug
  const shouldLoadFeaturedEvents = initialTagSlug === 'trending' && initialMainTagSlug === 'trending'
  const initialSortBy = getInitialHomeEventsSortBy(initialTagSlug)
  let initialCurrentTimestamp: number | null = null
  let initialHasMore = false

  let initialEvents: Event[] = []
  let initialNewEvents: Event[] = []
  let initialFeaturedEvents: HomeFeaturedEventCard[] = []
  let initialFeaturedHotTopics: HomeFeaturedHotTopic[] = []
  let initialFeaturedSideCard: HomeFeaturedSideCardSettings = DEFAULT_HOME_FEATURED_SETTINGS.sideCard

  const initialEventsPromise = listHomeEventsPage({
    tag: initialTagSlug,
    mainTag: initialMainTagSlug,
    search: '',
    userId: '',
    bookmarked: false,
    locale: resolvedLocale,
    currentTimestamp,
    ...(initialSortBy && { sortBy: initialSortBy }),
  })
    .then(({ data: events, error, currentTimestamp: resolvedCurrentTimestamp, hasMore }) => ({
      events: error ? [] : events ?? [],
      currentTimestamp: resolvedCurrentTimestamp ?? null,
      hasMore: !error && hasMore === true,
    }))
    .catch((error) => {
      console.error('Failed to load initial home events', error)
      return { events: [], currentTimestamp: null, hasMore: false }
    })

  const featuredEventsPromise = shouldLoadFeaturedEvents
    ? (async () => {
        try {
          const [featuredEventsResult, featuredHotTopicsResult] = await Promise.allSettled([
            listHomeFeaturedEvents(resolvedLocale),
            listHomeFeaturedHotTopics(resolvedLocale),
          ])
          const featuredEvents = featuredEventsResult.status === 'fulfilled'
            ? featuredEventsResult.value
            : []
          const featuredHotTopics = featuredHotTopicsResult.status === 'fulfilled'
            ? featuredHotTopicsResult.value
            : []

          if (featuredEventsResult.status === 'rejected') {
            console.error('Failed to load home featured markets', featuredEventsResult.reason)
          }
          if (featuredHotTopicsResult.status === 'rejected') {
            console.error('Failed to load home featured hot topics', featuredHotTopicsResult.reason)
          }

          const featuredSideCard = featuredEvents.length > 0
            ? await getHomeFeaturedSideCard(featuredEvents, featuredHotTopics)
            : DEFAULT_HOME_FEATURED_SETTINGS.sideCard

          return {
            featuredEvents,
            featuredHotTopics,
            featuredSideCard,
          }
        }
        catch (error) {
          console.error('Failed to load home featured events', error)
          return {
            featuredEvents: [],
            featuredHotTopics: [],
            featuredSideCard: DEFAULT_HOME_FEATURED_SETTINGS.sideCard,
          }
        }
      })()
    : Promise.resolve({
        featuredEvents: [],
        featuredHotTopics: [],
        featuredSideCard: DEFAULT_HOME_FEATURED_SETTINGS.sideCard,
      })

  const categoryNewEventsPromise = initialMainTagSlug !== 'trending' && initialTagSlug !== 'new'
    ? listHomeEventsPage({
        tag: initialTagSlug,
        mainTag: initialMainTagSlug,
        search: '',
        userId: '',
        bookmarked: false,
        locale: resolvedLocale,
        currentTimestamp,
        sortBy: 'created_at',
      })
        .then(({ data: events, error }) => error ? [] : events ?? [])
        .catch((error) => {
          console.error('Failed to load new category events for the footer', error)
          return []
        })
    : Promise.resolve([])

  const [initialEventsResult, featuredEventsResult, categoryNewEvents, siteName] = await Promise.all([
    initialEventsPromise,
    featuredEventsPromise,
    categoryNewEventsPromise,
    categoryFaqContext ? loadRuntimeThemeSiteName() : Promise.resolve(''),
  ])

  initialEvents = initialEventsResult.events
  initialNewEvents = categoryNewEvents
  initialCurrentTimestamp = initialEventsResult.currentTimestamp
  initialHasMore = initialEventsResult.hasMore
  initialFeaturedEvents = featuredEventsResult.featuredEvents
  initialFeaturedHotTopics = featuredEventsResult.featuredHotTopics
  initialFeaturedSideCard = featuredEventsResult.featuredSideCard

  const categoryFaqItems = categoryFaqContext
    ? await buildTranslatedCategoryFaqItems({
        ...categoryFaqContext,
        popularEventTitles: initialEvents.slice(0, 3).map(event => event.title),
        locale: resolvedLocale,
        siteName,
      })
    : []

  return (
    <>
      <FaqStructuredData items={categoryFaqItems} />
      <main className="container grid gap-4 py-4">
        <HomeClient
          categoryFaqItems={categoryFaqItems}
          initialFeaturedEvents={initialFeaturedEvents}
          initialFeaturedHotTopics={initialFeaturedHotTopics}
          initialFeaturedSideCard={initialFeaturedSideCard}
          initialEvents={initialEvents}
          initialHasMore={initialHasMore}
          initialNewEvents={initialNewEvents}
          initialCurrentTimestamp={initialCurrentTimestamp}
          initialTag={initialTagSlug}
          initialMainTag={initialMainTagSlug}
        />
      </main>
    </>
  )
}
