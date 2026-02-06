'use server'

import type { NonDefaultLocale } from '@/i18n/locales'
import { revalidatePath, updateTag } from 'next/cache'
import { z } from 'zod'
import { NON_DEFAULT_LOCALES, SUPPORTED_LOCALES } from '@/i18n/locales'
import { cacheTags } from '@/lib/cache-tags'
import { TagRepository } from '@/lib/db/queries/tag'
import { UserRepository } from '@/lib/db/queries/user'

const updateCategoryTranslationsShape = NON_DEFAULT_LOCALES.reduce(
  (shape, locale) => {
    shape[locale] = z.string().optional()
    return shape
  },
  {} as Record<NonDefaultLocale, z.ZodOptional<z.ZodString>>,
)

const UpdateCategoryTranslationsInputSchema = z.object(updateCategoryTranslationsShape)

export interface UpdateCategoryTranslationsResult {
  success: boolean
  data?: Partial<Record<NonDefaultLocale, string>>
  error?: string
}

export async function updateCategoryTranslationsAction(
  categoryId: number,
  input: Partial<Record<NonDefaultLocale, string>>,
): Promise<UpdateCategoryTranslationsResult> {
  try {
    const parsed = UpdateCategoryTranslationsInputSchema.safeParse(input)
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? 'Invalid input.',
      }
    }

    const currentUser = await UserRepository.getCurrentUser()
    if (!currentUser || !currentUser.is_admin) {
      return {
        success: false,
        error: 'Unauthorized. Admin access required.',
      }
    }

    const normalizedInput = NON_DEFAULT_LOCALES.reduce<Partial<Record<NonDefaultLocale, string>>>((acc, locale) => {
      const value = parsed.data[locale]
      if (typeof value === 'string') {
        acc[locale] = value
      }
      return acc
    }, {})

    const { data, error } = await TagRepository.updateTagTranslationsById(categoryId, normalizedInput)

    if (error || !data) {
      console.error('Error updating category translations:', error)
      return {
        success: false,
        error: 'Failed to update category translations. Please try again.',
      }
    }

    revalidatePath('/[locale]/admin/categories', 'page')
    revalidatePath('/[locale]', 'layout')
    updateTag(cacheTags.adminCategories)
    updateTag(cacheTags.eventsGlobal)
    updateTag(cacheTags.events(currentUser.id))

    for (const locale of SUPPORTED_LOCALES) {
      updateTag(cacheTags.mainTags(locale))
    }

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
