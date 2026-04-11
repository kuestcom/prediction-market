import type { Metadata } from 'next'
import type { SupportedLocale } from '@/i18n/locales'
import type {
  PredictionResultsSortOption,
  PredictionResultsStatusOption,
} from '@/lib/prediction-results-filters'
import type { Event } from '@/types'
import { getExtracted } from 'next-intl/server'
import { connection } from 'next/server'
import {
  buildPredictionResultsOgImageUrl,
  buildPredictionResultsPageUrl,
} from '@/app/[locale]/(platform)/_lib/prediction-results-metadata'
import PredictionResultsClient from '@/app/[locale]/(platform)/predictions/[slug]/_components/PredictionResultsClient'
import { TagRepository } from '@/lib/db/queries/tag'
import { listHomeEventsPage } from '@/lib/home-events-page'
import { buildPlatformNavigationTags } from '@/lib/platform-navigation'
import {
  resolvePredictionResultsRequestedApiSort,
  resolvePredictionResultsRequestedApiStatus,
} from '@/lib/prediction-results-filters'
import { resolvePredictionSearchContext } from '@/lib/prediction-search'
import { loadRuntimeThemeState } from '@/lib/theme-settings'

async function getPredictionPageContext(locale: SupportedLocale, slug: string) {
  const t = await getExtracted({ locale })
  const { data: mainTags, globalChilds = [] } = await TagRepository.getMainTags(locale)
  const tags = buildPlatformNavigationTags({
    globalChilds,
    mainTags: mainTags ?? [],
    newLabel: t('New'),
    trendingLabel: t('Trending'),
  })

  return resolvePredictionSearchContext(tags, slug)
}

export async function generatePredictionResultsMetadata({
  locale,
  slug,
}: {
  locale: SupportedLocale
  slug: string
}): Promise<Metadata> {
  await connection()
  const t = await getExtracted({ locale })
  const [context, runtimeTheme] = await Promise.all([
    getPredictionPageContext(locale, slug),
    loadRuntimeThemeState(),
  ])
  const dateLabel = new Intl.DateTimeFormat(locale, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date())
  const title = t('{slug} Predictions & Real-Time Odds', {
    slug: context.label,
  })
  const description = t('Explore live {slug} prediction markets as of {date}.', {
    slug: context.label,
    date: dateLabel,
  })
  const siteName = runtimeTheme.site.name
  const pageUrl = buildPredictionResultsPageUrl({
    locale,
    slug,
  })
  const imageUrl = buildPredictionResultsOgImageUrl({
    locale,
    slug,
    label: context.label,
    version: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
  })
  const socialImage = {
    url: imageUrl,
    width: 1200,
    height: 630,
    alt: `${context.label} prediction markets on ${siteName}`,
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

export async function renderPredictionResultsPage({
  initialSort,
  initialStatus,
  locale,
  slug,
}: {
  initialSort: PredictionResultsSortOption
  initialStatus: PredictionResultsStatusOption
  locale: SupportedLocale
  slug: string
}) {
  const context = await getPredictionPageContext(locale, slug)
  let initialCurrentTimestamp: number | null = null
  let initialEvents: Event[] = []

  try {
    const { data, error, currentTimestamp } = await listHomeEventsPage({
      bookmarked: false,
      locale,
      mainTag: context.mainTag,
      search: context.query,
      sortBy: resolvePredictionResultsRequestedApiSort({
        query: context.query,
        sort: initialSort,
      }),
      status: resolvePredictionResultsRequestedApiStatus({
        query: context.query,
        status: initialStatus,
      }),
      tag: context.tag,
      userId: '',
    })

    initialCurrentTimestamp = currentTimestamp ?? null

    if (!error) {
      initialEvents = data ?? []
    }
  }
  catch {
    initialEvents = []
  }

  return (
    <main className="container py-6 lg:py-8">
      <PredictionResultsClient
        displayLabel={context.label}
        initialCurrentTimestamp={initialCurrentTimestamp}
        initialEvents={initialEvents}
        initialInputValue={context.inputValue}
        initialQuery={context.query}
        initialSort={initialSort}
        initialStatus={initialStatus}
        routeMainTag={context.mainTag}
        routeTag={context.tag}
      />
    </main>
  )
}
