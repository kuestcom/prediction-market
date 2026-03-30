import type { MetadataRoute } from 'next'
import type { SupportedLocale } from '@/i18n/locales'
import { loadEnabledLocales } from '@/i18n/locale-settings'
import { DEFAULT_LOCALE } from '@/i18n/locales'
import { withLocalePrefix } from '@/lib/locale-path'
import siteUrlUtils from '@/lib/site-url'
import { formatDateForSitemap, getDynamicSitemapEntriesById, getSitemapIds } from '@/lib/sitemap'

const { resolveSiteUrl } = siteUrlUtils

const BASE_PATHS = [
  '/',
  '/activity',
  '/leaderboard',
  '/mentions',
  '/portfolio',
  '/predictions',
  '/terms-of-use',
] as const

export async function generateSitemaps() {
  const sitemapIds = await getSitemapIds()
  return sitemapIds.map(id => ({ id }))
}

interface Props {
  id: Promise<string>
}

export default async function sitemap({ id }: Props): Promise<MetadataRoute.Sitemap> {
  const sitemapId = await id
  const siteUrl = resolveSiteUrl(process.env)
  const fallbackLastModified = formatDateForSitemap(new Date())
  const enabledLocales = await loadEnabledLocales()

  return buildSitemapEntries(sitemapId, siteUrl, fallbackLastModified, enabledLocales)
}

async function buildSitemapEntries(
  sitemapId: string,
  siteUrl: string,
  lastModified: string,
  enabledLocales: SupportedLocale[],
): Promise<MetadataRoute.Sitemap> {
  if (sitemapId === 'base') {
    return buildPathEntries(BASE_PATHS, siteUrl, lastModified, enabledLocales)
  }

  if (sitemapId === 'categories') {
    const dynamicEntries = await getDynamicSitemapEntriesById(sitemapId)
    return buildDynamicEntries(dynamicEntries, siteUrl, enabledLocales)
  }

  if (sitemapId.startsWith('predictions-')) {
    const dynamicEntries = await getDynamicSitemapEntriesById(sitemapId)
    return buildDynamicEntries(dynamicEntries, siteUrl, enabledLocales)
  }

  if (sitemapId.startsWith('events-active-')) {
    const dynamicEntries = await getDynamicSitemapEntriesById(sitemapId)
    return buildDynamicEntries(dynamicEntries, siteUrl, enabledLocales)
  }

  if (sitemapId.startsWith('events-closed-')) {
    const dynamicEntries = await getDynamicSitemapEntriesById(sitemapId)
    return buildDynamicEntries(dynamicEntries, siteUrl, enabledLocales)
  }

  return []
}

function buildPathEntries(
  paths: readonly string[],
  siteUrl: string,
  lastModified: string,
  enabledLocales: SupportedLocale[],
): MetadataRoute.Sitemap {
  return paths.flatMap(path => buildLocalizedSitemapEntries(path, lastModified, siteUrl, enabledLocales))
}

function buildDynamicEntries(
  entries: Array<{ path: string, lastModified: string }>,
  siteUrl: string,
  enabledLocales: SupportedLocale[],
): MetadataRoute.Sitemap {
  return entries.flatMap(entry => buildLocalizedSitemapEntries(entry.path, entry.lastModified, siteUrl, enabledLocales))
}

function buildLocalizedSitemapEntries(
  path: string,
  lastModified: string,
  siteUrl: string,
  enabledLocales: SupportedLocale[],
): MetadataRoute.Sitemap {
  const languages = buildAlternateLanguages(path, siteUrl, enabledLocales)
  const locales = enabledLocales.length > 0
    ? enabledLocales
    : [DEFAULT_LOCALE]

  return locales.map(locale => ({
    url: toAbsoluteUrl(siteUrl, withLocalePrefix(path, locale)),
    lastModified,
    ...(languages ? { alternates: { languages } } : {}),
  }))
}

function buildAlternateLanguages(
  path: string,
  siteUrl: string,
  enabledLocales: SupportedLocale[],
): Record<string, string> | undefined {
  const locales = enabledLocales.length > 0
    ? enabledLocales
    : [DEFAULT_LOCALE]

  const languages = locales.reduce<Record<string, string>>((accumulator, locale) => {
    accumulator[locale] = toAbsoluteUrl(siteUrl, withLocalePrefix(path, locale))
    return accumulator
  }, {})
  languages['x-default'] = toAbsoluteUrl(siteUrl, path)

  return Object.keys(languages).length > 0
    ? languages
    : undefined
}

function toAbsoluteUrl(siteUrl: string, path: string): string {
  return new URL(path, ensureTrailingSlash(siteUrl)).toString()
}

function ensureTrailingSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`
}
