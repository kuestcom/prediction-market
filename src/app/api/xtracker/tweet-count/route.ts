import { NextResponse } from 'next/server'

const XTRACKER_API_BASE_URL = 'https://xtracker.polymarket.com/api'
const XTRACKER_PLATFORM = 'X'

const SERIES_SLUG_TO_HANDLES: Record<string, string[]> = {
  'elon-tweets-48h': ['elonmusk'],
}

const HANDLE_ALIASES: Array<{ pattern: RegExp, handles: string[] }> = [
  { pattern: /\belon\b/i, handles: ['elonmusk'] },
  { pattern: /\b(cobratate|andrew-tate|andrew tate|tate)\b/i, handles: ['Cobratate'] },
]

interface XTrackerTweetData {
  totalBetweenStartAndEnd?: number | string | null
}

interface XTrackerTracking {
  id?: string
  title?: string | null
  startDate?: string | null
  endDate?: string | null
  isActive?: boolean
  tweetData?: XTrackerTweetData | null
}

interface XTrackerTrackingsPayload {
  success?: boolean
  data?: XTrackerTracking[]
  error?: string
}

interface XTrackerStatsUser {
  handle?: string | null
  startDate?: string | null
  endDate?: string | null
  tweetData?: XTrackerTweetData | null
}

interface CandidateTracking {
  handle: string
  title: string | null
  startMs: number
  endMs: number
  isActive: boolean
  totalCount: number | null
}

function parseTimestampToMs(value: string | null | undefined): number | null {
  if (!value) {
    return null
  }

  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function toNonNegativeNumber(value: unknown): number | null {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric) || numeric < 0) {
    return null
  }
  return numeric
}

function toNormalizedString(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? ''
}

function parseSeriesDurationMs(seriesSlug: string | null): number | null {
  if (!seriesSlug) {
    return null
  }

  const normalized = toNormalizedString(seriesSlug)
  const match = normalized.match(/(\d+)\s*([hdw])\b/)
  if (!match) {
    return null
  }

  const amount = Number.parseInt(match[1], 10)
  if (!Number.isFinite(amount) || amount <= 0) {
    return null
  }

  const unit = match[2]
  if (unit === 'h') {
    return amount * 60 * 60 * 1000
  }
  if (unit === 'd') {
    return amount * 24 * 60 * 60 * 1000
  }
  if (unit === 'w') {
    return amount * 7 * 24 * 60 * 60 * 1000
  }

  return null
}

function resolveCandidateHandles({
  seriesSlug,
  eventSlug,
  eventTitle,
}: {
  seriesSlug: string | null
  eventSlug: string | null
  eventTitle: string | null
}) {
  const normalizedSeriesSlug = toNormalizedString(seriesSlug)
  const matches = new Set<string>()

  if (normalizedSeriesSlug && SERIES_SLUG_TO_HANDLES[normalizedSeriesSlug]) {
    SERIES_SLUG_TO_HANDLES[normalizedSeriesSlug].forEach(handle => matches.add(handle))
  }

  const searchableText = [
    normalizedSeriesSlug,
    toNormalizedString(eventSlug),
    toNormalizedString(eventTitle),
  ].join(' ')

  HANDLE_ALIASES.forEach(({ pattern, handles }) => {
    if (!searchableText || !pattern.test(searchableText)) {
      return
    }
    handles.forEach(handle => matches.add(handle))
  })

  return Array.from(matches)
}

function normalizeTracking(
  handle: string,
  tracking: XTrackerTracking,
): CandidateTracking | null {
  const startMs = parseTimestampToMs(tracking.startDate)
  const endMs = parseTimestampToMs(tracking.endDate)

  if (startMs == null || endMs == null || endMs <= startMs) {
    return null
  }

  return {
    handle,
    title: tracking.title?.trim() || null,
    startMs,
    endMs,
    isActive: Boolean(tracking.isActive),
    totalCount: toNonNegativeNumber(tracking.tweetData?.totalBetweenStartAndEnd),
  }
}

function scoreTrackingCandidate(
  candidate: CandidateTracking,
  targetEndMs: number | null,
  expectedDurationMs: number | null,
) {
  let score = 0

  if (targetEndMs != null) {
    score += Math.abs(candidate.endMs - targetEndMs)
  }

  if (expectedDurationMs != null) {
    const candidateDuration = candidate.endMs - candidate.startMs
    score += Math.abs(candidateDuration - expectedDurationMs) * 0.6
  }

  if (candidate.isActive) {
    score -= 5 * 60 * 1000
  }

  return score
}

