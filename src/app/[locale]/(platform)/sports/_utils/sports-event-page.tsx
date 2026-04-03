import type { Metadata } from 'next'
import type { SupportedLocale } from '@/i18n/locales'
import type { SportsVertical } from '@/lib/sports-vertical'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import EventMarketChannelProvider from '@/app/[locale]/(platform)/event/[slug]/_components/EventMarketChannelProvider'
import SportsEventCenter from '@/app/[locale]/(platform)/sports/_components/SportsEventCenter'
import {
  buildSportsGamesCardGroups,
  buildSportsGamesCards,
  mergeSportsGamesCardMarkets,
} from '@/app/[locale]/(platform)/sports/_utils/sports-games-data'
import EventStructuredData from '@/components/seo/EventStructuredData'
import { redirect } from '@/i18n/navigation'
import { loadMarketContextSettings } from '@/lib/ai/market-context-config'
import { EventRepository } from '@/lib/db/queries/event'
import { SportsMenuRepository } from '@/lib/db/queries/sports-menu'
import { buildEventPageMetadata } from '@/lib/event-open-graph'
import { getEventRouteBySlug, resolveCanonicalEventSlugFromSportsPath } from '@/lib/event-page-data'
import { resolveEventBasePath, resolveEventMarketPath, resolveEventPagePath } from '@/lib/events-routing'
import { resolveSportsEventMarketViewKey } from '@/lib/sports-event-slugs'
import { getSportsVerticalConfig } from '@/lib/sports-vertical'
import { STATIC_PARAMS_PLACEHOLDER } from '@/lib/static-params'
import { loadRuntimeThemeState } from '@/lib/theme-settings'

export interface SportsVerticalEventPageParams {
  locale: string
  sport: string
  league?: string
  event: string
}

export interface SportsVerticalEventMarketPageParams extends SportsVerticalEventPageParams {
  market: string
}

interface RenderSportsVerticalEventPageParams extends SportsVerticalEventPageParams {
  vertical: SportsVertical
}

interface RenderSportsVerticalEventMarketPageParams extends SportsVerticalEventMarketPageParams {
  vertical: SportsVertical
}

function assertValidSportsEventPageParams({
  sport,
  league,
  event,
}: Pick<SportsVerticalEventPageParams, 'sport' | 'league' | 'event'>) {
  if (
    sport === STATIC_PARAMS_PLACEHOLDER
    || league === STATIC_PARAMS_PLACEHOLDER
    || event === STATIC_PARAMS_PLACEHOLDER
  ) {
    notFound()
  }
}

async function resolveCanonicalSportsEventSlug({
  sport,
  league,
  event,
}: Pick<SportsVerticalEventPageParams, 'sport' | 'league' | 'event'>) {
  assertValidSportsEventPageParams({ sport, league, event })

  const canonicalEventSlug = await resolveCanonicalEventSlugFromSportsPath(sport, event, league)
  if (!canonicalEventSlug) {
    notFound()
  }

  return canonicalEventSlug
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

export async function generateSportsVerticalEventMetadata({
  locale,
  sport,
  league,
  event,
}: SportsVerticalEventPageParams): Promise<Metadata> {
  setRequestLocale(locale)

  return await buildEventPageMetadata({
    eventSlug: await resolveCanonicalSportsEventSlug({ sport, league, event }),
    locale: locale as SupportedLocale,
  })
}

export async function renderSportsVerticalEventPage({
  locale,
  sport,
  league,
  event,
  vertical,
}: RenderSportsVerticalEventPageParams) {
  setRequestLocale(locale)

  const resolvedLocale = locale as SupportedLocale
  const canonicalEventSlug = await resolveCanonicalSportsEventSlug({ sport, league, event })
  const eventRoute = await getEventRouteBySlug(canonicalEventSlug)
  if (!eventRoute) {
    notFound()
  }

  const verticalConfig = getSportsVerticalConfig(vertical)
  const expectedPath = resolveEventPagePath(eventRoute)
  const currentPath = league?.trim()
    ? `${verticalConfig.basePath}/${sport}/${league}/${event}`
    : `${verticalConfig.basePath}/${sport}/${event}`
  if (!resolveEventBasePath(eventRoute) || expectedPath !== currentPath) {
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
  const [{ data: layoutData }, runtimeTheme, marketContextSettings] = await Promise.all([
    SportsMenuRepository.getLayoutData(vertical),
    loadRuntimeThemeState(),
    loadMarketContextSettings(),
  ])
  const sportLabel = layoutData?.h1TitleBySlug[resolvedSportSlug] ?? resolvedSportSlug.toUpperCase()
  const marketContextEnabled = marketContextSettings.enabled && Boolean(marketContextSettings.apiKey)

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
          marketContextEnabled={marketContextEnabled}
          vertical={vertical}
          key={`is-bookmarked-${targetCard.event.is_bookmarked}`}
        />
      </EventMarketChannelProvider>
    </>
  )
}

export async function generateSportsVerticalEventMarketMetadata({
  locale,
  sport,
  league,
  event,
  market,
}: SportsVerticalEventMarketPageParams): Promise<Metadata> {
  setRequestLocale(locale)

  return await buildEventPageMetadata({
    eventSlug: await resolveCanonicalSportsEventSlug({ sport, league, event }),
    locale: locale as SupportedLocale,
    marketSlug: market,
  })
}

export async function renderSportsVerticalEventMarketPage({
  locale,
  sport,
  league,
  event,
  market,
  vertical,
}: RenderSportsVerticalEventMarketPageParams) {
  setRequestLocale(locale)

  const resolvedLocale = locale as SupportedLocale
  const canonicalEventSlug = await resolveCanonicalSportsEventSlug({ sport, league, event })
  const eventRoute = await getEventRouteBySlug(canonicalEventSlug)
  if (!eventRoute) {
    notFound()
  }

  const verticalConfig = getSportsVerticalConfig(vertical)
  const expectedPath = resolveEventMarketPath(eventRoute, market)
  const currentPath = league?.trim()
    ? `${verticalConfig.basePath}/${sport}/${league}/${event}/${market}`
    : `${verticalConfig.basePath}/${sport}/${event}/${market}`
  if (!resolveEventBasePath(eventRoute) || expectedPath !== currentPath) {
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
  const [{ data: layoutData }, { data: relatedEventsResult }, runtimeTheme, marketContextSettings] = await Promise.all([
    SportsMenuRepository.getLayoutData(vertical),
    EventRepository.listEvents({
      tag: vertical,
      sportsVertical: vertical,
      search: '',
      userId: '',
      bookmarked: false,
      status: 'active',
      locale: resolvedLocale,
      sportsSportSlug: resolvedSportSlug,
      sportsSection: 'games',
    }),
    loadRuntimeThemeState(),
    loadMarketContextSettings(),
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
  const marketContextEnabled = marketContextSettings.enabled && Boolean(marketContextSettings.apiKey)
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
          marketContextEnabled={marketContextEnabled}
          vertical={vertical}
          key={`is-bookmarked-${targetCard.event.is_bookmarked}`}
        />
      </EventMarketChannelProvider>
    </>
  )
}
