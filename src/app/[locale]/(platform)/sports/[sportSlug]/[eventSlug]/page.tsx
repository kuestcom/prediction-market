import type { Metadata } from 'next'
import type { SupportedLocale } from '@/i18n/locales'
import type { EventLiveChartConfig, EventSeriesEntry } from '@/types'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import EventContent from '@/app/[locale]/(platform)/event/[slug]/_components/EventContent'
import { loadMarketContextSettings } from '@/lib/ai/market-context-config'
import { EventRepository } from '@/lib/db/queries/event'
import { UserRepository } from '@/lib/db/queries/user'
import { STATIC_PARAMS_PLACEHOLDER } from '@/lib/static-params'

async function resolveCanonicalEventSlug(sportSlug: string, eventSlug: string) {
  const { data, error } = await EventRepository.getCanonicalEventSlugBySportsPath(sportSlug, eventSlug)
  if (error || !data?.slug) {
    return null
  }

  return data.slug
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string, sportSlug: string, eventSlug: string }>
}): Promise<Metadata> {
  const { locale, sportSlug, eventSlug } = await params
  setRequestLocale(locale)
  const resolvedLocale = locale as SupportedLocale
  if (sportSlug === STATIC_PARAMS_PLACEHOLDER || eventSlug === STATIC_PARAMS_PLACEHOLDER) {
    notFound()
  }
  const canonicalEventSlug = await resolveCanonicalEventSlug(sportSlug, eventSlug)
  if (!canonicalEventSlug) {
    notFound()
  }

  const { data } = await EventRepository.getEventTitleBySlug(canonicalEventSlug, resolvedLocale)

  return {
    title: data?.title,
  }
}

export default async function SportsEventPage({
  params,
}: {
  params: Promise<{ locale: string, sportSlug: string, eventSlug: string }>
}) {
  const { locale, sportSlug, eventSlug } = await params
  setRequestLocale(locale)
  const resolvedLocale = locale as SupportedLocale
  if (sportSlug === STATIC_PARAMS_PLACEHOLDER || eventSlug === STATIC_PARAMS_PLACEHOLDER) {
    notFound()
  }
  const canonicalEventSlug = await resolveCanonicalEventSlug(sportSlug, eventSlug)
  if (!canonicalEventSlug) {
    notFound()
  }
  await connection()

  const [user, marketContextSettings] = await Promise.all([
    UserRepository.getCurrentUser(),
    loadMarketContextSettings(),
  ])

  const marketContextEnabled = marketContextSettings.enabled && Boolean(marketContextSettings.apiKey)

  const [eventResult, changeLogResult] = await Promise.all([
    EventRepository.getEventBySlug(canonicalEventSlug, user?.id ?? '', resolvedLocale),
    EventRepository.getEventConditionChangeLogBySlug(canonicalEventSlug),
  ])

  const { data: event, error } = eventResult
  if (error || !event) {
    notFound()
  }

  if (changeLogResult.error) {
    console.warn('Failed to load event change log:', changeLogResult.error)
  }

  let seriesEvents: EventSeriesEntry[] = []
  let liveChartConfig: EventLiveChartConfig | null = null

  if (event.series_slug) {
    const [seriesEventsResult, liveChartConfigResult] = await Promise.all([
      EventRepository.getSeriesEventsBySeriesSlug(event.series_slug),
      EventRepository.getLiveChartConfigBySeriesSlug(event.series_slug),
    ])

    if (seriesEventsResult.error) {
      console.warn('Failed to load event series events:', seriesEventsResult.error)
    }
    else {
      seriesEvents = seriesEventsResult.data ?? []
    }

    if (liveChartConfigResult.error) {
      console.warn('Failed to load event live chart config:', liveChartConfigResult.error)
    }
    else {
      liveChartConfig = liveChartConfigResult.data ?? null
    }
  }

  if (event.series_slug && !seriesEvents.some(seriesEvent => seriesEvent.slug === event.slug)) {
    seriesEvents = [
      {
        id: event.id,
        slug: event.slug,
        status: event.status,
        end_date: event.end_date,
        resolved_at: event.resolved_at ?? null,
        created_at: event.created_at,
        resolved_direction: null,
      },
      ...seriesEvents,
    ]
  }

  return (
    <EventContent
      event={event}
      changeLogEntries={changeLogResult.data ?? []}
      user={user}
      marketContextEnabled={marketContextEnabled}
      seriesEvents={seriesEvents}
      liveChartConfig={liveChartConfig}
      key={`is-bookmarked-${event.is_bookmarked}`}
    />
  )
}
