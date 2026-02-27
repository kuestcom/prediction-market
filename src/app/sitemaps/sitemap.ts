import type { MetadataRoute } from 'next'
import siteUrlUtils from '@/lib/site-url'
import { formatDateForSitemap, getDynamicSitemapEntriesById, getSitemapIds } from '@/lib/sitemap'

const { resolveSiteUrl } = siteUrlUtils

const BASE_PATHS = [
  '/',
  '/leaderboard',
  '/mentions',
  '/portfolio',
  '/sports',
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

  return buildSitemapEntries(sitemapId, siteUrl, fallbackLastModified)
}

async function buildSitemapEntries(sitemapId: string, siteUrl: string, lastModified: string): Promise<MetadataRoute.Sitemap> {
  if (sitemapId === 'base') {
    return buildPathEntries(BASE_PATHS, siteUrl, lastModified)
  }

  if (sitemapId === 'categories') {
    const dynamicEntries = await getDynamicSitemapEntriesById(sitemapId)
    return buildDynamicEntries(dynamicEntries, siteUrl)
  }

  if (sitemapId.startsWith('predictions-')) {
    const dynamicEntries = await getDynamicSitemapEntriesById(sitemapId)
    return buildDynamicEntries(dynamicEntries, siteUrl)
  }

  if (sitemapId.startsWith('events-active-')) {
    const dynamicEntries = await getDynamicSitemapEntriesById(sitemapId)
    return buildDynamicEntries(dynamicEntries, siteUrl)
  }

  if (sitemapId.startsWith('events-closed-')) {
    const dynamicEntries = await getDynamicSitemapEntriesById(sitemapId)
    return buildDynamicEntries(dynamicEntries, siteUrl)
  }

  return []
}

function buildPathEntries(paths: readonly string[], siteUrl: string, lastModified: string): MetadataRoute.Sitemap {
  return paths.map(path => ({
    url: toAbsoluteUrl(siteUrl, path),
    lastModified,
  }))
}

function buildDynamicEntries(
  entries: Array<{ path: string, lastModified: string }>,
  siteUrl: string,
): MetadataRoute.Sitemap {
  return entries.map(entry => ({
    url: toAbsoluteUrl(siteUrl, entry.path),
    lastModified: entry.lastModified,
  }))
}

function toAbsoluteUrl(siteUrl: string, path: string): string {
  return new URL(path, ensureTrailingSlash(siteUrl)).toString()
}

function ensureTrailingSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`
}
