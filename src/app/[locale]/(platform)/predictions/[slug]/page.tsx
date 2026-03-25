import type { Metadata } from 'next'
import type { SupportedLocale } from '@/i18n/locales'
import type { Event } from '@/types'
import { getExtracted, setRequestLocale } from 'next-intl/server'
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

async function getPredictionPageContext(locale: SupportedLocale, slug: string) {
  const t = await getExtracted()
  const { data: mainTags, globalChilds = [] } = await TagRepository.getMainTags(locale)
  const tags = buildPlatformNavigationTags({
    globalChilds,
    mainTags: mainTags ?? [],
    newLabel: t('New'),
    trendingLabel: t('Trending'),
  })

  return resolvePredictionSearchContext(tags, slug)
}

function getQueryParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
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

export default async function PredictionResultsPage({
  params,
  searchParams,
}: PageProps<'/[locale]/predictions/[slug]'>) {
  const { locale, slug } = await params
  const resolvedLocale = locale as SupportedLocale
  setRequestLocale(resolvedLocale)

  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const initialSort = parsePredictionResultsSort(
    getQueryParamValue(resolvedSearchParams?._sort) ?? DEFAULT_PREDICTION_RESULTS_SORT,
  )
  const initialStatus = parsePredictionResultsStatus(
    getQueryParamValue(resolvedSearchParams?._status) ?? DEFAULT_PREDICTION_RESULTS_STATUS,
  )
  const context = await getPredictionPageContext(resolvedLocale, slug)
  const initialCurrentTimestamp = Date.now()

  let initialEvents: Event[] = []

  try {
    const { data, error } = await listHomeEventsPage({
      bookmarked: false,
      currentTimestamp: initialCurrentTimestamp,
      locale: resolvedLocale,
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
        key={`${slug}:${initialSort}:${initialStatus}`}
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
