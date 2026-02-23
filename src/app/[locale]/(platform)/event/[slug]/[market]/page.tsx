import type { Metadata } from 'next'
import type { SupportedLocale } from '@/i18n/locales'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import EventContent from '@/app/[locale]/(platform)/event/[slug]/_components/EventContent'
import { getEventTitleBySlug, loadEventPageContentData } from '@/lib/event-page-data'
import { STATIC_PARAMS_PLACEHOLDER } from '@/lib/static-params'

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
  const title = await getEventTitleBySlug(slug, resolvedLocale)

  return {
    title,
  }
}

export default async function EventMarketPage({ params }: PageProps<'/[locale]/event/[slug]/[market]'>) {
  const { locale, slug, market } = await params
  setRequestLocale(locale)
  const resolvedLocale = locale as SupportedLocale
  if (slug === STATIC_PARAMS_PLACEHOLDER || market === STATIC_PARAMS_PLACEHOLDER) {
    notFound()
  }
  const eventPageData = await loadEventPageContentData(slug, resolvedLocale)
  if (!eventPageData) {
    notFound()
  }

  return (
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
  )
}
