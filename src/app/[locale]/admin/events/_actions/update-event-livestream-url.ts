'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { z } from 'zod'
import { cacheTags } from '@/lib/cache-tags'
import { EventRepository } from '@/lib/db/queries/event'
import { UserRepository } from '@/lib/db/queries/user'

const LivestreamUrlSchema = z.string().trim().url('Invalid livestream URL.')

export interface UpdateEventLivestreamUrlResult {
  success: boolean
  data?: {
    id: string
    slug: string
    livestream_url: string | null
  }
  error?: string
}

function normalizeLivestreamUrl(value: string): { value: string | null, error: string | null } {
  const trimmed = value.trim()
  if (!trimmed) {
    return { value: null, error: null }
  }

  const parsed = LivestreamUrlSchema.safeParse(trimmed)
  if (!parsed.success) {
    return { value: null, error: parsed.error.issues[0]?.message ?? 'Invalid livestream URL.' }
  }

  const url = new URL(parsed.data)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { value: null, error: 'Livestream URL must start with http:// or https://.' }
  }

  return { value: parsed.data, error: null }
}

export async function updateEventLivestreamUrlAction(
  eventId: string,
  livestreamUrl: string,
): Promise<UpdateEventLivestreamUrlResult> {
  try {
    const currentUser = await UserRepository.getCurrentUser()
    if (!currentUser || !currentUser.is_admin) {
      return {
        success: false,
        error: 'Unauthorized. Admin access required.',
      }
    }

    const normalized = normalizeLivestreamUrl(livestreamUrl)
    if (normalized.error) {
      return {
        success: false,
        error: normalized.error,
      }
    }

    const { data, error } = await EventRepository.setEventLivestreamUrl(eventId, normalized.value)
    if (error || !data) {
      return {
        success: false,
        error: error ?? 'Failed to update livestream URL.',
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
