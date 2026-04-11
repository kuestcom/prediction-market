'use cache'

import type { Metadata } from 'next'
import type { SupportedLocale } from '@/i18n/locales'
import { getExtracted, setRequestLocale } from 'next-intl/server'
import SportsGamesCenter from '@/app/[locale]/(platform)/sports/_components/SportsGamesCenter'
import { buildSportsGamesCards } from '@/app/[locale]/(platform)/sports/_utils/sports-games-data'
import { EventRepository } from '@/lib/db/queries/event'
import { SportsMenuRepository } from '@/lib/db/queries/sports-menu'
import { loadRuntimeThemeState } from '@/lib/theme-settings'

export async function generateMetadata({ params }: PageProps<'/[locale]/esports/live'>): Promise<Metadata> {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getExtracted()

  const runtimeTheme = await loadRuntimeThemeState()
  const siteName = runtimeTheme.site.name

  return {
    title: t('Esports Prediction Markets & Live Odds'),
    description: t(`Trade on live esports matches in real time on {siteName}. Trade on CS2, Dota 2, LoL, Valorant, and more with moneyline, spread, and total markets.`, { siteName }),
  }
}

export default async function EsportsLivePage({ params }: PageProps<'/[locale]/esports/live'>) {
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
    }),
    SportsMenuRepository.getLayoutData('esports'),
  ])
  const cards = buildSportsGamesCards(events ?? [])

  return (
    <div key="esports-live-page" className="contents">
      <SportsGamesCenter
        cards={cards}
        sportSlug="live"
        sportTitle="Live"
        pageMode="liveAndSoon"
        categoryTitleBySlug={layoutData?.h1TitleBySlug ?? {}}
        vertical="esports"
      />
    </div>
  )
}
