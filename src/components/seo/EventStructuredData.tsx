import type { EventFaqItem } from '@/lib/event-faq'
import type { ThemeSiteIdentity } from '@/lib/theme-site-identity'
import type { Event } from '@/types'

import StructuredDataScript from '@/components/seo/StructuredDataScript'
import { getRootLocale } from '@/i18n/root-locale'
import { buildTranslatedEventFaqItems } from '@/lib/event-faq-server'
import { buildEventStructuredData } from '@/lib/structured-data'

interface EventStructuredDataProps {
  event: Event
  pagePath: string
  site: ThemeSiteIdentity
  marketSlug?: string | null
  includeFaq?: boolean
  faqItems?: EventFaqItem[]
}

export default async function EventStructuredData({
  event,
  pagePath,
  site,
  marketSlug,
  includeFaq = true,
  faqItems,
}: EventStructuredDataProps) {
  const locale = await getRootLocale()
  const resolvedFaqItems = includeFaq
    ? (faqItems ??
      (await buildTranslatedEventFaqItems({
        event,
        siteName: site.name,
        locale,
      })))
    : undefined

  const structuredData = buildEventStructuredData({
    event,
    locale,
    pagePath,
    site,
    marketSlug,
    includeFaq,
    faqItems: resolvedFaqItems,
  })

  return (
    <>
      <StructuredDataScript data={structuredData.event} />
      <StructuredDataScript data={structuredData.breadcrumbList} />
      {structuredData.faqPage && <StructuredDataScript data={structuredData.faqPage} />}
    </>
  )
}
