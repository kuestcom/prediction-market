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

async function resolveEsportsSportContext(sport: string) {
  const [{ data: canonicalSportSlug }, { data: layoutData }] = await Promise.all([
    SportsMenuRepository.resolveCanonicalSlugByAlias(sport),
    SportsMenuRepository.getLayoutData('esports'),
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
}: PageProps<'/[locale]/esports/[sport]/games'>): Promise<Metadata> {
  const { locale, sport } = await params
  setRequestLocale(locale)

  if (sport === STATIC_PARAMS_PLACEHOLDER) {
    notFound()
  }

  const [runtimeTheme, sportContext] = await Promise.all([
    loadRuntimeThemeState(),
    resolveEsportsSportContext(sport),
  ])
  if (!sportContext) {
    notFound()
  }

  const siteName = runtimeTheme.site.name

  const t = await getExtracted()

  return {
    title: t('{sportTitle} Prediction Markets & Live Odds', { sportTitle: sportContext.sportTitle }),
    description: t('Trade on live {sportTitle} esports matches in real time on {siteName}. Bet on moneyline, spread, and total markets. Watch streams while you trade.', { sportTitle: sportContext.sportTitle, siteName }),
  }
}

export default async function EsportsGamesBySportPage({
  params,
}: PageProps<'/[locale]/esports/[sport]/games'>) {
  const { locale, sport } = await params
  setRequestLocale(locale)
  if (sport === STATIC_PARAMS_PLACEHOLDER) {
    notFound()
  }

  const sportContext = await resolveEsportsSportContext(sport)
  if (!sportContext) {
    notFound()
  }
  const { canonicalSportSlug, sportTitle } = sportContext

  const commonParams = {
    tag: 'esports' as const,
    sportsVertical: 'esports' as const,
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
    <div key={`esports-games-page-${canonicalSportSlug}`} className="contents">
      <SportsGamesCenter
        cards={cards}
        sportSlug={canonicalSportSlug}
        sportTitle={sportTitle}
        vertical="esports"
      />
    </div>
  )
}
