import type { Metadata } from 'next'
import type { SupportedLocale } from '@/i18n/locales'
import type { Event } from '@/types'
import { getExtracted, setRequestLocale } from 'next-intl/server'
import { cacheLife } from 'next/cache'
import { notFound } from 'next/navigation'
import PredictionResultsClient from '@/app/[locale]/(platform)/predictions/[slug]/_components/PredictionResultsClient'
import { TagRepository } from '@/lib/db/queries/tag'
import { listHomeEventsPage } from '@/lib/home-events-page'
import { buildPlatformNavigationTags } from '@/lib/platform-navigation'
import {
  DEFAULT_PREDICTION_RESULTS_SORT,
  DEFAULT_PREDICTION_RESULTS_STATUS,
  parsePredictionResultsSort,
  parsePredictionResultsStatus,
  resolvePredictionResultsApiSort,
} from '@/lib/prediction-results-filters'
import { resolvePredictionSearchContext } from '@/lib/prediction-search'
import { STATIC_PARAMS_PLACEHOLDER } from '@/lib/static-params'

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

export async function generateMetadata({ params }: PageProps<'/[locale]/predictions/[slug]'>): Promise<Metadata> {
  const { locale, slug } = await params
  const resolvedLocale = locale as SupportedLocale
  setRequestLocale(resolvedLocale)

  const context = await getPredictionPageContext(resolvedLocale, slug)

  return {
    title: `${context.label} Odds & Predictions`,
  }
}

export async function generateStaticParams() {
  return [{ slug: STATIC_PARAMS_PLACEHOLDER }]
}

async function CachedPredictionResultsPageContent({
  initialSort,
  initialStatus,
  locale,
  slug,
}: {
  initialSort: ReturnType<typeof parsePredictionResultsSort>
  initialStatus: ReturnType<typeof parsePredictionResultsStatus>
  locale: SupportedLocale
  slug: string
}) {
  'use cache'
  cacheLife('minutes')

  const context = await getPredictionPageContext(locale, slug)
  const initialCurrentTimestamp = Math.floor(Date.now() / 60_000) * 60_000
  let initialEvents: Event[] = []

  try {
    const { data, error } = await listHomeEventsPage({
      bookmarked: false,
      currentTimestamp: initialCurrentTimestamp,
      locale,
      mainTag: context.mainTag,
      search: context.query,
      sortBy: resolvePredictionResultsApiSort(initialSort),
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

export default async function PredictionResultsPage({
  params,
}: PageProps<'/[locale]/predictions/[slug]'>) {
  const { locale, slug } = await params
  const resolvedLocale = locale as SupportedLocale
  setRequestLocale(resolvedLocale)

  if (slug === STATIC_PARAMS_PLACEHOLDER) {
    notFound()
  }

  const initialSort = parsePredictionResultsSort(DEFAULT_PREDICTION_RESULTS_SORT)
  const initialStatus = parsePredictionResultsStatus(DEFAULT_PREDICTION_RESULTS_STATUS)

  return (
    <CachedPredictionResultsPageContent
      initialSort={initialSort}
      initialStatus={initialStatus}
      locale={resolvedLocale}
      slug={slug}
    />
  )
}
