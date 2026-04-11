'use cache'

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
  generateSportsVerticalEventMarketMetadata,
  generateSportsVerticalEventMetadata,
  renderSportsVerticalEventMarketPage,
  renderSportsVerticalEventPage,
} from '@/app/[locale]/(platform)/sports/_utils/sports-event-page'
import { resolveCanonicalEventSlugFromSportsPath } from '@/lib/event-page-data'
import { STATIC_PARAMS_PLACEHOLDER } from '@/lib/static-params'

export async function generateStaticParams() {
  return [{ sport: STATIC_PARAMS_PLACEHOLDER, slugParts: [STATIC_PARAMS_PLACEHOLDER] }]
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

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/esports/[sport]/[...slugParts]'>): Promise<Metadata> {
  const { locale, sport, slugParts } = await params

  if (sport === STATIC_PARAMS_PLACEHOLDER || slugParts.includes(STATIC_PARAMS_PLACEHOLDER)) {
    notFound()
  }

  if (slugParts.length === 1) {
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

  if (sport === STATIC_PARAMS_PLACEHOLDER || slugParts.includes(STATIC_PARAMS_PLACEHOLDER)) {
    notFound()
  }

  if (slugParts.length === 1) {
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
