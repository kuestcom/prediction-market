import type { Metadata } from 'next'
import type { SupportedLocale } from '@/i18n/locales'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import EventContent from '@/app/[locale]/(platform)/event/[slug]/_components/EventContent'
import {
  getEventTitleBySlug,
  loadEventPageContentData,
  resolveCanonicalEventSlugFromSportsPath,
} from '@/lib/event-page-data'
import { STATIC_PARAMS_PLACEHOLDER } from '@/lib/static-params'

export async function generateStaticParams() {
  return [{ market: STATIC_PARAMS_PLACEHOLDER }]
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string, sport: string, event: string, market: string }>
}): Promise<Metadata> {
  const { locale, sport, event } = await params
  setRequestLocale(locale)
  const resolvedLocale = locale as SupportedLocale
  if (sport === STATIC_PARAMS_PLACEHOLDER || event === STATIC_PARAMS_PLACEHOLDER) {
    notFound()
  }
  const canonicalEventSlug = await resolveCanonicalEventSlugFromSportsPath(sport, event)
  if (!canonicalEventSlug) {
    notFound()
  }

  const title = await getEventTitleBySlug(canonicalEventSlug, resolvedLocale)

  return {
    title,
  }
}

export default async function SportsEventMarketPage({
  params,
}: {
  params: Promise<{ locale: string, sport: string, event: string, market: string }>
}) {
  const { locale, sport, event, market } = await params
  setRequestLocale(locale)
  const resolvedLocale = locale as SupportedLocale
  if (
    sport === STATIC_PARAMS_PLACEHOLDER
    || event === STATIC_PARAMS_PLACEHOLDER
    || market === STATIC_PARAMS_PLACEHOLDER
  ) {
    notFound()
  }
  const canonicalEventSlug = await resolveCanonicalEventSlugFromSportsPath(sport, event)
  if (!canonicalEventSlug) {
    notFound()
  }
  const eventPageData = await loadEventPageContentData(canonicalEventSlug, resolvedLocale)
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
