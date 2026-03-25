import type { Metadata } from 'next'
import type { SupportedLocale } from '@/i18n/locales'
import type {
  PredictionResultsSortOption,
  PredictionResultsStatusOption,
} from '@/lib/prediction-results-filters'
import type { Event } from '@/types'
import { getExtracted } from 'next-intl/server'
import PredictionResultsClient from '@/app/[locale]/(platform)/predictions/[slug]/_components/PredictionResultsClient'
import { TagRepository } from '@/lib/db/queries/tag'
import { listHomeEventsPage } from '@/lib/home-events-page'
import { buildPlatformNavigationTags } from '@/lib/platform-navigation'
import {
  resolvePredictionResultsRequestedApiSort,
  resolvePredictionResultsRequestedApiStatus,
} from '@/lib/prediction-results-filters'
import { resolvePredictionSearchContext } from '@/lib/prediction-search'

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
  const context = await getPredictionPageContext(locale, slug)

  return {
    title: `${context.label} Odds & Predictions`,
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
