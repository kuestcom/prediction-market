'use cache'

import type { Metadata } from 'next'
import type { SupportedLocale } from '@/i18n/locales'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { buildSportsGamesCards } from '@/app/[locale]/(platform)/sports/_components/sports-games-data'
import { mergeUniqueEventsById } from '@/app/[locale]/(platform)/sports/_components/sports-games-utils'
import SportsGamesCenter from '@/app/[locale]/(platform)/sports/_components/SportsGamesCenter'
import { EventRepository } from '@/lib/db/queries/event'
import { SportsMenuRepository } from '@/lib/db/queries/sports-menu'
import { STATIC_PARAMS_PLACEHOLDER } from '@/lib/static-params'

export const metadata: Metadata = {
  title: 'Sports Games',
}

export async function generateStaticParams() {
  return [{ sport: STATIC_PARAMS_PLACEHOLDER }]
}

export default async function SportsGamesBySportPage({
  params,
}: {
  params: Promise<{ locale: string, sport: string }>
}) {
  const { locale, sport } = await params
  setRequestLocale(locale)
  if (sport === STATIC_PARAMS_PLACEHOLDER) {
    notFound()
  }

  const [{ data: canonicalSportSlug }, { data: layoutData }] = await Promise.all([
    SportsMenuRepository.resolveCanonicalSlugByAlias(sport),
    SportsMenuRepository.getLayoutData(),
  ])
  if (!canonicalSportSlug) {
    notFound()
  }

  const commonParams = {
    tag: 'sports' as const,
    search: '',
    userId: '',
    bookmarked: false,
    locale: locale as SupportedLocale,
    sportsSportSlug: canonicalSportSlug,
    sportsSection: 'games' as const,
  }

  const [activeResult, resolvedResult] = await Promise.all([
    EventRepository.listEvents({
      ...commonParams,
      status: 'active',
    }),
    EventRepository.listEvents({
      ...commonParams,
      status: 'resolved',
    }),
  ])

  const mergedEvents = mergeUniqueEventsById(activeResult.data ?? [], resolvedResult.data ?? [])
  const cards = buildSportsGamesCards(mergedEvents)
  const sportTitle = layoutData?.h1TitleBySlug[canonicalSportSlug] ?? canonicalSportSlug.toUpperCase()

  return (
    <SportsGamesCenter
      cards={cards}
      sportSlug={canonicalSportSlug}
      sportTitle={sportTitle}
    />
  )
}
