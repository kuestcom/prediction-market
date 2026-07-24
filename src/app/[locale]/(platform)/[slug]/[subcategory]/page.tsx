import type { Metadata } from 'next'
import type { SupportedLocale } from '@/i18n/locales'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import {
  buildDynamicHomeSubcategoryMetadata,
  DynamicHomeSubcategoryPageContent,
  generateDynamicHomeSubcategoryStaticParams,
} from '@/app/[locale]/(platform)/_lib/dynamic-home-category-page'
import { hasDatabaseEnv } from '@/lib/db/env'
import { isPlatformReservedRootSlug, normalizePublicProfileSlug } from '@/lib/platform-routing'
import { deferPublicShellPrerenderIfNeeded, shouldPrerenderPublicShell } from '@/lib/public-shell-rendering'
import { shouldBypassPublicShellPlaceholder, STATIC_PARAMS_PLACEHOLDER } from '@/lib/static-params'

export const instant = false

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
    if (shouldBypassPublicShellPlaceholder(slug, subcategory)) {
      return {}
    }
    notFound()
  }

  if (normalizePublicProfileSlug(slug).type !== 'invalid' || isPlatformReservedRootSlug(slug)) {
    notFound()
  }

  return buildDynamicHomeSubcategoryMetadata(locale, slug, subcategory)
}

async function renderPlatformSubcategoryPage({
  deferHomeRuntimePrerender,
  locale,
  slug,
  subcategory,
}: {
  deferHomeRuntimePrerender?: boolean
  locale: SupportedLocale
  slug: string
  subcategory: string
}) {
  if (slug === STATIC_PARAMS_PLACEHOLDER || subcategory === STATIC_PARAMS_PLACEHOLDER) {
    if (shouldBypassPublicShellPlaceholder(slug, subcategory)) {
      return null
    }
    notFound()
  }

  if (normalizePublicProfileSlug(slug).type !== 'invalid' || isPlatformReservedRootSlug(slug)) {
    notFound()
  }

  return (
    <DynamicHomeSubcategoryPageContent
      locale={locale}
      slug={slug}
      subcategory={subcategory}
      deferHomeRuntimePrerender={deferHomeRuntimePrerender}
    />
  )
}

async function renderCachedPlatformSubcategoryPage({
  locale,
  slug,
  subcategory,
}: {
  locale: SupportedLocale
  slug: string
  subcategory: string
}) {
  'use cache'

  return renderPlatformSubcategoryPage({
    deferHomeRuntimePrerender: false,
    locale,
    slug,
    subcategory,
  })
}

async function renderRuntimePlatformSubcategoryPage({
  locale,
  slug,
  subcategory,
}: {
  locale: SupportedLocale
  slug: string
  subcategory: string
}) {
  await deferPublicShellPrerenderIfNeeded()

  if (!hasDatabaseEnv()) {
    return renderPlatformSubcategoryPage({
      deferHomeRuntimePrerender: false,
      locale,
      slug,
      subcategory,
    })
  }

  return renderCachedPlatformSubcategoryPage({
    locale,
    slug,
    subcategory,
  })
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
  const renderPage = shouldPrerenderPublicShell()
    ? renderCachedPlatformSubcategoryPage
    : renderRuntimePlatformSubcategoryPage

  return await renderPage({
    locale: resolvedLocale,
    slug,
    subcategory,
  })
}
