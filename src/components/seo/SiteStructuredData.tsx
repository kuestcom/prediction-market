import type { SupportedLocale } from '@/i18n/locales'
import type { ThemeSiteIdentity } from '@/lib/theme-site-identity'
import StructuredDataScript from '@/components/seo/StructuredDataScript'
import { buildSiteStructuredData } from '@/lib/structured-data'

interface SiteStructuredDataProps {
  locale: SupportedLocale
  site: ThemeSiteIdentity
}

export default function SiteStructuredData({ locale, site }: SiteStructuredDataProps) {
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
