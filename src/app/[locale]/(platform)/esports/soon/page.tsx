'use cache'

import type { Metadata } from 'next'
import type { SupportedLocale } from '@/i18n/locales'
import { setRequestLocale } from 'next-intl/server'
import SportsGamesCenter from '@/app/[locale]/(platform)/sports/_components/SportsGamesCenter'
import { buildSportsGamesCards } from '@/app/[locale]/(platform)/sports/_utils/sports-games-data'
import { EventRepository } from '@/lib/db/queries/event'
import { SportsMenuRepository } from '@/lib/db/queries/sports-menu'

export const metadata: Metadata = {
  title: 'Esports Upcoming',
}

export default async function EsportsSoonPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const [{ data: events }, { data: layoutData }] = await Promise.all([
    EventRepository.listEvents({
      tag: 'esports',
      sportsVertical: 'esports',
      search: '',
      userId: '',
      bookmarked: false,
      status: 'active',
      locale: locale as SupportedLocale,
      sportsSection: 'games',
      excludeSportsAuxiliary: true,
    }),
    SportsMenuRepository.getLayoutData('esports'),
  ])
  const cards = buildSportsGamesCards(events ?? [])

  return (
    <div key="esports-soon-page" className="contents">
      <SportsGamesCenter
        cards={cards}
        sportSlug="soon"
        sportTitle="Upcoming Esports Games"
        pageMode="soon"
        categoryTitleBySlug={layoutData?.h1TitleBySlug ?? {}}
        vertical="esports"
      />
    </div>
  )
}
