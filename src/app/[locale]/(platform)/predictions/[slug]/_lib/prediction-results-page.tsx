import type { Metadata } from 'next'
import type { SupportedLocale } from '@/i18n/locales'
import type {
  PredictionResultsSortOption,
  PredictionResultsStatusOption,
} from '@/lib/prediction-results-filters'
import type { Event } from '@/types'
import { getExtracted } from 'next-intl/server'
import {
  buildPredictionResultsOgImageUrl,
  buildPredictionResultsPageUrl,
} from '@/app/[locale]/(platform)/_lib/prediction-results-metadata'
import PredictionResultsClient from '@/app/[locale]/(platform)/predictions/[slug]/_components/PredictionResultsClient'
import { TagRepository } from '@/lib/db/queries/tag'
import { resolveCommitSha } from '@/lib/git'
import { buildPlatformNavigationTags } from '@/lib/platform-navigation'
import { listPredictionResultsPage } from '@/lib/prediction-results-events'
import { resolvePredictionResultsRequestedApiSort } from '@/lib/prediction-results-filters'
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
  description: descriptionOverride,
  locale,
  pageSlug,
  slug,
  title: titleOverride,
}: {
  description?: string
  locale: SupportedLocale
  pageSlug?: string | null
  slug: string
  title?: string
}): Promise<Metadata> {
  const t = await getExtracted({ locale })
  const [context, runtimeTheme] = await Promise.all([
    getPredictionPageContext(locale, slug),
    loadRuntimeThemeState(),
  ])
  const title = titleOverride ?? t('{slug} Predictions & Real-Time Odds', {
    slug: context.label,
  })
  const description = descriptionOverride ?? t('Explore live {slug} prediction markets.', {
    slug: context.label,
  })
  const siteName = runtimeTheme.site.name
  const pageUrl = buildPredictionResultsPageUrl({
    locale,
    slug: pageSlug === undefined ? slug : pageSlug,
  })
  const imageUrl = buildPredictionResultsOgImageUrl({
    locale,
    slug,
    label: context.label,
    version: resolveCommitSha(),
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
  heading,
  initialSort,
  initialStatus,
  locale,
  slug,
}: {
  heading?: string
  initialSort: PredictionResultsSortOption
  initialStatus: PredictionResultsStatusOption
  locale: SupportedLocale
  slug: string
}) {
  const context = await getPredictionPageContext(locale, slug)
  let initialEvents: Event[] = []

  try {
    const { data, error } = await listPredictionResultsPage({
      bookmarked: false,
      locale,
      mainTag: context.mainTag,
      search: context.query,
      sortBy: resolvePredictionResultsRequestedApiSort({
        query: context.query,
        sort: initialSort,
      }),
      status: initialStatus,
      tag: context.tag,
      userId: '',
    })

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
        heading={heading}
        initialCurrentTimestamp={null}
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
