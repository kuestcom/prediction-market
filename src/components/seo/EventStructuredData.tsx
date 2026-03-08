import type { SupportedLocale } from '@/i18n/locales'
import type { ThemeSiteIdentity } from '@/lib/theme-site-identity'
import type { Event } from '@/types'
import StructuredDataScript from '@/components/seo/StructuredDataScript'
import { buildEventStructuredData } from '@/lib/structured-data'

interface EventStructuredDataProps {
  event: Event
  locale: SupportedLocale
  pagePath: string
  site: ThemeSiteIdentity
  marketSlug?: string | null
  includeFaq?: boolean
}

export default function EventStructuredData({
  event,
  locale,
  pagePath,
  site,
  marketSlug,
  includeFaq = true,
}: EventStructuredDataProps) {
  const structuredData = buildEventStructuredData({
    event,
    locale,
    pagePath,
    site,
    marketSlug,
    includeFaq,
  })

  return (
    <>
      <StructuredDataScript data={structuredData.event} />
      <StructuredDataScript data={structuredData.breadcrumbList} />
      {structuredData.faqPage && <StructuredDataScript data={structuredData.faqPage} />}
    </>
  )
}
