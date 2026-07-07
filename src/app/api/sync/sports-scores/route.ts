import { and, eq, gte, isNotNull, isNull, lte, or } from 'drizzle-orm'
import { revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/auth-cron'
import { cacheTags } from '@/lib/cache-tags'
import {
  event_sports as eventSportsTable,
  events as eventsTable,
} from '@/lib/db/schema'
import { db } from '@/lib/drizzle'
import { resolveSportsEvent } from '@/lib/sports-source'
import { loadSportsSourceProviderSettings } from '@/lib/sports-source/settings'

export const maxDuration = 60

const RECENT_WINDOW_MS = 12 * 60 * 60 * 1000
const UPCOMING_WINDOW_MS = 15 * 60 * 1000
const MAX_EVENTS_PER_RUN = 80

export async function POST(request: Request) {
  if (!isCronAuthorized(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const recentStart = new Date(now.getTime() - RECENT_WINDOW_MS)
  const upcomingEnd = new Date(now.getTime() + UPCOMING_WINDOW_MS)
  const settings = await loadSportsSourceProviderSettings()

  if (!settings.configured) {
    return NextResponse.json({
      checkedCount: 0,
      updatedCount: 0,
      errors: [{ eventId: '', error: 'Sports provider tokens are not configured in admin settings.' }],
    })
  }

  const rows = await db
    .select({
      event_id: eventSportsTable.event_id,
      slug: eventsTable.slug,
      livestream_url: eventsTable.livestream_url,
      sports_source_provider: eventSportsTable.sports_source_provider,
      sports_source_event_id: eventSportsTable.sports_source_event_id,
      sports_source_game_id: eventSportsTable.sports_source_game_id,
      sports_start_time: eventSportsTable.sports_start_time,
      sports_live: eventSportsTable.sports_live,
      sports_ended: eventSportsTable.sports_ended,
      sports_score: eventSportsTable.sports_score,
      sports_period: eventSportsTable.sports_period,
      sports_elapsed: eventSportsTable.sports_elapsed,
    })
    .from(eventSportsTable)
    .innerJoin(eventsTable, eq(eventsTable.id, eventSportsTable.event_id))
    .where(and(
      isNotNull(eventSportsTable.sports_source_provider),
      or(
        isNotNull(eventSportsTable.sports_source_event_id),
        isNotNull(eventSportsTable.sports_source_game_id),
      ),
      or(
        eq(eventSportsTable.sports_live, true),
        and(
          or(
            eq(eventSportsTable.sports_ended, false),
            isNull(eventSportsTable.sports_ended),
          ),
          gte(eventSportsTable.sports_start_time, recentStart),
          lte(eventSportsTable.sports_start_time, upcomingEnd),
        ),
      ),
    ))
    .limit(MAX_EVENTS_PER_RUN)

  let updatedCount = 0
  const errors: Array<{ eventId: string, error: string }> = []

  for (const row of rows) {
    try {
      const candidate = await resolveSportsEvent({
        provider: row.sports_source_provider,
        eventId: row.sports_source_event_id,
        gameId: row.sports_source_game_id,
        auth: settings,
      })

      if (!candidate) {
        continue
      }

      const nextScore = candidate.score ?? row.sports_score ?? null
      const nextPeriod = candidate.period ?? row.sports_period ?? null
      const nextElapsed = candidate.elapsed ?? row.sports_elapsed ?? null
      const nextLive = candidate.live ?? row.sports_live ?? null
      const nextEnded = candidate.ended ?? row.sports_ended ?? null
      const nextLivestreamUrl = candidate.livestreamUrl && !(row.livestream_url ?? '').trim()
        ? candidate.livestreamUrl
        : null
      const changed = nextScore !== (row.sports_score ?? null)
        || nextPeriod !== (row.sports_period ?? null)
        || nextElapsed !== (row.sports_elapsed ?? null)
        || nextLive !== (row.sports_live ?? null)
        || nextEnded !== (row.sports_ended ?? null)
        || nextLivestreamUrl !== null

      if (!changed) {
        continue
      }

      await db
        .update(eventSportsTable)
        .set({
          sports_score: nextScore,
          sports_period: nextPeriod,
          sports_elapsed: nextElapsed,
          sports_live: nextLive,
          sports_ended: nextEnded,
          sports_source_payload: candidate.raw,
          updated_at: new Date(),
        })
        .where(eq(eventSportsTable.event_id, row.event_id))

      if (nextLivestreamUrl) {
        await db
          .update(eventsTable)
          .set({
            livestream_url: nextLivestreamUrl,
            updated_at: new Date(),
          })
          .where(eq(eventsTable.id, row.event_id))
      }

      revalidateTag(cacheTags.event(row.slug), 'max')
      updatedCount += 1
    }
    catch (error) {
      errors.push({
        eventId: row.event_id,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  if (updatedCount > 0) {
    revalidateTag(cacheTags.eventsList, 'max')
    revalidateTag(cacheTags.sportsMenu, 'max')
  }

  return NextResponse.json({
    checkedCount: rows.length,
    updatedCount,
    errors,
  })
}

export async function GET(request: Request) {
  return POST(request)
}
