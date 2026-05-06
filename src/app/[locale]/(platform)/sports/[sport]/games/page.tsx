'use cache'

import type { Metadata } from 'next'
import type { SupportedLocale } from '@/i18n/locales'
import { getExtracted, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import SportsGamesCenter from '@/app/[locale]/(platform)/sports/_components/SportsGamesCenter'
import { buildSportsGamesCards } from '@/app/[locale]/(platform)/sports/_utils/sports-games-data'
import { findSportsHrefBySlug } from '@/app/[locale]/(platform)/sports/_utils/sports-menu-routing'
import { EventRepository } from '@/lib/db/queries/event'
import { SportsMenuRepository } from '@/lib/db/queries/sports-menu'
import { STATIC_PARAMS_PLACEHOLDER } from '@/lib/static-params'
import { loadRuntimeThemeState } from '@/lib/theme-settings'

export async function generateStaticParams() {
  return [{ sport: STATIC_PARAMS_PLACEHOLDER }]
}

async function resolveSportsSportContext(sport: string) {
  const [{ data: canonicalSportSlug }, { data: layoutData }] = await Promise.all([
    SportsMenuRepository.resolveCanonicalSlugByAlias(sport),
    SportsMenuRepository.getLayoutData('sports'),
  ])

  if (
    !canonicalSportSlug
    || !findSportsHrefBySlug({
      menuEntries: layoutData?.menuEntries,
      canonicalSportSlug,
    })
  ) {
    return null
  }

  return {
    canonicalSportSlug,
    sportTitle: layoutData?.h1TitleBySlug[canonicalSportSlug] ?? canonicalSportSlug.toUpperCase(),
  }
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/sports/[sport]/games'>): Promise<Metadata> {
  const { locale, sport } = await params
  setRequestLocale(locale)

  if (sport === STATIC_PARAMS_PLACEHOLDER) {
    notFound()
  }

  const [runtimeTheme, sportContext] = await Promise.all([
    loadRuntimeThemeState(),
    resolveSportsSportContext(sport),
  ])
  if (!sportContext) {
    notFound()
  }

  const siteName = runtimeTheme.site.name
  const t = await getExtracted()

  return {
    title: t('{sportTitle} Prediction Markets & Live Odds', { sportTitle: sportContext.sportTitle }),
    description: t('Trade on live {sportTitle} matches in real time on {siteName}. Bet on moneyline, spread, and total markets. Real-time odds and scores.', { sportTitle: sportContext.sportTitle, siteName }),
  }
}

export default async function SportsGamesBySportPage({
  params,
}: PageProps<'/[locale]/sports/[sport]/games'>) {
  const { locale, sport } = await params
  setRequestLocale(locale)
  if (sport === STATIC_PARAMS_PLACEHOLDER) {
    notFound()
  }

  const sportContext = await resolveSportsSportContext(sport)
  if (!sportContext) {
    notFound()
  }
  const { canonicalSportSlug, sportTitle } = sportContext

  const commonParams = {
    tag: 'sports' as const,
    sportsVertical: 'sports' as const,
    search: '',
    userId: '',
    bookmarked: false,
    locale: locale as SupportedLocale,
    sportsSportSlug: canonicalSportSlug,
    sportsSection: 'games' as const,
  }

  const { data: activeEvents } = await EventRepository.listEvents({
    ...commonParams,
    status: 'active',
  })

  const cards = buildSportsGamesCards(activeEvents ?? [])

  return (
    <div key={`sports-games-page-${canonicalSportSlug}`} className="contents">
      <SportsGamesCenter
        cards={cards}
        sportSlug={canonicalSportSlug}
        sportTitle={sportTitle}
        vertical="sports"
      />
    </div>
  )
}
