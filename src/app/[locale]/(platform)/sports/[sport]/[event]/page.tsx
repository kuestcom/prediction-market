import type { Metadata } from 'next'
import type { SupportedLocale } from '@/i18n/locales'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { buildSportsGamesCards } from '@/app/[locale]/(platform)/sports/_components/sports-games-data'
import SportsEventCenter from '@/app/[locale]/(platform)/sports/_components/SportsEventCenter'
import { EventRepository } from '@/lib/db/queries/event'
import { SportsMenuRepository } from '@/lib/db/queries/sports-menu'
import {
  getEventTitleBySlug,
  resolveCanonicalEventSlugFromSportsPath,
} from '@/lib/event-page-data'
import { STATIC_PARAMS_PLACEHOLDER } from '@/lib/static-params'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string, sport: string, event: string }>
}): Promise<Metadata> {
  const { locale, sport, event } = await params
  setRequestLocale(locale)
  const resolvedLocale = locale as SupportedLocale
  if (sport === STATIC_PARAMS_PLACEHOLDER || event === STATIC_PARAMS_PLACEHOLDER) {
    notFound()
  }
  const canonicalEventSlug = await resolveCanonicalEventSlugFromSportsPath(sport, event)
  if (!canonicalEventSlug) {
    notFound()
  }

  const title = await getEventTitleBySlug(canonicalEventSlug, resolvedLocale)

  return {
    title,
  }
}

export default async function SportsEventPage({
  params,
}: {
  params: Promise<{ locale: string, sport: string, event: string }>
}) {
  const { locale, sport, event } = await params
  setRequestLocale(locale)
  const resolvedLocale = locale as SupportedLocale
  if (sport === STATIC_PARAMS_PLACEHOLDER || event === STATIC_PARAMS_PLACEHOLDER) {
    notFound()
  }
  const canonicalEventSlug = await resolveCanonicalEventSlugFromSportsPath(sport, event)
  if (!canonicalEventSlug) {
    notFound()
  }

  const [{ data: groupedEvents }, { data: canonicalSportSlug }] = await Promise.all([
    EventRepository.getSportsEventGroupBySlug(canonicalEventSlug, '', resolvedLocale),
    SportsMenuRepository.resolveCanonicalSlugByAlias(sport),
  ])
  const cards = buildSportsGamesCards(groupedEvents ?? [])
  const targetCard = cards[0] ?? null
  if (!targetCard) {
    notFound()
  }

  const resolvedSportSlug = canonicalSportSlug
    || targetCard.event.sports_sport_slug
    || sport
  const { data: layoutData } = await SportsMenuRepository.getLayoutData()
  const sportLabel = layoutData?.h1TitleBySlug[resolvedSportSlug] ?? resolvedSportSlug.toUpperCase()

  return (
    <SportsEventCenter
      card={targetCard}
      sportSlug={resolvedSportSlug}
      sportLabel={sportLabel}
    />
  )
}
