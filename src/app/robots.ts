import type { MetadataRoute } from 'next'
import siteUrlUtils from '@/lib/site-url'

const { resolveSiteUrl } = siteUrlUtils

export default function robots(): MetadataRoute.Robots {
  const siteUrl = resolveSiteUrl(process.env)

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
