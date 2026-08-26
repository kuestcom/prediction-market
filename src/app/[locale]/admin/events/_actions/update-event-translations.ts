'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { z } from 'zod'

import type { NonDefaultLocale } from '@/i18n/locales'
import type { EventTranslationsMap } from '@/lib/db/queries/event'

import { NON_DEFAULT_LOCALES } from '@/i18n/locales'
import { cacheTags } from '@/lib/cache-tags'
import { EventRepository } from '@/lib/db/queries/event'
import { UserRepository } from '@/lib/db/queries/user'

const updateEventTranslationsShape = NON_DEFAULT_LOCALES.reduce(
  (shape, locale) => {
    shape[locale] = z.string().max(10_000)
    return shape
  },
  {} as Record<NonDefaultLocale, z.ZodString>,
)

const UpdateEventTranslationsInputSchema = z.object(updateEventTranslationsShape)

export interface UpdateEventTranslationsResult {
  success: boolean
  data?: EventTranslationsMap
  error?: string
}

export type EventTranslationsInput = Record<NonDefaultLocale, string>

export async function updateEventTranslationsAction(
  eventId: string,
  input: EventTranslationsInput,
): Promise<UpdateEventTranslationsResult> {
  try {
    const parsed = UpdateEventTranslationsInputSchema.safeParse(input)
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? 'Invalid input.',
      }
    }

    const currentUser = await UserRepository.getCurrentUser({ minimal: true })
    if (!currentUser || !currentUser.is_admin) {
      return {
        success: false,
        error: 'Unauthorized. Admin access required.',
      }
    }

    const normalizedInput = NON_DEFAULT_LOCALES.reduce<EventTranslationsMap>((acc, locale) => {
      const value = parsed.data[locale]
      if (typeof value === 'string') {
        acc[locale] = value
      }
      return acc
    }, {})

    const { data, error } = await EventRepository.updateEventTranslationsById(eventId, normalizedInput)

    if (error || !data) {
      console.error('Error updating event translations:', error)
      return {
        success: false,
        error: 'Failed to update event translations. Please try again.',
      }
    }

    revalidatePath('/[locale]/admin/events', 'page')
    revalidatePath('/[locale]/event/[slug]', 'page')
    updateTag(cacheTags.eventsList)
    updateTag(cacheTags.event(data.slug))
    updateTag(cacheTags.events(currentUser.id))

    return {
      success: true,
      data: data.translations,
    }
  } catch (error) {
    console.error('Server action error:', error)
    return {
      success: false,
      error: 'Internal server error. Please try again.',
    }
  }
}
