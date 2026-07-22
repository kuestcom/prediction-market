import type { Metadata } from 'next'
import type { SupportedLocale } from '@/i18n/locales'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import {
  generatePredictionResultsMetadata,
  renderPredictionResultsPage,
} from '@/app/[locale]/(platform)/predictions/[slug]/_lib/prediction-results-page'
import { resolvePredictionResultsFiltersFromSearchParams } from '@/lib/prediction-results-filters'
import { getPublicShellStaticParams, shouldBypassPublicShellPlaceholder, STATIC_PARAMS_PLACEHOLDER } from '@/lib/static-params'

export const instant = false

export async function generateStaticParams() {
  return getPublicShellStaticParams({ slug: STATIC_PARAMS_PLACEHOLDER })
}

export async function generateMetadata({ params }: PageProps<'/[locale]/predictions/[slug]'>): Promise<Metadata> {
  const { locale, slug } = await params
  const resolvedLocale = locale as SupportedLocale
  setRequestLocale(resolvedLocale)

  if (shouldBypassPublicShellPlaceholder(slug)) {
    return {}
  }

  return generatePredictionResultsMetadata({
    locale: resolvedLocale,
    slug,
  })
}

export default async function PredictionResultsPage({
  params,
  searchParams,
}: PageProps<'/[locale]/predictions/[slug]'>) {
  const [{ locale, slug }, filters] = await Promise.all([
    params,
    searchParams.then(resolvePredictionResultsFiltersFromSearchParams),
  ])
  const resolvedLocale = locale as SupportedLocale
  setRequestLocale(resolvedLocale)

  if (slug === STATIC_PARAMS_PLACEHOLDER) {
    if (shouldBypassPublicShellPlaceholder(slug)) {
      return null
    }
    notFound()
  }

  return renderPredictionResultsPage({
    initialSort: filters.sort,
    initialStatus: filters.status,
    locale: resolvedLocale,
    slug,
  })
}
