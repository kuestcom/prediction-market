import type { Metadata } from 'next'

import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'

import {
  buildDynamicHomeCategoryMetadata,
  DynamicHomeCategoryPageContent,
  generateDynamicHomeCategoryStaticParams,
} from '@/app/[locale]/(platform)/_lib/dynamic-home-category-page'
import {
  buildPublicProfileMetadata,
  PublicProfilePageContent,
} from '@/app/[locale]/(platform)/_lib/public-profile-page'
import { getRootLocale } from '@/i18n/root-locale'
import { isPlatformReservedRootSlug, normalizePublicProfileSlug } from '@/lib/platform-routing'
import { shouldBypassPublicShellPlaceholder, STATIC_PARAMS_PLACEHOLDER } from '@/lib/static-params'

export const instant = false

export const generateStaticParams = generateDynamicHomeCategoryStaticParams

async function generatePlatformSlugMetadata({ slug }: { slug: string }): Promise<Metadata> {
  if (slug === STATIC_PARAMS_PLACEHOLDER) {
    if (shouldBypassPublicShellPlaceholder(slug)) {
      return {}
    }
    notFound()
  }

  const locale = await getRootLocale()
  const profileSlug = normalizePublicProfileSlug(slug)
  if (profileSlug.type !== 'invalid') {
    return await buildPublicProfileMetadata({
      slug,
      locale,
    })
  }

  if (isPlatformReservedRootSlug(slug)) {
    notFound()
  }

  return buildDynamicHomeCategoryMetadata(slug)
}

async function renderPlatformSlugPage({ slug }: { slug: string }) {
  if (slug === STATIC_PARAMS_PLACEHOLDER) {
    if (shouldBypassPublicShellPlaceholder(slug)) {
      return null
    }
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

  return <DynamicHomeCategoryPageContent slug={slug} />
}

export async function generateMetadata({ params }: PageProps<'/[locale]/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  setRequestLocale(await getRootLocale())

  return await generatePlatformSlugMetadata({
    slug,
  })
}

export default async function PlatformSlugPage({ params }: PageProps<'/[locale]/[slug]'>) {
  const { slug } = await params
  setRequestLocale(await getRootLocale())

  return await renderPlatformSlugPage({
    slug,
  })
}
