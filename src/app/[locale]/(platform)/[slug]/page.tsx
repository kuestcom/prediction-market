'use cache'

import type { Metadata } from 'next'
import type { SupportedLocale } from '@/i18n/locales'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import {
  buildDynamicHomeCategoryMetadata,
  DynamicHomeCategoryPageContent,
  generateDynamicHomeCategoryStaticParams,
} from '@/app/[locale]/(platform)/_lib/dynamic-home-category-page'
import { buildPublicProfileMetadata, PublicProfilePageContent } from '@/app/[locale]/(platform)/_lib/public-profile-page'
import {
  isPlatformReservedRootSlug,
  normalizePublicProfileSlug,
} from '@/lib/platform-routing'
import { STATIC_PARAMS_PLACEHOLDER } from '@/lib/static-params'

export const generateStaticParams = generateDynamicHomeCategoryStaticParams

export async function generateMetadata({ params }: PageProps<'/[locale]/[slug]'>): Promise<Metadata> {
  const { locale, slug } = await params
  const resolvedLocale = locale as SupportedLocale
  setRequestLocale(resolvedLocale)

  if (slug === STATIC_PARAMS_PLACEHOLDER) {
    notFound()
  }

  const profileSlug = normalizePublicProfileSlug(slug)
  if (profileSlug.type !== 'invalid') {
    return buildPublicProfileMetadata(slug)
  }

  if (isPlatformReservedRootSlug(slug)) {
    notFound()
  }

  return buildDynamicHomeCategoryMetadata(resolvedLocale, slug)
}

export default async function PlatformSlugPage({ params }: PageProps<'/[locale]/[slug]'>) {
  const { locale, slug } = await params
  const resolvedLocale = locale as SupportedLocale
  setRequestLocale(resolvedLocale)

  if (slug === STATIC_PARAMS_PLACEHOLDER) {
    notFound()
  }

  const profileSlug = normalizePublicProfileSlug(slug)
  if (profileSlug.type !== 'invalid') {
    return (
      <main className="container py-8">
        <div className="mx-auto grid max-w-6xl gap-12">
          <PublicProfilePageContent slug={slug} />
        </div>
      </main>
    )
  }

  if (isPlatformReservedRootSlug(slug)) {
    notFound()
  }

  return <DynamicHomeCategoryPageContent locale={resolvedLocale} slug={slug} />
}
