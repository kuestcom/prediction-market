'use cache'

import type { Metadata } from 'next'
import type { SupportedLocale } from '@/i18n/locales'
import type { SportsMenuEntry, SportsMenuLinkEntry } from '@/lib/sports-menu-types'
import type { Event } from '@/types'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import SportsGamesCenter from '@/app/[locale]/(platform)/sports/_components/SportsGamesCenter'
import {
  generateSportsVerticalEventMarketMetadata,
  generateSportsVerticalEventMetadata,
  renderSportsVerticalEventMarketPage,
  renderSportsVerticalEventPage,
} from '@/app/[locale]/(platform)/sports/_utils/sports-event-page'
import { buildSportsGamesCards } from '@/app/[locale]/(platform)/sports/_utils/sports-games-data'
import { EventRepository } from '@/lib/db/queries/event'
import { SportsMenuRepository } from '@/lib/db/queries/sports-menu'
import { resolveCanonicalEventSlugFromSportsPath } from '@/lib/event-page-data'
import { normalizeComparableValue, slugifyText } from '@/lib/slug'
import { getPublicShellStaticParams, shouldBypassPublicShellPlaceholder, STATIC_PARAMS_PLACEHOLDER } from '@/lib/static-params'
import { loadRuntimeThemeState } from '@/lib/theme-settings'

export async function generateStaticParams() {
  return getPublicShellStaticParams({ sport: STATIC_PARAMS_PLACEHOLDER, slugParts: [STATIC_PARAMS_PLACEHOLDER] })
}

async function resolveLeagueEventPath(
  sport: string,
  slugParts: string[],
) {
  if (slugParts.length !== 2) {
    return null
  }

  const [league, event] = slugParts
  if (!league || !event) {
    return null
  }

  const canonicalEventSlug = await resolveCanonicalEventSlugFromSportsPath(sport, event, league)
  if (!canonicalEventSlug) {
    return null
  }

  return { league, event }
}

function getLastHrefSegment(href: string) {
  return href.split('?')[0]?.split('/').filter(Boolean).at(-1) ?? ''
}

function addNormalizedCandidate(candidates: Set<string>, value: string | null | undefined) {
  const normalized = normalizeComparableValue(value)
  if (normalized) {
    candidates.add(normalized)
  }

  const slugified = value?.trim() ? slugifyText(value) : ''
  if (slugified) {
    candidates.add(slugified)
  }
}

function findEsportsSubcategoryLink(params: {
  menuEntries: SportsMenuEntry[] | undefined
  canonicalSportSlug: string
  subcategorySlug: string
}) {
  const { menuEntries, canonicalSportSlug, subcategorySlug } = params
  const normalizedSubcategorySlug = normalizeComparableValue(subcategorySlug)
  if (!menuEntries || normalizedSubcategorySlug === 'games' || normalizedSubcategorySlug === 'props') {
    return null
  }

  for (const entry of menuEntries) {
    if (entry.type !== 'group' || entry.menuSlug !== canonicalSportSlug) {
      continue
    }

    const link = entry.links.find(child =>
      normalizeComparableValue(getLastHrefSegment(child.href)) === normalizedSubcategorySlug
      || normalizeComparableValue(child.menuSlug) === normalizedSubcategorySlug,
    )

    if (link) {
      return link
    }
  }

  return null
}

function buildSubcategoryMatchCandidates(link: SportsMenuLinkEntry, subcategorySlug: string) {
  const candidates = new Set<string>()

  addNormalizedCandidate(candidates, subcategorySlug)
  addNormalizedCandidate(candidates, link.label)
  addNormalizedCandidate(candidates, link.menuSlug)
  addNormalizedCandidate(candidates, getLastHrefSegment(link.href))

  return candidates
}

function doesEventMatchSubcategory(event: Event, candidates: Set<string>) {
  const eventValues = [
    event.sports_series_slug,
    event.sports_league_slug,
    event.series_slug,
    ...(event.sports_tags ?? []),
  ]

  return eventValues.some((value) => {
    const normalized = normalizeComparableValue(value)
    if (normalized && candidates.has(normalized)) {
      return true
    }

    const slugified = value?.trim() ? slugifyText(value) : ''
    return Boolean(slugified && candidates.has(slugified))
  })
}

async function resolveEsportsSubcategoryContext(sport: string, subcategorySlug: string) {
  const [{ data: canonicalSportSlug }, { data: layoutData }] = await Promise.all([
    SportsMenuRepository.resolveCanonicalSlugByAlias(sport),
    SportsMenuRepository.getLayoutData('esports'),
  ])

  if (!canonicalSportSlug) {
    return null
  }

  const subcategoryLink = findEsportsSubcategoryLink({
    menuEntries: layoutData?.menuEntries,
    canonicalSportSlug,
    subcategorySlug,
  })

  if (!subcategoryLink) {
    return null
  }

  return {
    canonicalSportSlug,
    sportTitle: layoutData?.h1TitleBySlug[canonicalSportSlug] ?? canonicalSportSlug.toUpperCase(),
    subcategoryLabel: subcategoryLink.label,
    subcategorySlug,
    matchCandidates: buildSubcategoryMatchCandidates(subcategoryLink, subcategorySlug),
  }
}

