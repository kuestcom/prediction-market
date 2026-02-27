'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { z } from 'zod'
import { cacheTags } from '@/lib/cache-tags'
import { EventRepository } from '@/lib/db/queries/event'
import { UserRepository } from '@/lib/db/queries/user'

const SportsFinalStateSchema = z.object({
  eventId: z.string().trim().min(1, 'Event id is required.'),
  sportsEnded: z.boolean(),
  sportsScore: z.string().max(64, 'Score is too long.').optional(),
})

export interface UpdateEventSportsFinalStateResult {
  success: boolean
  data?: {
    id: string
    slug: string
    sports_score: string | null
    sports_live: boolean | null
    sports_ended: boolean | null
  }
  error?: string
}

export async function updateEventSportsFinalStateAction(
  eventId: string,
  payload: {
    sportsEnded: boolean
    sportsScore: string
  },
): Promise<UpdateEventSportsFinalStateResult> {
  try {
    const currentUser = await UserRepository.getCurrentUser()
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
    })
    if (!parsedPayload.success) {
      return {
        success: false,
        error: parsedPayload.error.issues[0]?.message ?? 'Invalid request payload.',
      }
    }

    const normalizedScore = parsedPayload.data.sportsScore?.trim() || null
    const { data, error } = await EventRepository.setEventSportsFinalState(parsedPayload.data.eventId, {
      sportsEnded: parsedPayload.data.sportsEnded,
      sportsScore: normalizedScore,
    })

    if (error || !data) {
      return {
        success: false,
        error: error ?? 'Failed to update sports final status.',
      }
    }

    revalidatePath('/[locale]/admin/events', 'page')
    updateTag(cacheTags.eventsGlobal)
    updateTag(cacheTags.event(data.slug))

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
