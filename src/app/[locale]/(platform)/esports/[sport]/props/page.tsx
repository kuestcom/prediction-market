'use cache'

import type { Metadata } from 'next'
import { getExtracted, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import SportsContent from '@/app/[locale]/(platform)/sports/_components/SportsContent'
import { findSportsHrefBySlug } from '@/app/[locale]/(platform)/sports/_utils/sports-menu-routing'
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
}: PageProps<'/[locale]/esports/[sport]/props'>): Promise<Metadata> {
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
    title: t('{sportTitle} Props Prediction Markets & Live Odds', { sportTitle: sportContext.sportTitle }),
    description: t('Trade on live {sportTitle} esports player props in real time on {siteName}. Bet on kills, assists, maps, rounds, and more specialty markets while you watch.', { sportTitle: sportContext.sportTitle, siteName }),
  }
}

export default async function EsportsPropsBySportPage({
  params,
}: PageProps<'/[locale]/esports/[sport]/props'>) {
  const { locale, sport } = await params
  setRequestLocale(locale)
  if (sport === STATIC_PARAMS_PLACEHOLDER) {
    notFound()
  }

  const sportContext = await resolveEsportsSportContext(sport)
  if (!sportContext) {
    notFound()
  }
  const { canonicalSportSlug } = sportContext

  return (
    <div className="grid gap-4">
      <SportsContent
        locale={locale}
        initialTag="esports"
        mainTag="esports"
        initialMode="all"
        sportsSportSlug={canonicalSportSlug}
        sportsSection="props"
      />
    </div>
  )
}
