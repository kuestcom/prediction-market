'use cache'

import type { Metadata } from 'next'
import type { SupportedLocale } from '@/i18n/locales'
import { getExtracted, setRequestLocale } from 'next-intl/server'
import LeaderboardClient from '@/app/[locale]/(platform)/leaderboard/_components/LeaderboardClient'
import {
  buildLeaderboardPath,
  CATEGORY_OPTIONS,
  ORDER_OPTIONS,
  parseLeaderboardFilters,
  PERIOD_OPTIONS,
} from '@/app/[locale]/(platform)/leaderboard/_utils/leaderboardFilters'
import { DEFAULT_LOCALE } from '@/i18n/locales'
import siteUrlUtils from '@/lib/site-url'
import { loadRuntimeThemeState } from '@/lib/theme-settings'

const { resolveSiteUrl } = siteUrlUtils

function buildLocalizedPagePath(path: string, locale: SupportedLocale) {
  if (locale === DEFAULT_LOCALE) {
    return path
  }

  return `/${locale}${path}`
}

function buildLeaderboardOgImageUrl({
  locale,
  category,
  period,
  order,
  version,
}: {
  locale: SupportedLocale
  category: string
  period: string
  order: string
  version?: string | null
}) {
  const params = new URLSearchParams({
    locale,
    category,
    period,
    order,
  })
  const normalizedVersion = version?.trim()
  if (normalizedVersion) {
    params.set('v', normalizedVersion)
  }

  const siteUrl = resolveSiteUrl(process.env)
  return new URL(`/api/og/leaderboard?${params.toString()}`, siteUrl).toString()
}

export async function generateMetadata({ params }: PageProps<'/[locale]/leaderboard/[[...filters]]'>): Promise<Metadata> {
  const { locale, filters } = await params
  setRequestLocale(locale)

  const t = await getExtracted()

  const runtimeTheme = await loadRuntimeThemeState()
  const siteName = runtimeTheme.site.name
  const parsedFilters = parseLeaderboardFilters(filters)
  const hasRequestedFilters = Array.isArray(filters) && filters.length > 0
  const pagePath = hasRequestedFilters ? buildLeaderboardPath(parsedFilters) : '/leaderboard'
  const pageUrl = new URL(
    buildLocalizedPagePath(pagePath, locale as SupportedLocale),
    resolveSiteUrl(process.env),
  ).toString()
  const imageUrl = buildLeaderboardOgImageUrl({
    locale: locale as SupportedLocale,
    category: parsedFilters.category,
    period: parsedFilters.period,
    order: parsedFilters.order,
    version: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
  })
  const title = t('Leaderboard')
  const description = t('See top traders and biggest wins on {siteName}', { siteName })
  const socialImage = {
    url: imageUrl,
    width: 1200,
    height: 630,
    alt: `${title} | ${siteName}`,
    type: 'image/png',
  } as const

  return {
    title,
    description,
    openGraph: {
      type: 'website',
      url: pageUrl,
      title,
      description,
      siteName,
      images: [socialImage],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [socialImage],
    },
  }
}

export async function generateStaticParams() {
  const params: Array<{ filters: string[] }> = [{ filters: [] }]

  for (const category of CATEGORY_OPTIONS.map(option => option.value)) {
    for (const period of PERIOD_OPTIONS.map(option => option.value)) {
      for (const order of ORDER_OPTIONS.map(option => option.value)) {
        params.push({ filters: [category, period, order] })
      }
    }
  }

  return params
}

export default async function LeaderboardPage({ params }: PageProps<'/[locale]/leaderboard/[[...filters]]'>) {
  const { locale, filters } = await params
  setRequestLocale(locale)

  const initialFilters = parseLeaderboardFilters(filters)

  return (
    <main className="container w-full py-6 md:py-8">
      <LeaderboardClient initialFilters={initialFilters} />
    </main>
  )
}
