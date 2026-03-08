import type { Metadata } from 'next'
import type { SupportedLocale } from '@/i18n/locales'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import EventContent from '@/app/[locale]/(platform)/event/[slug]/_components/EventContent'
import EventStructuredData from '@/components/seo/EventStructuredData'
import { redirect } from '@/i18n/navigation'
import { buildEventPageMetadata } from '@/lib/event-open-graph'
import { getEventRouteBySlug, loadEventPageContentData } from '@/lib/event-page-data'
import { resolveEventMarketPath } from '@/lib/events-routing'
import { STATIC_PARAMS_PLACEHOLDER } from '@/lib/static-params'
import { loadRuntimeThemeState } from '@/lib/theme-settings'

export async function generateStaticParams() {
  return [{ market: STATIC_PARAMS_PLACEHOLDER }]
}

export async function generateMetadata({ params }: PageProps<'/[locale]/event/[slug]/[market]'>): Promise<Metadata> {
  const { locale, slug, market } = await params
  setRequestLocale(locale)
  const resolvedLocale = locale as SupportedLocale
  if (slug === STATIC_PARAMS_PLACEHOLDER || market === STATIC_PARAMS_PLACEHOLDER) {
    notFound()
  }
  return await buildEventPageMetadata({
    eventSlug: slug,
    locale: resolvedLocale,
    marketSlug: market,
  })
}

export default async function EventMarketPage({ params }: PageProps<'/[locale]/event/[slug]/[market]'>) {
  const { locale, slug, market } = await params
  setRequestLocale(locale)
  const resolvedLocale = locale as SupportedLocale
  if (slug === STATIC_PARAMS_PLACEHOLDER || market === STATIC_PARAMS_PLACEHOLDER) {
    notFound()
  }

  const eventRoute = await getEventRouteBySlug(slug)
  if (!eventRoute) {
    notFound()
  }

  const canonicalPath = resolveEventMarketPath(eventRoute, market)
  const legacyPath = `/event/${eventRoute.slug}/${market}`
  if (canonicalPath !== legacyPath) {
    redirect({
      href: canonicalPath,
      locale: resolvedLocale,
    })
  }

  const [eventPageData, runtimeTheme] = await Promise.all([
    loadEventPageContentData(slug, resolvedLocale),
    loadRuntimeThemeState(),
  ])
  if (!eventPageData) {
    notFound()
  }

  return (
    <>
      <EventStructuredData
        event={eventPageData.event}
        locale={resolvedLocale}
        pagePath={resolveEventMarketPath(eventPageData.event, market)}
        marketSlug={market}
        site={runtimeTheme.site}
      />
      <EventContent
        event={eventPageData.event}
        changeLogEntries={eventPageData.changeLogEntries}
        user={eventPageData.user}
        marketContextEnabled={eventPageData.marketContextEnabled}
        marketSlug={market}
        seriesEvents={eventPageData.seriesEvents}
        liveChartConfig={eventPageData.liveChartConfig}
        key={`is-bookmarked-${eventPageData.event.is_bookmarked}`}
      />
    </>
  )
}
