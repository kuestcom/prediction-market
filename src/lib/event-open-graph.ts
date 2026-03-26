import type { Metadata } from 'next'
import type { SupportedLocale } from '@/i18n/locales'
import type { Event } from '@/types'
import { notFound } from 'next/navigation'
import { DEFAULT_LOCALE } from '@/i18n/locales'
import { OUTCOME_INDEX } from '@/lib/constants'
import { loadEventPageShellData } from '@/lib/event-page-data'
import { resolveEventMarketPath, resolveEventPagePath } from '@/lib/events-routing'
import siteUrlUtils from '@/lib/site-url'
import 'server-only'

const { resolveSiteUrl } = siteUrlUtils

interface BuildEventPageMetadataOptions {
  eventSlug: string
  locale: SupportedLocale
  marketSlug?: string | null
}

interface BuildEventOgImageUrlOptions extends BuildEventPageMetadataOptions {
  version?: string | null
}

function buildEventMetaDescription(title: string, siteName: string) {
  return `Live odds, market activity, and trading data for ${title} on ${siteName}.`
}

function buildLocalizedPagePath(path: string, locale: SupportedLocale) {
  if (locale === DEFAULT_LOCALE) {
    return path
  }

  return `/${locale}${path}`
}

export function buildEventOgImageUrl({
  eventSlug,
  locale,
  marketSlug,
  version,
}: BuildEventOgImageUrlOptions) {
  const params = new URLSearchParams({
    slug: eventSlug,
    locale,
  })

  const normalizedMarketSlug = marketSlug?.trim()
  if (normalizedMarketSlug) {
    params.set('market', normalizedMarketSlug)
  }

  const normalizedVersion = version?.trim()
  if (normalizedVersion) {
    params.set('v', normalizedVersion)
  }

  const siteUrl = resolveSiteUrl(process.env)
  return new URL(`/api/og/event?${params.toString()}`, siteUrl).toString()
}

function resolveFocusedMarket(event: Event, marketSlug?: string | null) {
  const normalizedMarketSlug = marketSlug?.trim().toLowerCase() ?? ''
  if (normalizedMarketSlug) {
    const exactMatch = event.markets.find(market => market.slug.trim().toLowerCase() === normalizedMarketSlug) ?? null
    if (exactMatch) {
      return exactMatch
    }
  }

  return [...event.markets]
    .sort((left, right) => {
      const volumeDelta = (right.volume ?? 0) - (left.volume ?? 0)
      if (volumeDelta !== 0) {
        return volumeDelta
      }

      return (right.probability ?? 0) - (left.probability ?? 0)
    })[0] ?? null
}

export function buildEventOgImageVersion(event: Event, marketSlug?: string | null) {
  const focusedMarket = resolveFocusedMarket(event, marketSlug)
  const yesOutcome = focusedMarket?.outcomes.find(outcome => outcome.outcome_index === OUTCOME_INDEX.YES)
  const yesPrice = typeof yesOutcome?.buy_price === 'number'
    ? yesOutcome.buy_price
    : focusedMarket?.price

  return [
    event.updated_at || event.created_at,
    focusedMarket?.slug ?? event.slug,
    typeof yesPrice === 'number' ? yesPrice.toFixed(4) : 'na',
    Number.isFinite(event.volume) ? event.volume.toFixed(2) : '0.00',
  ].join(':')
}

export function buildEventPageUrl({
  eventSlug,
  locale,
  marketSlug,
  route,
}: BuildEventPageMetadataOptions & {
  route: Awaited<ReturnType<typeof loadEventPageShellData>>['route']
}) {
  const resolvedRoute = route ?? {
    slug: eventSlug,
    sports_sport_slug: null,
    sports_event_slug: null,
    sports_section: null,
  }
  const pagePath = marketSlug?.trim()
    ? resolveEventMarketPath(resolvedRoute, marketSlug.trim())
    : resolveEventPagePath(resolvedRoute)
  const localizedPath = buildLocalizedPagePath(pagePath, locale)
  const siteUrl = resolveSiteUrl(process.env)

  return new URL(localizedPath, siteUrl).toString()
}

export async function buildEventPageMetadata({
  eventSlug,
  locale,
  marketSlug,
}: BuildEventPageMetadataOptions): Promise<Metadata> {
  const shellData = await loadEventPageShellData(eventSlug, locale)
  const title = shellData.title

  if (!title) {
    notFound()
  }

  const resolvedTitle = title.trim()
  const siteName = shellData.site.name
  const description = buildEventMetaDescription(resolvedTitle, siteName)
  const pageUrl = buildEventPageUrl({
    eventSlug,
    locale,
    marketSlug,
    route: shellData.route,
  })
  const imageUrl = buildEventOgImageUrl({
    eventSlug,
    locale,
    marketSlug,
    version: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
  })
  const socialImage = {
    url: imageUrl,
    width: 1200,
    height: 630,
    alt: `${resolvedTitle} on ${siteName}`,
    type: 'image/png',
  } as const

  return {
    title: resolvedTitle,
    description,
    openGraph: {
      type: 'website',
      url: pageUrl,
      title: resolvedTitle,
      description,
      siteName,
      images: [socialImage],
    },
    twitter: {
      card: 'summary_large_image',
      title: resolvedTitle,
      description,
      images: [socialImage],
    },
  }
}
