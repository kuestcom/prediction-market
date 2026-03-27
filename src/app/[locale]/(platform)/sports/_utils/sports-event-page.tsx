import type { Metadata } from 'next'
import type { SupportedLocale } from '@/i18n/locales'
import type { SportsVertical } from '@/lib/sports-vertical'
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
import { getSportsVerticalConfig } from '@/lib/sports-vertical'
import { STATIC_PARAMS_PLACEHOLDER } from '@/lib/static-params'
import { loadRuntimeThemeState } from '@/lib/theme-settings'

export interface SportsVerticalEventPageParams {
  locale: string
  sport: string
  event: string
}

interface RenderSportsVerticalEventPageParams extends SportsVerticalEventPageParams {
  vertical: SportsVertical
}

function assertValidSportsEventPageParams({ sport, event }: Pick<SportsVerticalEventPageParams, 'sport' | 'event'>) {
  if (sport === STATIC_PARAMS_PLACEHOLDER || event === STATIC_PARAMS_PLACEHOLDER) {
    notFound()
  }
}

async function resolveCanonicalSportsEventSlug({
  sport,
  event,
}: Pick<SportsVerticalEventPageParams, 'sport' | 'event'>) {
  assertValidSportsEventPageParams({ sport, event })

  const canonicalEventSlug = await resolveCanonicalEventSlugFromSportsPath(sport, event)
  if (!canonicalEventSlug) {
    notFound()
  }

  return canonicalEventSlug
}

export async function generateSportsVerticalEventMetadata({
  locale,
  sport,
  event,
}: SportsVerticalEventPageParams): Promise<Metadata> {
  setRequestLocale(locale)

  return await buildEventPageMetadata({
    eventSlug: await resolveCanonicalSportsEventSlug({ sport, event }),
    locale: locale as SupportedLocale,
  })
}

export async function renderSportsVerticalEventPage({
  locale,
  sport,
  event,
  vertical,
}: RenderSportsVerticalEventPageParams) {
  setRequestLocale(locale)

  const resolvedLocale = locale as SupportedLocale
  const canonicalEventSlug = await resolveCanonicalSportsEventSlug({ sport, event })
  const eventRoute = await getEventRouteBySlug(canonicalEventSlug)
  if (!eventRoute) {
    notFound()
  }

  const verticalConfig = getSportsVerticalConfig(vertical)
  const expectedPath = resolveEventPagePath(eventRoute)
  if (!resolveEventBasePath(eventRoute) || expectedPath !== `${verticalConfig.basePath}/${sport}/${event}`) {
    redirect({
      href: expectedPath,
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
    SportsMenuRepository.getLayoutData(vertical),
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
          vertical={vertical}
          key={`is-bookmarked-${targetCard.event.is_bookmarked}`}
        />
      </EventMarketChannelProvider>
    </>
  )
}