async function generateEsportsSubcategoryMetadata(
  context: Awaited<ReturnType<typeof resolveEsportsSubcategoryContext>>,
) {
  if (!context) {
    notFound()
  }

  const runtimeTheme = await loadRuntimeThemeState()
  const siteName = runtimeTheme.site.name
  const seriesTitle = `${context.sportTitle} ${context.subcategoryLabel}`

  return {
    title: `${seriesTitle} Prediction Markets & Live Odds`,
    description: `Trade on live ${seriesTitle} esports matches in real time on ${siteName}. Bet on moneyline, spread, and total markets while you watch.`,
  }
}

async function renderEsportsSubcategoryGamesPage(params: {
  context: NonNullable<Awaited<ReturnType<typeof resolveEsportsSubcategoryContext>>>
  locale: string
}) {
  const { context, locale } = params
  const { data: activeEvents } = await EventRepository.listEvents({
    tag: 'esports',
    sportsVertical: 'esports',
    search: '',
    userId: '',
    bookmarked: false,
    locale: locale as SupportedLocale,
    sportsSportSlug: context.canonicalSportSlug,
    sportsSection: 'games',
    status: 'active',
  })
  const subcategoryEvents = (activeEvents ?? []).filter(event =>
    doesEventMatchSubcategory(event, context.matchCandidates),
  )
  const cards = buildSportsGamesCards(subcategoryEvents)
  const sportTitle = `${context.sportTitle} ${context.subcategoryLabel}`

  return (
    <div key={`esports-subcategory-page-${context.canonicalSportSlug}-${context.subcategorySlug}`} className="contents">
      <SportsGamesCenter
        cards={cards}
        sportSlug={context.canonicalSportSlug}
        sportTitle={sportTitle}
        vertical="esports"
      />
    </div>
  )
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/esports/[sport]/[...slugParts]'>): Promise<Metadata> {
  const { locale, sport, slugParts } = await params
  setRequestLocale(locale)

  if (sport === STATIC_PARAMS_PLACEHOLDER || slugParts.includes(STATIC_PARAMS_PLACEHOLDER)) {
    if (shouldBypassPublicShellPlaceholder(sport, slugParts)) {
      return {}
    }
    notFound()
  }

  if (slugParts.length === 1) {
    const subcategoryContext = await resolveEsportsSubcategoryContext(sport, slugParts[0]!)
    if (subcategoryContext) {
      return await generateEsportsSubcategoryMetadata(subcategoryContext)
    }

    return await generateSportsVerticalEventMetadata({
      locale,
      sport,
      event: slugParts[0]!,
    })
  }

  if (slugParts.length === 2) {
    const leagueEventPath = await resolveLeagueEventPath(sport, slugParts)
    if (leagueEventPath) {
      return await generateSportsVerticalEventMetadata({
        locale,
        sport,
        league: leagueEventPath.league,
        event: leagueEventPath.event,
      })
    }

    return await generateSportsVerticalEventMarketMetadata({
      locale,
      sport,
      event: slugParts[0]!,
      market: slugParts[1]!,
    })
  }

  if (slugParts.length === 3) {
    return await generateSportsVerticalEventMarketMetadata({
      locale,
      sport,
      league: slugParts[0]!,
      event: slugParts[1]!,
      market: slugParts[2]!,
    })
  }

  notFound()
}

export default async function EsportsSlugPartsPage({
  params,
}: PageProps<'/[locale]/esports/[sport]/[...slugParts]'>) {
  const { locale, sport, slugParts } = await params
  setRequestLocale(locale)

  if (sport === STATIC_PARAMS_PLACEHOLDER || slugParts.includes(STATIC_PARAMS_PLACEHOLDER)) {
    if (shouldBypassPublicShellPlaceholder(sport, slugParts)) {
      return null
    }
    notFound()
  }

  if (slugParts.length === 1) {
    const subcategoryContext = await resolveEsportsSubcategoryContext(sport, slugParts[0]!)
    if (subcategoryContext) {
      return await renderEsportsSubcategoryGamesPage({
        context: subcategoryContext,
        locale,
      })
    }

    return await renderSportsVerticalEventPage({
      locale,
      sport,
      event: slugParts[0]!,
      vertical: 'esports',
    })
  }

  if (slugParts.length === 2) {
    const leagueEventPath = await resolveLeagueEventPath(sport, slugParts)
    if (leagueEventPath) {
      return await renderSportsVerticalEventPage({
        locale,
        sport,
        league: leagueEventPath.league,
        event: leagueEventPath.event,
        vertical: 'esports',
      })
    }

    return await renderSportsVerticalEventMarketPage({
      locale,
      sport,
      event: slugParts[0]!,
      market: slugParts[1]!,
      vertical: 'esports',
    })
  }

  if (slugParts.length === 3) {
    return await renderSportsVerticalEventMarketPage({
      locale,
      sport,
      league: slugParts[0]!,
      event: slugParts[1]!,
      market: slugParts[2]!,
      vertical: 'esports',
    })
  }

  notFound()
}
