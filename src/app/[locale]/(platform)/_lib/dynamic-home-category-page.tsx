import type { Metadata } from 'next'
import type { SupportedLocale } from '@/i18n/locales'
import { notFound } from 'next/navigation'
import HomeContent from '@/app/[locale]/(platform)/(home)/_components/HomeContent'
import {
  buildLocalizedPagePath,
  buildPredictionResultsOgImageUrl,
} from '@/app/[locale]/(platform)/_lib/prediction-results-metadata'
import { loadPlatformMainTags } from '@/lib/platform-main-tags'
import {
  findDynamicHomeCategoryBySlug,
  findDynamicHomeSubcategoryBySlug,
  getMainTagSeoTitle,
} from '@/lib/platform-routing'
import siteUrlUtils from '@/lib/site-url'
import { STATIC_PARAMS_PLACEHOLDER } from '@/lib/static-params'

const { resolveSiteUrl } = siteUrlUtils

async function getMainTags(locale: SupportedLocale) {
  const { data: mainTags } = await loadPlatformMainTags(locale)
  return mainTags ?? []
}

export async function generateDynamicHomeCategoryStaticParams() {
  return [{ slug: STATIC_PARAMS_PLACEHOLDER }]
}

export async function generateDynamicHomeSubcategoryStaticParams() {
  return [{ slug: STATIC_PARAMS_PLACEHOLDER, subcategory: STATIC_PARAMS_PLACEHOLDER }]
}

export async function buildDynamicHomeCategoryMetadata(locale: SupportedLocale, slug: string): Promise<Metadata> {
  if (slug === STATIC_PARAMS_PLACEHOLDER) {
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
    version: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
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
    version: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
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
  locale,
  slug,
}: {
  locale: SupportedLocale
  slug: string
}) {
  if (slug === STATIC_PARAMS_PLACEHOLDER) {
    notFound()
  }

  const category = findDynamicHomeCategoryBySlug(await getMainTags(locale), slug)
  if (!category) {
    notFound()
  }

  return <HomeContent locale={locale} initialTag={category.slug} />
}

export async function DynamicHomeSubcategoryPageContent({
  locale,
  slug,
  subcategory,
}: {
  locale: SupportedLocale
  slug: string
  subcategory: string
}) {
  if (slug === STATIC_PARAMS_PLACEHOLDER || subcategory === STATIC_PARAMS_PLACEHOLDER) {
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
    <HomeContent
      locale={locale}
      initialTag={resolvedSubcategory.subcategory.slug}
      initialMainTag={resolvedSubcategory.category.slug}
    />
  )
}
