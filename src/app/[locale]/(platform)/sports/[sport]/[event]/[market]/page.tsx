'use cache'

import type { Metadata } from 'next'
import type { SupportedLocale } from '@/i18n/locales'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import EventMarketChannelProvider from '@/app/[locale]/(platform)/event/[slug]/_components/EventMarketChannelProvider'
import {
  buildSportsGamesCardGroups,
  buildSportsGamesCards,
  mergeSportsGamesCardMarkets,
} from '@/app/[locale]/(platform)/sports/_components/sports-games-data'
import SportsEventCenter from '@/app/[locale]/(platform)/sports/_components/SportsEventCenter'
import EventStructuredData from '@/components/seo/EventStructuredData'
import { EventRepository } from '@/lib/db/queries/event'
import { SportsMenuRepository } from '@/lib/db/queries/sports-menu'
import { buildEventPageMetadata } from '@/lib/event-open-graph'
import { resolveCanonicalEventSlugFromSportsPath } from '@/lib/event-page-data'
import { resolveEventMarketPath } from '@/lib/events-routing'
import { resolveSportsEventMarketViewKey } from '@/lib/sports-event-slugs'
import { STATIC_PARAMS_PLACEHOLDER } from '@/lib/static-params'
import { loadRuntimeThemeState } from '@/lib/theme-settings'

export async function generateStaticParams() {
  return [{ market: STATIC_PARAMS_PLACEHOLDER }]
}

function isSameSportsGame(
  left: ReturnType<typeof buildSportsGamesCards>[number],
  right: ReturnType<typeof buildSportsGamesCards>[number],
) {
  const leftSportsEventSlug = left.event.sports_event_slug?.trim().toLowerCase() ?? null
  const rightSportsEventSlug = right.event.sports_event_slug?.trim().toLowerCase() ?? null

  if (leftSportsEventSlug && rightSportsEventSlug) {
    return leftSportsEventSlug === rightSportsEventSlug
  }

  return left.id === right.id || left.event.id === right.event.id || left.event.slug === right.event.slug
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string, sport: string, event: string, market: string }>
}): Promise<Metadata> {
  const { locale, sport, event, market } = await params
  setRequestLocale(locale)
  const resolvedLocale = locale as SupportedLocale
  if (
    sport === STATIC_PARAMS_PLACEHOLDER
    || event === STATIC_PARAMS_PLACEHOLDER
    || market === STATIC_PARAMS_PLACEHOLDER
  ) {
    notFound()
  }
  const canonicalEventSlug = await resolveCanonicalEventSlugFromSportsPath(sport, event)
  if (!canonicalEventSlug) {
    notFound()
  }
  return await buildEventPageMetadata({
    eventSlug: canonicalEventSlug,
    locale: resolvedLocale,
    marketSlug: market,
  })
}

export default async function SportsEventMarketPage({
  params,
}: {
  params: Promise<{ locale: string, sport: string, event: string, market: string }>
}) {
  const { locale, sport, event, market } = await params
  setRequestLocale(locale)
  const resolvedLocale = locale as SupportedLocale
  if (
    sport === STATIC_PARAMS_PLACEHOLDER
    || event === STATIC_PARAMS_PLACEHOLDER
    || market === STATIC_PARAMS_PLACEHOLDER
  ) {
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
  const cardGroups = buildSportsGamesCardGroups(groupedEvents ?? [])
  const targetGroup = cardGroups[0] ?? null
  const targetCard = targetGroup?.primaryCard ?? null
  if (!targetGroup || !targetCard) {
    notFound()
  }
  const allMarkets = mergeSportsGamesCardMarkets(targetGroup.marketViewCards.map(view => view.card))

  const resolvedSportSlug = canonicalSportSlug
    || targetCard.event.sports_sport_slug
    || sport
  const [{ data: layoutData }, { data: relatedEventsResult }, runtimeTheme] = await Promise.all([
    SportsMenuRepository.getLayoutData(),
    EventRepository.listEvents({
      tag: 'sports',
      search: '',
      userId: '',
      bookmarked: false,
      status: 'active',
      locale: resolvedLocale,
      sportsSportSlug: resolvedSportSlug,
      sportsSection: 'games',
    }),
    loadRuntimeThemeState(),
  ])

  const relatedCards = buildSportsGamesCards(relatedEventsResult ?? [])
    .filter(relatedCard => !isSameSportsGame(relatedCard, targetCard))
    .filter(relatedCard => relatedCard.event.sports_ended !== true)
    .filter(relatedCard => relatedCard.event.status === 'active')
    .filter((relatedCard) => {
      const relatedSportSlug = relatedCard.event.sports_sport_slug?.trim().toLowerCase()
      return !relatedSportSlug || relatedSportSlug === resolvedSportSlug.toLowerCase()
    })
    .slice(0, 3)

  const sportLabel = layoutData?.h1TitleBySlug[resolvedSportSlug] ?? resolvedSportSlug.toUpperCase()
  return (
    <>
      <EventStructuredData
        event={targetCard.event}
        locale={resolvedLocale}
        pagePath={resolveEventMarketPath(targetCard.event, market)}
        marketSlug={market}
        site={runtimeTheme.site}
      />
      <EventMarketChannelProvider markets={allMarkets}>
        <SportsEventCenter
          card={targetCard}
          marketViewCards={targetGroup.marketViewCards}
          relatedCards={relatedCards}
          sportSlug={resolvedSportSlug}
          sportLabel={sportLabel}
          initialMarketSlug={market}
          initialMarketViewKey={resolveSportsEventMarketViewKey(canonicalEventSlug)}
          key={`is-bookmarked-${targetCard.event.is_bookmarked}`}
        />
      </EventMarketChannelProvider>
    </>
  )
}
