import type { Metadata } from 'next'
import type { SupportedLocale } from '@/i18n/locales'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import {
  generatePredictionResultsMetadata,
  renderPredictionResultsPage,
} from '@/app/[locale]/(platform)/predictions/[slug]/_lib/prediction-results-page'
import {
  DEFAULT_PREDICTION_RESULTS_SORT,
  DEFAULT_PREDICTION_RESULTS_STATUS,
  parsePredictionResultsSort,
  parsePredictionResultsStatus,
} from '@/lib/prediction-results-filters'
import { STATIC_PARAMS_PLACEHOLDER } from '@/lib/static-params'

export async function generateStaticParams() {
  return [{
    slug: STATIC_PARAMS_PLACEHOLDER,
    sort: DEFAULT_PREDICTION_RESULTS_SORT,
    status: DEFAULT_PREDICTION_RESULTS_STATUS,
  }]
}

interface PredictionResultsFilteredPageParams {
  locale: string
  slug: string
  sort: string
  status: string
}

export async function generateMetadata({
  params,
}: {
  params: Promise<PredictionResultsFilteredPageParams>
}): Promise<Metadata> {
  const { locale, slug } = await params
  const resolvedLocale = locale as SupportedLocale
  setRequestLocale(resolvedLocale)

  return generatePredictionResultsMetadata({
    locale: resolvedLocale,
    slug,
  })
}

export default async function PredictionResultsFilteredPage({
  params,
}: {
  params: Promise<PredictionResultsFilteredPageParams>
}) {
  const { locale, slug, sort, status } = await params
  const resolvedLocale = locale as SupportedLocale
  setRequestLocale(resolvedLocale)

  if (slug === STATIC_PARAMS_PLACEHOLDER) {
    notFound()
  }

  return renderPredictionResultsPage({
    initialSort: parsePredictionResultsSort(sort),
    initialStatus: parsePredictionResultsStatus(status),
    locale: resolvedLocale,
    slug,
  })
}
