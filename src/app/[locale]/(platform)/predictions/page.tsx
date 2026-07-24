import type { Metadata } from 'next'
import type { SupportedLocale } from '@/i18n/locales'
import { getExtracted, setRequestLocale } from 'next-intl/server'
import {
  generatePredictionResultsMetadata,
  renderPredictionResultsPage,
} from '@/app/[locale]/(platform)/predictions/[slug]/_lib/prediction-results-page'
import { resolvePredictionResultsFiltersFromSearchParams } from '@/lib/prediction-results-filters'

export const instant = false

async function getPopularPredictionsCopy(locale: SupportedLocale) {
  const t = await getExtracted({ locale })

  return {
    description: t('Explore popular prediction markets with live prices and real-time odds.'),
    heading: t('Explore popular predictions & real-time odds'),
  }
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/predictions'>): Promise<Metadata> {
  const { locale } = await params
  const resolvedLocale = locale as SupportedLocale
  setRequestLocale(resolvedLocale)
  const copy = await getPopularPredictionsCopy(resolvedLocale)

  return generatePredictionResultsMetadata({
    description: copy.description,
    locale: resolvedLocale,
    pageSlug: null,
    slug: 'trending',
    title: copy.heading,
  })
}

export default async function PopularPredictionsPage({
  params,
  searchParams,
}: PageProps<'/[locale]/predictions'>) {
  const [{ locale }, filters] = await Promise.all([
    params,
    searchParams.then(resolvePredictionResultsFiltersFromSearchParams),
  ])
  const resolvedLocale = locale as SupportedLocale
  setRequestLocale(resolvedLocale)
  const copy = await getPopularPredictionsCopy(resolvedLocale)

  return renderPredictionResultsPage({
    heading: copy.heading,
    initialSort: filters.sort,
    initialStatus: filters.status,
    locale: resolvedLocale,
    slug: 'trending',
  })
}
