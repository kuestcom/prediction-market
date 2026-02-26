import type { Metadata } from 'next'
import type { SupportedLocale } from '@/i18n/locales'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import EventContent from '@/app/[locale]/(platform)/event/[slug]/_components/EventContent'
import { redirect } from '@/i18n/navigation'
import { getEventRouteBySlug, getEventTitleBySlug, loadEventPageContentData } from '@/lib/event-page-data'
import { resolveEventBasePath } from '@/lib/events-routing'
import { STATIC_PARAMS_PLACEHOLDER } from '@/lib/static-params'

export async function generateMetadata({ params }: PageProps<'/[locale]/event/[slug]'>): Promise<Metadata> {
  const { locale, slug } = await params
  setRequestLocale(locale)
  const resolvedLocale = locale as SupportedLocale
  if (slug === STATIC_PARAMS_PLACEHOLDER) {
    notFound()
  }
  const title = await getEventTitleBySlug(slug, resolvedLocale)

  return {
    title,
  }
}

export default async function EventPage({ params }: PageProps<'/[locale]/event/[slug]'>) {
  const { locale, slug } = await params
  setRequestLocale(locale)
  const resolvedLocale = locale as SupportedLocale
  if (slug === STATIC_PARAMS_PLACEHOLDER) {
    notFound()
  }

  const eventRoute = await getEventRouteBySlug(slug)
  if (!eventRoute) {
    notFound()
  }

  const sportsPath = resolveEventBasePath(eventRoute)
  if (sportsPath) {
    redirect({
      href: sportsPath,
      locale: resolvedLocale,
    })
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
      seriesEvents={eventPageData.seriesEvents}
      liveChartConfig={eventPageData.liveChartConfig}
      key={`is-bookmarked-${eventPageData.event.is_bookmarked}`}
    />
  )
}
