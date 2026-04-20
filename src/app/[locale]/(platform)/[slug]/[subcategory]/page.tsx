import type { Metadata } from 'next'
import type { SupportedLocale } from '@/i18n/locales'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import {
  buildDynamicHomeSubcategoryMetadata,
  DynamicHomeSubcategoryPageContent,
  generateDynamicHomeSubcategoryStaticParams,
} from '@/app/[locale]/(platform)/_lib/dynamic-home-category-page'
import { isPlatformReservedRootSlug, normalizePublicProfileSlug } from '@/lib/platform-routing'
import { STATIC_PARAMS_PLACEHOLDER } from '@/lib/static-params'

export const generateStaticParams = generateDynamicHomeSubcategoryStaticParams

async function generatePlatformSubcategoryMetadata({
  locale,
  slug,
  subcategory,
}: {
  locale: SupportedLocale
  slug: string
  subcategory: string
}): Promise<Metadata> {
  'use cache'

  if (slug === STATIC_PARAMS_PLACEHOLDER || subcategory === STATIC_PARAMS_PLACEHOLDER) {
    notFound()
  }

  if (normalizePublicProfileSlug(slug).type !== 'invalid' || isPlatformReservedRootSlug(slug)) {
    notFound()
  }

  return buildDynamicHomeSubcategoryMetadata(locale, slug, subcategory)
}

async function renderPlatformSubcategoryPage({
  locale,
  slug,
  subcategory,
}: {
  locale: SupportedLocale
  slug: string
  subcategory: string
}) {
  'use cache'

  if (slug === STATIC_PARAMS_PLACEHOLDER || subcategory === STATIC_PARAMS_PLACEHOLDER) {
    notFound()
  }

  if (normalizePublicProfileSlug(slug).type !== 'invalid' || isPlatformReservedRootSlug(slug)) {
    notFound()
  }

  return <DynamicHomeSubcategoryPageContent locale={locale} slug={slug} subcategory={subcategory} />
}

export async function generateMetadata({ params }: PageProps<'/[locale]/[slug]/[subcategory]'>): Promise<Metadata> {
  const { locale, slug, subcategory } = await params
  const resolvedLocale = locale as SupportedLocale
  setRequestLocale(resolvedLocale)

  return await generatePlatformSubcategoryMetadata({
    locale: resolvedLocale,
    slug,
    subcategory,
  })
}

export default async function PlatformSubcategoryPage({ params }: PageProps<'/[locale]/[slug]/[subcategory]'>) {
  const { locale, slug, subcategory } = await params
  const resolvedLocale = locale as SupportedLocale
  setRequestLocale(resolvedLocale)

  return await renderPlatformSubcategoryPage({
    locale: resolvedLocale,
    slug,
    subcategory,
  })
}
