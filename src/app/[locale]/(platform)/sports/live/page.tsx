'use cache'

import type { Metadata } from 'next'
import type { SupportedLocale } from '@/i18n/locales'
import { setRequestLocale } from 'next-intl/server'
import SportsGamesCenter from '@/app/[locale]/(platform)/sports/_components/SportsGamesCenter'
import { buildSportsGamesCards } from '@/app/[locale]/(platform)/sports/_utils/sports-games-data'
import { EventRepository } from '@/lib/db/queries/event'
import { SportsMenuRepository } from '@/lib/db/queries/sports-menu'

export const metadata: Metadata = {
  title: 'Sports Live',
}

export default async function SportsLivePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const [{ data: events }, { data: layoutData }] = await Promise.all([
    EventRepository.listEvents({
      tag: 'sports',
      search: '',
      userId: '',
      bookmarked: false,
      status: 'active',
      locale: locale as SupportedLocale,
      sportsSection: 'games',
    }),
    SportsMenuRepository.getLayoutData('sports'),
  ])
  const cards = buildSportsGamesCards(events ?? [])

  return (
    <div key="sports-live-page" className="contents">
      <SportsGamesCenter
        cards={cards}
        sportSlug="live"
        sportTitle="LIVE"
        pageMode="live"
        categoryTitleBySlug={layoutData?.h1TitleBySlug ?? {}}
        vertical="sports"
      />
    </div>
  )
}
