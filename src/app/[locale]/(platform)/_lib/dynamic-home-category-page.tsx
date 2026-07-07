import type { Metadata } from 'next'
import type { SupportedLocale } from '@/i18n/locales'
import { notFound } from 'next/navigation'
import HomeInitialContent from '@/app/[locale]/(platform)/(home)/_components/HomeInitialContent'
import {
  buildLocalizedPagePath,
  buildPredictionResultsOgImageUrl,
} from '@/app/[locale]/(platform)/_lib/prediction-results-metadata'
import { resolveCommitSha } from '@/lib/git'
import { loadPlatformMainTags } from '@/lib/platform-main-tags'
import {
  findDynamicHomeCategoryBySlug,
  findDynamicHomeSubcategoryBySlug,
  getMainTagSeoTitle,
} from '@/lib/platform-routing'
import resolveSiteUrl from '@/lib/site-url'
import { getPublicShellStaticParams, shouldBypassPublicShellPlaceholder, STATIC_PARAMS_PLACEHOLDER } from '@/lib/static-params'

async function getMainTags(locale: SupportedLocale) {
  const { data: mainTags } = await loadPlatformMainTags(locale)
  return mainTags ?? []
}

export async function generateDynamicHomeCategoryStaticParams() {
  return getPublicShellStaticParams({ slug: STATIC_PARAMS_PLACEHOLDER })
}

export async function generateDynamicHomeSubcategoryStaticParams() {
  return getPublicShellStaticParams({ slug: STATIC_PARAMS_PLACEHOLDER, subcategory: STATIC_PARAMS_PLACEHOLDER })
}

export async function buildDynamicHomeCategoryMetadata(locale: SupportedLocale, slug: string): Promise<Metadata> {
  if (slug === STATIC_PARAMS_PLACEHOLDER) {
    if (shouldBypassPublicShellPlaceholder(slug)) {
      return {}
    }
    notFound()
  }

  const category = findDynamicHomeCategoryBySlug(await getMainTags(locale), slug)
  if (!category) {
    notFound()
  }

  const title = getMainTagSeoTitle(category.name)
  const siteUrl = resolveSiteUrl(process.env)
  const imageUrl = buildPredictionResultsOgImageUrl({
    locale,
    slug: category.slug,
    label: category.name,
    version: resolveCommitSha(),
  })
  const pageUrl = new URL(
    buildLocalizedPagePath(`/${category.slug}`, locale),
    siteUrl,
  ).toString()

  return {
    title,
    openGraph: {
      type: 'website',
      url: pageUrl,
      title,
      images: [imageUrl],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      images: [imageUrl],
    },
  }
}

export async function buildDynamicHomeSubcategoryMetadata(
  locale: SupportedLocale,
  slug: string,
  subcategory: string,
): Promise<Metadata> {
  if (slug === STATIC_PARAMS_PLACEHOLDER || subcategory === STATIC_PARAMS_PLACEHOLDER) {
    if (shouldBypassPublicShellPlaceholder(slug, subcategory)) {
      return {}
    }
    notFound()
  }

  const resolvedSubcategory = findDynamicHomeSubcategoryBySlug(await getMainTags(locale), slug, subcategory)
  if (!resolvedSubcategory) {
    notFound()
  }

  const title = `${resolvedSubcategory.subcategory.name} ${getMainTagSeoTitle(resolvedSubcategory.category.name)}`
  const siteUrl = resolveSiteUrl(process.env)
  const imageUrl = buildPredictionResultsOgImageUrl({
    locale,
    slug: resolvedSubcategory.subcategory.slug,
    label: resolvedSubcategory.subcategory.name,
    version: resolveCommitSha(),
  })
  const pageUrl = new URL(
    buildLocalizedPagePath(`/${resolvedSubcategory.category.slug}/${resolvedSubcategory.subcategory.slug}`, locale),
    siteUrl,
  ).toString()

  return {
    title,
    openGraph: {
      type: 'website',
      url: pageUrl,
      title,
      images: [imageUrl],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      images: [imageUrl],
    },
  }
}

export async function DynamicHomeCategoryPageContent({
  deferHomeRuntimePrerender,
  locale,
  slug,
}: {
  deferHomeRuntimePrerender?: boolean
  locale: SupportedLocale
  slug: string
}) {
  if (slug === STATIC_PARAMS_PLACEHOLDER) {
    if (shouldBypassPublicShellPlaceholder(slug)) {
      return null
    }
    notFound()
  }

  const category = findDynamicHomeCategoryBySlug(await getMainTags(locale), slug)
  if (!category) {
    notFound()
  }

  return (
    <HomeInitialContent
      locale={locale}
      initialTag={category.slug}
      deferRuntimePrerender={deferHomeRuntimePrerender}
    />
  )
}

export async function DynamicHomeSubcategoryPageContent({
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

  const resolvedSubcategory = findDynamicHomeSubcategoryBySlug(
    await getMainTags(locale),
    slug,
    subcategory,
  )

  if (!resolvedSubcategory) {
    notFound()
  }

  return (
    <HomeInitialContent
      locale={locale}
      initialTag={resolvedSubcategory.subcategory.slug}
      initialMainTag={resolvedSubcategory.category.slug}
      deferRuntimePrerender={deferHomeRuntimePrerender}
    />
  )
}