function selectBestTracking(
  candidates: CandidateTracking[],
  targetEndMs: number | null,
  expectedDurationMs: number | null,
): CandidateTracking | null {
  if (candidates.length === 0) {
    return null
  }

  return candidates
    .slice()
    .sort((left, right) => {
      const leftScore = scoreTrackingCandidate(left, targetEndMs, expectedDurationMs)
      const rightScore = scoreTrackingCandidate(right, targetEndMs, expectedDurationMs)
      if (leftScore !== rightScore) {
        return leftScore - rightScore
      }
      return right.endMs - left.endMs
    })[0] ?? null
}

async function fetchTrackingsForHandle(handle: string): Promise<XTrackerTracking[]> {
  const endpoint = `${XTRACKER_API_BASE_URL}/users/${encodeURIComponent(handle)}/trackings?activeOnly=true&platform=${XTRACKER_PLATFORM}`
  const response = await fetch(endpoint, {
    cache: 'no-store',
    headers: {
      accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`xtracker request failed: ${response.status}`)
  }

  const payload = await response.json() as XTrackerTrackingsPayload
  if (!payload.success || !Array.isArray(payload.data)) {
    return []
  }

  return payload.data
}

async function fetchStatsUsers(): Promise<XTrackerStatsUser[]> {
  const endpoint = `${XTRACKER_API_BASE_URL}/users?stats=true&platform=${XTRACKER_PLATFORM}`
  const response = await fetch(endpoint, {
    cache: 'no-store',
    headers: {
      accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`xtracker stats request failed: ${response.status}`)
  }

  const payload = await response.json() as unknown
  if (Array.isArray(payload)) {
    return payload as XTrackerStatsUser[]
  }

  if (
    payload
    && typeof payload === 'object'
    && 'data' in payload
    && Array.isArray((payload as { data?: unknown }).data)
  ) {
    return (payload as { data: XTrackerStatsUser[] }).data
  }

  return []
}

function resolveCountFromStatsUsers(
  statsUsers: XTrackerStatsUser[],
  target: CandidateTracking,
): number | null {
  const matched = statsUsers.find((entry) => {
    const sameHandle = toNormalizedString(entry.handle) === toNormalizedString(target.handle)
    if (!sameHandle) {
      return false
    }

    const startMs = parseTimestampToMs(entry.startDate)
    const endMs = parseTimestampToMs(entry.endDate)
    return startMs === target.startMs && endMs === target.endMs
  })

  return toNonNegativeNumber(matched?.tweetData?.totalBetweenStartAndEnd)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const seriesSlug = searchParams.get('seriesSlug')?.trim() ?? null
  const eventSlug = searchParams.get('eventSlug')?.trim() ?? null
  const eventTitle = searchParams.get('eventTitle')?.trim() ?? null
  const eventEndMsParam = searchParams.get('eventEndMs')?.trim() ?? null
  const eventEndMs = eventEndMsParam ? toNonNegativeNumber(eventEndMsParam) : null

  const handles = resolveCandidateHandles({
    seriesSlug,
    eventSlug,
    eventTitle,
  })

  if (handles.length === 0) {
    return NextResponse.json({
      error: 'No XTracker handles configured for this event.',
      data: null,
    }, { status: 404 })
  }

  try {
    const expectedDurationMs = parseSeriesDurationMs(seriesSlug)
    const statsUsers = await fetchStatsUsers()
    const perHandle = await Promise.all(handles.map(async (handle) => {
      const trackings = await fetchTrackingsForHandle(handle)
      const normalized = trackings
        .map(tracking => normalizeTracking(handle, tracking))
        .filter((entry): entry is CandidateTracking => entry != null)

      return selectBestTracking(normalized, eventEndMs, expectedDurationMs)
    }))

    const selectedTrackings = perHandle.filter((entry): entry is CandidateTracking => entry != null)
    if (selectedTrackings.length === 0) {
      return NextResponse.json({
        error: 'No matching XTracker tracking found for this event.',
        data: null,
      }, { status: 404 })
    }

    const totalCount = selectedTrackings.reduce((sum, entry) => {
      const resolvedCount = entry.totalCount ?? resolveCountFromStatsUsers(statsUsers, entry) ?? 0
      return sum + resolvedCount
    }, 0)

    const countdownEndMs = selectedTrackings.reduce<number | null>((current, entry) => {
      if (current == null) {
        return entry.endMs
      }
      return Math.min(current, entry.endMs)
    }, null)

    return NextResponse.json({
      data: {
        totalCount,
        handles: selectedTrackings.map(entry => entry.handle),
        trackingEndMs: countdownEndMs,
        trackingStartMs: selectedTrackings.reduce<number | null>((current, entry) => {
          if (current == null) {
            return entry.startMs
          }
          return Math.min(current, entry.startMs)
        }, null),
      },
    })
  }
  catch (error) {
    console.error('Failed to fetch XTracker tweet count.', error)
    return NextResponse.json({
      error: 'Failed to fetch XTracker tweet count.',
      data: null,
    }, { status: 500 })
  }
}
