'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { z } from 'zod'
import { cacheTags } from '@/lib/cache-tags'
import { EventRepository } from '@/lib/db/queries/event'
import { UserRepository } from '@/lib/db/queries/user'
import { normalizeSingleSportsSourceProvider } from '@/lib/sports-source/providers'

const SportsFinalStateSchema = z.object({
  eventId: z.string().trim().min(1, 'Event id is required.'),
  sportsEnded: z.boolean(),
  sportsScore: z.string().max(64, 'Score is too long.').optional(),
  sportsSource: z.object({
    provider: z.string().trim().max(64).nullable().optional(),
    eventId: z.string().trim().max(128).nullable().optional(),
    gameId: z.string().trim().max(128).nullable().optional(),
    leagueId: z.string().trim().max(128).nullable().optional(),
    leagueLabel: z.string().trim().max(180).nullable().optional(),
    matchConfidence: z.number().min(0).max(1).nullable().optional(),
    payload: z.record(z.string(), z.unknown()).nullable().optional(),
  }).optional(),
  livestreamUrl: z.preprocess(
    value => typeof value === 'string' && value.trim() === '' ? null : value,
    z.string().trim().url('Invalid livestream URL.').nullable().optional(),
  ),
})

export interface UpdateEventSportsFinalStateResult {
  success: boolean
  data?: {
    id: string
    slug: string
    sports_score: string | null
    sports_live: boolean | null
    sports_ended: boolean | null
    sports_source_provider: string | null
    sports_source_event_id: string | null
    sports_source_game_id: string | null
    sports_source_league_id: string | null
    sports_source_league_label: string | null
    sports_source_match_confidence: string | null
  }
  error?: string
}

export async function updateEventSportsFinalStateAction(
  eventId: string,
  payload: {
    sportsEnded: boolean
    sportsScore: string
    sportsSource?: {
      provider?: string | null
      eventId?: string | null
      gameId?: string | null
      leagueId?: string | null
      leagueLabel?: string | null
      matchConfidence?: number | null
      payload?: Record<string, unknown> | null
    }
    livestreamUrl?: string | null
  },
): Promise<UpdateEventSportsFinalStateResult> {
  try {
    const currentUser = await UserRepository.getCurrentUser({ minimal: true })
    if (!currentUser || !currentUser.is_admin) {
      return {
        success: false,
        error: 'Unauthorized. Admin access required.',
      }
    }

    const parsedPayload = SportsFinalStateSchema.safeParse({
      eventId,
      sportsEnded: payload.sportsEnded,
      sportsScore: payload.sportsScore,
      sportsSource: payload.sportsSource,
      livestreamUrl: payload.livestreamUrl,
    })
    if (!parsedPayload.success) {
      return {
        success: false,
        error: parsedPayload.error.issues[0]?.message ?? 'Invalid request payload.',
      }
    }

    const normalizedScore = parsedPayload.data.sportsScore?.trim() || null
    const parsedSportsSource = parsedPayload.data.sportsSource
    const rawSportsSourceProvider = parsedSportsSource?.provider?.trim() ?? ''
    const normalizedSportsSourceProvider = normalizeSingleSportsSourceProvider(rawSportsSourceProvider)
    if (rawSportsSourceProvider && !normalizedSportsSourceProvider) {
      return {
        success: false,
        error: 'Unsupported sports source provider.',
      }
    }

    const normalizedSportsSource = parsedSportsSource
      ? {
          provider: normalizedSportsSourceProvider,
          eventId: parsedSportsSource.eventId?.trim() || null,
          gameId: parsedSportsSource.gameId?.trim() || null,
          leagueId: parsedSportsSource.leagueId?.trim() || null,
          leagueLabel: parsedSportsSource.leagueLabel?.trim() || null,
          matchConfidence: typeof parsedSportsSource.matchConfidence === 'number'
            ? parsedSportsSource.matchConfidence.toFixed(4)
            : null,
          ...('payload' in parsedSportsSource ? { payload: parsedSportsSource.payload ?? null } : {}),
        }
      : undefined
    const hasLivestreamUrlPayload = Object.hasOwn(payload, 'livestreamUrl')
    const normalizedLivestreamUrl = hasLivestreamUrlPayload
      ? parsedPayload.data.livestreamUrl?.trim() || null
      : undefined
    const { data, error } = await EventRepository.setEventSportsFinalState(parsedPayload.data.eventId, {
      sportsEnded: parsedPayload.data.sportsEnded,
      sportsScore: normalizedScore,
      sportsSource: normalizedSportsSource,
      livestreamUrl: normalizedLivestreamUrl,
    })

    if (error || !data) {
      return {
        success: false,
        error: error ?? 'Failed to update sports final status.',
      }
    }

    revalidatePath('/[locale]/admin/events', 'page')
    updateTag(cacheTags.eventsList)
    updateTag(cacheTags.event(data.slug))
    updateTag(cacheTags.sportsMenu)

    return {
      success: true,
      data,
    }
  }
  catch (error) {
    console.error('Server action error:', error)
    return {
      success: false,
      error: 'Internal server error. Please try again.',
    }
  }
}
