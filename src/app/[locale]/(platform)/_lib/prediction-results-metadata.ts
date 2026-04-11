import type { SupportedLocale } from '@/i18n/locales'
import { DEFAULT_LOCALE } from '@/i18n/locales'
import siteUrlUtils from '@/lib/site-url'

const { resolveSiteUrl } = siteUrlUtils

export function buildLocalizedPagePath(path: string, locale: SupportedLocale) {
  if (locale === DEFAULT_LOCALE) {
    return path
  }

  return `/${locale}${path}`
}

export function buildPredictionResultsOgImageUrl({
  locale,
  slug,
  label,
  version,
}: {
  locale: SupportedLocale
  slug: string
  label: string
  version?: string | null
}) {
  const params = new URLSearchParams({
    locale,
    slug,
    label,
  })

  const normalizedVersion = version?.trim()
  if (normalizedVersion) {
    params.set('v', normalizedVersion)
  }

  const siteUrl = resolveSiteUrl(process.env)
  return new URL(`/api/og/predictions?${params.toString()}`, siteUrl).toString()
}

export function buildPredictionResultsPageUrl({
  locale,
  slug,
}: {
  locale: SupportedLocale
  slug: string
}) {
  const pagePath = buildLocalizedPagePath(`/predictions/${slug}`, locale)
  const siteUrl = resolveSiteUrl(process.env)
  return new URL(pagePath, siteUrl).toString()
}
