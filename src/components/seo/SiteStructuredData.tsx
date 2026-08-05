import type { ThemeSiteIdentity } from '@/lib/theme-site-identity'

import StructuredDataScript from '@/components/seo/StructuredDataScript'
import { getRootLocale } from '@/i18n/root-locale'
import { buildSiteStructuredData } from '@/lib/structured-data'

interface SiteStructuredDataProps {
  site: ThemeSiteIdentity
}

export default async function SiteStructuredData({ site }: SiteStructuredDataProps) {
  const locale = await getRootLocale()
  const structuredData = buildSiteStructuredData({
    locale,
    site,
  })

  return (
    <>
      <StructuredDataScript data={structuredData.organization} />
      <StructuredDataScript data={structuredData.website} />
    </>
  )
}
