import type { SupportedLocale } from '@/i18n/locales'
import type { SportsVertical } from '@/lib/sports-vertical'
import { cacheTag } from 'next/cache'
import SportsGamesCenter from '@/app/[locale]/(platform)/sports/_components/SportsGamesCenter'
import { buildSportsGamesCards } from '@/app/[locale]/(platform)/sports/_utils/sports-games-data'
import { cacheTags } from '@/lib/cache-tags'
import { hasDatabaseEnv } from '@/lib/db/env'
import { EventRepository } from '@/lib/db/queries/event'
import { SportsMenuRepository } from '@/lib/db/queries/sports-menu'

type SportsFeedPageMode = 'liveAndSoon' | 'soon'
const SPORTS_FEED_PAGE_DATA_CACHE_VERSION = 2

interface SportsFeedPageContentProps {
  locale: SupportedLocale
  pageMode: SportsFeedPageMode
  sportSlug: string
  sportTitle: string
  vertical: SportsVertical
}

async function loadSportsFeedPageData({
  cacheVersion = SPORTS_FEED_PAGE_DATA_CACHE_VERSION,
  databaseEnvAvailable,
  locale,
  pageMode,
  vertical,
}: {
  cacheVersion?: number
  databaseEnvAvailable: boolean
  locale: SupportedLocale
  pageMode: SportsFeedPageMode
  vertical: SportsVertical
}) {
  'use cache'
  cacheTag(cacheTags.eventsList, cacheTags.sportsMenu)

  if (!databaseEnvAvailable) {
    return {
      cards: [],
      categoryTitleBySlug: {},
    }
  }

  const [{ data: feedEvents }, { data: layoutData }] = await Promise.all([
    EventRepository.listSportsFeedEvents({
      cacheVersion,
      locale,
      mode: pageMode,
      sportsVertical: vertical,
    }),
    SportsMenuRepository.getLayoutData(vertical),
  ])
  const events = feedEvents?.length
    ? feedEvents
    : (await EventRepository.listEvents({
        tag: vertical,
        sportsVertical: vertical,
        search: '',
        userId: '',
        bookmarked: false,
        status: 'active',
        limit: 128,
        locale,
        sportsSection: 'games',
        excludeSportsAuxiliary: true,
      })).data

  return {
    cards: buildSportsGamesCards(events ?? []),
    categoryTitleBySlug: layoutData?.h1TitleBySlug ?? {},
  }
}

export default async function SportsFeedPageContent({
  locale,
  pageMode,
  sportSlug,
  sportTitle,
  vertical,
}: SportsFeedPageContentProps) {
  const { cards, categoryTitleBySlug } = await loadSportsFeedPageData({
    cacheVersion: SPORTS_FEED_PAGE_DATA_CACHE_VERSION,
    databaseEnvAvailable: hasDatabaseEnv(),
    locale,
    pageMode,
    vertical,
  })

  return (
    <div key={`${vertical}-${sportSlug}-page`} className="contents">
      <SportsGamesCenter
        cards={cards}
        sportSlug={sportSlug}
        sportTitle={sportTitle}
        pageMode={pageMode}
        categoryTitleBySlug={categoryTitleBySlug}
        vertical={vertical}
      />
    </div>
  )
}
