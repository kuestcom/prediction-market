import type { SupportedLocale } from '@/i18n/locales'
import type { EventSeriesEntry } from '@/types'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { redirect } from '@/i18n/navigation'
import { EventRepository } from '@/lib/db/queries/event'
import { STATIC_PARAMS_PLACEHOLDER } from '@/lib/static-params'

const LIVE_TRADING_WINDOW_MS = 24 * 60 * 60 * 1000

function parseSeriesEventTimestamp(event: EventSeriesEntry) {
  const candidates = [event.end_date, event.resolved_at, event.created_at]
  for (const value of candidates) {
    if (!value) {
      continue
    }
    const timestamp = Date.parse(value)
    if (Number.isFinite(timestamp)) {
      return timestamp
    }
  }
  return Number.NaN
}

function pickMostCurrentSeriesEvent(events: EventSeriesEntry[], nowTimestamp = Date.now()) {
  if (!events.length) {
    return null
  }

  const unresolved = events.filter(event => event.status !== 'resolved')
  const unresolvedWithTimestamp = unresolved
    .map(event => ({ event, timestamp: parseSeriesEventTimestamp(event) }))
    .filter((entry): entry is { event: EventSeriesEntry, timestamp: number } => Number.isFinite(entry.timestamp))

  const liveTradingNow = unresolvedWithTimestamp
    .filter(({ timestamp }) =>
      nowTimestamp >= timestamp - LIVE_TRADING_WINDOW_MS && nowTimestamp < timestamp,
    )
    .sort((a, b) => a.timestamp - b.timestamp)[0]
  if (liveTradingNow) {
    return liveTradingNow.event
  }

  const upcoming = unresolvedWithTimestamp
    .filter(({ timestamp }) => timestamp > nowTimestamp)
    .sort((a, b) => a.timestamp - b.timestamp)[0]
  if (upcoming) {
    return upcoming.event
  }

  const unresolvedMostRecent = unresolvedWithTimestamp
    .filter(({ timestamp }) => timestamp <= nowTimestamp)
    .sort((a, b) => b.timestamp - a.timestamp)[0]
  if (unresolvedMostRecent) {
    return unresolvedMostRecent.event
  }

  if (unresolved.length > 0) {
    return unresolved[0] ?? null
  }

  const resolvedMostRecent = events
    .map(event => ({ event, timestamp: parseSeriesEventTimestamp(event) }))
    .filter((entry): entry is { event: EventSeriesEntry, timestamp: number } => Number.isFinite(entry.timestamp))
    .sort((a, b) => b.timestamp - a.timestamp)[0]

  return resolvedMostRecent?.event ?? events[0] ?? null
}

interface SeriesPageProps {
  params: Promise<{ locale: string, slug: string }>
}

export async function generateStaticParams() {
  return [{ slug: STATIC_PARAMS_PLACEHOLDER }]
}

export default async function SeriesPage({ params }: SeriesPageProps) {
  const { locale, slug } = await params
  setRequestLocale(locale)

  if (slug === STATIC_PARAMS_PLACEHOLDER) {
    notFound()
  }

  const normalizedSeriesSlug = slug.trim()
  if (!normalizedSeriesSlug) {
    notFound()
  }

  const seriesEventsResult = await EventRepository.getSeriesEventsBySeriesSlug(normalizedSeriesSlug)
  if (seriesEventsResult.error) {
    notFound()
  }

  const targetEvent = pickMostCurrentSeriesEvent(seriesEventsResult.data ?? [])
  if (!targetEvent?.slug) {
    notFound()
  }

  const resolvedLocale = locale as SupportedLocale
  redirect({
    href: `/event/${targetEvent.slug}`,
    locale: resolvedLocale,
  })
}
