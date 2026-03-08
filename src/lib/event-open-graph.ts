import type { Metadata } from 'next'
import type { SupportedLocale } from '@/i18n/locales'
import { notFound } from 'next/navigation'
import { getEventTitleBySlug } from '@/lib/event-page-data'
import siteUrlUtils from '@/lib/site-url'
import { loadRuntimeThemeState } from '@/lib/theme-settings'
import 'server-only'

const { resolveSiteUrl } = siteUrlUtils

interface BuildEventPageMetadataOptions {
  eventSlug: string
  locale: SupportedLocale
  marketSlug?: string | null
}

function buildEventMetaDescription(title: string, siteName: string) {
  return `Live odds, market activity, and trading data for ${title} on ${siteName}.`
}

export function buildEventOgImageUrl({
  eventSlug,
  locale,
  marketSlug,
}: BuildEventPageMetadataOptions) {
  const params = new URLSearchParams({
    slug: eventSlug,
    locale,
  })

  const normalizedMarketSlug = marketSlug?.trim()
  if (normalizedMarketSlug) {
    params.set('market', normalizedMarketSlug)
  }

  const siteUrl = resolveSiteUrl(process.env)
  return new URL(`/api/og/event?${params.toString()}`, siteUrl).toString()
}

export async function buildEventPageMetadata({
  eventSlug,
  locale,
  marketSlug,
}: BuildEventPageMetadataOptions): Promise<Metadata> {
  const [runtimeTheme, title] = await Promise.all([
    loadRuntimeThemeState(),
    getEventTitleBySlug(eventSlug, locale),
  ])

  if (!title) {
    notFound()
  }

  const resolvedTitle = title.trim()
  const siteName = runtimeTheme.site.name
  const description = buildEventMetaDescription(resolvedTitle, siteName)
  const imageUrl = buildEventOgImageUrl({ eventSlug, locale, marketSlug })

  return {
    title: resolvedTitle,
    description,
    openGraph: {
      type: 'website',
      title: resolvedTitle,
      description,
      siteName,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: `${resolvedTitle} on ${siteName}`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: resolvedTitle,
      description,
      images: [imageUrl],
    },
  }
}
