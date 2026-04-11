'use cache'

import type { Metadata } from 'next'
import type { SupportedLocale } from '@/i18n/locales'
import { getExtracted, setRequestLocale } from 'next-intl/server'
import SportsGamesCenter from '@/app/[locale]/(platform)/sports/_components/SportsGamesCenter'
import { buildSportsGamesCards } from '@/app/[locale]/(platform)/sports/_utils/sports-games-data'
import { EventRepository } from '@/lib/db/queries/event'
import { SportsMenuRepository } from '@/lib/db/queries/sports-menu'
import { loadRuntimeThemeState } from '@/lib/theme-settings'

export async function generateMetadata({ params }: PageProps<'/[locale]/sports/live'>): Promise<Metadata> {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getExtracted()

  const runtimeTheme = await loadRuntimeThemeState()
  const siteName = runtimeTheme.site.name

  return {
    title: t('Sports Live Prediction Markets & Live Odds'),
    description: t(`Trade on live sports in real time on {siteName}. Trade on NBA, NHL, UFC, MLB, soccer, and 20+ sports with moneyline, spread, and total markets. Real-time odds and scores.`, { siteName }),
  }
}

export default async function SportsLivePage({ params }: PageProps<'/[locale]/sports/live'>) {
  const { locale } = await params
  setRequestLocale(locale)
  const [{ data: events }, { data: layoutData }] = await Promise.all([
    EventRepository.listEvents({
      tag: 'sports',
      sportsVertical: 'sports',
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
        sportTitle="Live"
        pageMode="liveAndSoon"
        categoryTitleBySlug={layoutData?.h1TitleBySlug ?? {}}
        vertical="sports"
      />
    </div>
  )
}
