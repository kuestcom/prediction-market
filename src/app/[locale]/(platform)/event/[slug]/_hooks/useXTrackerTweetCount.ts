import type { XTrackerSource } from '@/app/[locale]/(platform)/event/[slug]/_utils/eventTweetMarkets'
import type { Event } from '@/types'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { resolveXTrackerSource } from '@/app/[locale]/(platform)/event/[slug]/_utils/eventTweetMarkets'

interface TweetCountResponsePayload {
  data?: XTrackerTweetCountData | null
  error?: string
}

export interface XTrackerTweetCountData {
  totalCount?: number | null
  handles?: string[]
  trackingEndMs?: number | null
  trackingStartMs?: number | null
}

function buildXTrackerTweetCountQueryKey(event: Event, source: XTrackerSource | null) {
  return [
    'xtracker-tweet-count',
    event.slug,
    event.series_slug,
    event.start_date,
    event.end_date,
    event.title,
    source?.handle ?? null,
    source?.platform ?? null,
  ]
}

function appendTimestampParam(params: URLSearchParams, key: string, value: string | null | undefined) {
  if (!value) {
    return
  }

  const parsedMs = Date.parse(value)
  if (Number.isFinite(parsedMs)) {
    params.set(key, String(parsedMs))
  }
}

async function fetchXTrackerTweetCount(
  event: Event,
  source: XTrackerSource | null,
  signal?: AbortSignal,
): Promise<XTrackerTweetCountData | null> {
  const params = new URLSearchParams()
  if (event.slug) {
    params.set('eventSlug', event.slug)
  }
  if (event.series_slug) {
    params.set('seriesSlug', event.series_slug)
  }
  if (event.title) {
    params.set('eventTitle', event.title)
  }

  appendTimestampParam(params, 'eventStartMs', event.start_date)
  appendTimestampParam(params, 'eventEndMs', event.end_date)

  if (source?.handle) {
    params.set('handle', source.handle)
  }
  if (source?.platform) {
    params.set('platform', source.platform)
  }

  const response = await fetch(`/api/xtracker/tweet-count?${params.toString()}`, {
    cache: 'no-store',
    signal,
  })

  const payload = await response.json() as TweetCountResponsePayload
  if (!response.ok) {
    if (response.status === 404) {
      return null
    }

    throw new Error(payload.error || 'Failed to fetch XTracker tweet count.')
  }

  return payload.data ?? null
}

export function useXTrackerTweetCount(event: Event, enabled: boolean) {
  const source = useMemo(
    () => resolveXTrackerSource(event),
    [event],
  )

  return useQuery({
    queryKey: buildXTrackerTweetCountQueryKey(event, source),
    enabled,
    staleTime: 120_000,
    refetchInterval: 120_000,
    queryFn: ({ signal }) => fetchXTrackerTweetCount(event, source, signal),
  })
}
