import siteUrlUtils from '@/lib/site-url'
import { getSitemapIndexEntries } from '@/lib/sitemap'

const { resolveSiteUrl } = siteUrlUtils

const XML_CONTENT_TYPE = 'application/xml; charset=utf-8'

interface SitemapIndexEntry {
  id: string
  lastmod: string
}

export async function GET() {
  const siteUrl = resolveSiteUrl(process.env)
  const indexEntries = await getSitemapIndexEntries()
  const xml = buildSitemapIndexXml(siteUrl, indexEntries)

  return new Response(xml, {
    headers: {
      'Content-Type': XML_CONTENT_TYPE,
    },
  })
}

function buildSitemapIndexXml(siteUrl: string, entries: SitemapIndexEntry[]): string {
  const xmlEntries = entries
    .map((entry) => {
      const loc = `${siteUrl}/sitemaps/${entry.id}.xml`
      return [
        '  <sitemap>',
        `    <loc>${loc}</loc>`,
        `    <lastmod>${entry.lastmod}</lastmod>`,
        '  </sitemap>',
      ].join('\n')
    })
    .join('\n')

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    xmlEntries,
    '</sitemapindex>',
  ].join('\n')
}
