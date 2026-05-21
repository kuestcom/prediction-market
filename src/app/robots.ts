import type { MetadataRoute } from 'next'
import resolveSiteUrl from '@/lib/site-url'

export default function robots(): MetadataRoute.Robots {
  const siteUrl = resolveSiteUrl(process.env)

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
