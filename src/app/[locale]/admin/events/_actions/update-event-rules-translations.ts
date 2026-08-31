'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { z } from 'zod'

import type { NonDefaultLocale } from '@/i18n/locales'
import type { EventRulesTranslationsMap } from '@/lib/db/queries/event'

import { NON_DEFAULT_LOCALES } from '@/i18n/locales'
import { cacheTags } from '@/lib/cache-tags'
import { EventRepository } from '@/lib/db/queries/event'
import { UserRepository } from '@/lib/db/queries/user'

const UpdateEventRulesTranslationsInputSchema = z.object(
  NON_DEFAULT_LOCALES.reduce(
    (shape, locale) => {
      shape[locale] = z.string().max(100_000)
      return shape
    },
    {} as Record<NonDefaultLocale, z.ZodString>,
  ),
)

export interface UpdateEventRulesTranslationsResult {
  success: boolean
  data?: EventRulesTranslationsMap
  error?: string
}

export type EventRulesTranslationsInput = Record<NonDefaultLocale, string>

export async function updateEventRulesTranslationsAction(
  eventId: string,
  input: EventRulesTranslationsInput,
): Promise<UpdateEventRulesTranslationsResult> {
  try {
    const parsed = UpdateEventRulesTranslationsInputSchema.safeParse(input)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
    }

    const currentUser = await UserRepository.getCurrentUser({ minimal: true })
    if (!currentUser || !currentUser.is_admin) {
      return { success: false, error: 'Unauthorized. Admin access required.' }
    }

    const normalizedInput = NON_DEFAULT_LOCALES.reduce<EventRulesTranslationsMap>((acc, locale) => {
      acc[locale] = parsed.data[locale] ?? ''
      return acc
    }, {})
    const { data, error } = await EventRepository.updateEventRulesTranslationsById(eventId, normalizedInput)
    if (error || !data) {
      console.error('Error updating event Rules translations:', error)
      return { success: false, error: 'Failed to update event Rules translations. Please try again.' }
    }

    revalidatePath('/[locale]/admin/events', 'page')
    revalidatePath('/[locale]/event/[slug]', 'page')
    updateTag(cacheTags.eventsList)
    updateTag(cacheTags.event(data.slug))
    updateTag(cacheTags.events(currentUser.id))

    return { success: true, data: data.rulesTranslations }
  } catch (error) {
    console.error('Server action error:', error)
    return { success: false, error: 'Internal server error. Please try again.' }
  }
}
