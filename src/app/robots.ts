import type { MetadataRoute } from 'next'
import { deferPublicShellPrerenderIfNeeded } from '@/lib/public-shell-rendering'
import resolveSiteUrl from '@/lib/site-url'

export default async function robots(): Promise<MetadataRoute.Robots> {
  await deferPublicShellPrerenderIfNeeded()

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
