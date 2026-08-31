'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { z } from 'zod'

import { loadAutomaticTranslationsEnabled, loadEnabledLocales } from '@/i18n/locale-settings'
import { loadOpenRouterProviderSettings } from '@/lib/ai/market-context-config'
import { cacheTags } from '@/lib/cache-tags'
import { EventRepository } from '@/lib/db/queries/event'
import { UserRepository } from '@/lib/db/queries/user'
import { translateEventAdditionalContext } from '@/lib/translations/event-additional-context'
import { isNonDefaultLocale } from '@/lib/translations/jobs'

const AdditionalContextSchema = z.string().max(10_000, 'Additional context is too long.')

export interface UpdateEventAdditionalContextResult {
  success: boolean
  data?: {
    id: string
    slug: string
    additional_context: string | null
    additional_context_updated_at: string | null
  }
  error?: string
}

function containsHtmlTags(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value)
}

function normalizeAdditionalContext(value: string): { value: string | null; error: string | null } {
  const parsed = AdditionalContextSchema.safeParse(value)
  if (!parsed.success) {
    return {
      value: null,
      error: parsed.error.issues[0]?.message ?? 'Invalid additional context.',
    }
  }

  const trimmed = parsed.data.trim()
  if (!trimmed) {
    return { value: null, error: null }
  }

  if (containsHtmlTags(trimmed)) {
    return { value: null, error: 'Additional context must be plain text only.' }
  }

  return { value: trimmed, error: null }
}

export async function updateEventAdditionalContextAction(
  eventId: string,
  additionalContext: string,
): Promise<UpdateEventAdditionalContextResult> {
  try {
    const currentUser = await UserRepository.getCurrentUser({ minimal: true })
    if (!currentUser || !currentUser.is_admin) {
      return {
        success: false,
        error: 'Unauthorized. Admin access required.',
      }
    }

    const normalized = normalizeAdditionalContext(additionalContext)
    if (normalized.error) {
      return {
        success: false,
        error: normalized.error,
      }
    }

    const updatedAt = normalized.value ? new Date() : null
    const { data, error } = await EventRepository.setEventAdditionalContext(eventId, normalized.value, updatedAt)

    if (error || !data) {
      return {
        success: false,
        error: error ?? 'Failed to update additional context.',
      }
    }

    const translations: Record<string, string> = {}
    try {
      if (normalized.value) {
        const [automaticTranslationsEnabled, enabledLocales, openRouterSettings] = await Promise.all([
          loadAutomaticTranslationsEnabled(),
          loadEnabledLocales(),
          loadOpenRouterProviderSettings(),
        ])

        if (automaticTranslationsEnabled && openRouterSettings.configured && openRouterSettings.apiKey) {
          const locales = enabledLocales.filter(isNonDefaultLocale)
          const translationResults = await Promise.allSettled(
            locales.map(async (locale) => ({
              locale,
              value: await translateEventAdditionalContext(normalized.value!, locale, {
                apiKey: openRouterSettings.apiKey!,
                model: openRouterSettings.translationModel || openRouterSettings.model,
              }),
            })),
          )

          for (const result of translationResults) {
            if (result.status === 'fulfilled') {
              translations[result.value.locale] = result.value.value
            } else {
              console.error('Additional context translation failed:', result.reason)
            }
          }
        }
      }
    } catch (translationError) {
      console.error('Additional context translation setup failed:', translationError)
    }

    const translationUpdate = await EventRepository.updateEventAdditionalContextTranslationsById(
      eventId,
      normalized.value,
      translations,
    )
    if (translationUpdate.error) {
      console.error('Additional context translations could not be saved:', translationUpdate.error)
    }

    revalidatePath('/[locale]/admin/events', 'page')
    revalidatePath('/[locale]/event/[slug]', 'page')
    revalidatePath('/[locale]/event/[slug]/[market]', 'page')
    updateTag(cacheTags.eventsList)
    updateTag(cacheTags.event(data.slug))

    return {
      success: true,
      data,
    }
  } catch (error) {
    console.error('Server action error:', error)
    return {
      success: false,
      error: 'Internal server error. Please try again.',
    }
  }
}
