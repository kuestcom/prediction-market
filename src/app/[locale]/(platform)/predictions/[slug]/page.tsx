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
} from '@/lib/prediction-results-filters'
import { STATIC_PARAMS_PLACEHOLDER } from '@/lib/static-params'

export async function generateStaticParams() {
  return [{ slug: STATIC_PARAMS_PLACEHOLDER }]
}

export async function generateMetadata({ params }: PageProps<'/[locale]/predictions/[slug]'>): Promise<Metadata> {
  const { locale, slug } = await params
  const resolvedLocale = locale as SupportedLocale
  setRequestLocale(resolvedLocale)

  return generatePredictionResultsMetadata({
    locale: resolvedLocale,
    slug,
  })
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

  return renderPredictionResultsPage({
    initialSort: DEFAULT_PREDICTION_RESULTS_SORT,
    initialStatus: DEFAULT_PREDICTION_RESULTS_STATUS,
    locale: resolvedLocale,
    slug,
  })
}
