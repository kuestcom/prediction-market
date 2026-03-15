'use cache'

import type { Metadata } from 'next'
import type { SupportedLocale } from '@/i18n/locales'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import EventMarketChannelProvider from '@/app/[locale]/(platform)/event/[slug]/_components/EventMarketChannelProvider'
import SportsEventCenter from '@/app/[locale]/(platform)/sports/_components/SportsEventCenter'
import {
  buildSportsGamesCardGroups,
  mergeSportsGamesCardMarkets,
} from '@/app/[locale]/(platform)/sports/_utils/sports-games-data'
import EventStructuredData from '@/components/seo/EventStructuredData'
import { redirect } from '@/i18n/navigation'
import { EventRepository } from '@/lib/db/queries/event'
import { SportsMenuRepository } from '@/lib/db/queries/sports-menu'
import { buildEventPageMetadata } from '@/lib/event-open-graph'
import { getEventRouteBySlug, resolveCanonicalEventSlugFromSportsPath } from '@/lib/event-page-data'
import { resolveEventBasePath, resolveEventPagePath } from '@/lib/events-routing'
import { resolveSportsEventMarketViewKey } from '@/lib/sports-event-slugs'
import { STATIC_PARAMS_PLACEHOLDER } from '@/lib/static-params'
import { loadRuntimeThemeState } from '@/lib/theme-settings'

export async function generateStaticParams() {
  return [{ sport: STATIC_PARAMS_PLACEHOLDER, event: STATIC_PARAMS_PLACEHOLDER }]
}

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
  return await buildEventPageMetadata({
    eventSlug: canonicalEventSlug,
    locale: resolvedLocale,
  })
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

  const eventRoute = await getEventRouteBySlug(canonicalEventSlug)
  if (!eventRoute) {
    notFound()
  }
  if (!resolveEventBasePath(eventRoute)) {
    redirect({
      href: resolveEventPagePath(eventRoute),
      locale: resolvedLocale,
    })
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
  const [{ data: layoutData }, runtimeTheme] = await Promise.all([
    SportsMenuRepository.getLayoutData(),
    loadRuntimeThemeState(),
  ])
  const sportLabel = layoutData?.h1TitleBySlug[resolvedSportSlug] ?? resolvedSportSlug.toUpperCase()
  return (
    <>
      <EventStructuredData
        event={targetCard.event}
        locale={resolvedLocale}
        pagePath={resolveEventPagePath(targetCard.event)}
        site={runtimeTheme.site}
      />
      <EventMarketChannelProvider markets={allMarkets}>
        <SportsEventCenter
          card={targetCard}
          marketViewCards={targetGroup.marketViewCards}
          sportSlug={resolvedSportSlug}
          sportLabel={sportLabel}
          initialMarketViewKey={resolveSportsEventMarketViewKey(canonicalEventSlug)}
          key={`is-bookmarked-${targetCard.event.is_bookmarked}`}
        />
      </EventMarketChannelProvider>
    </>
  )
}
