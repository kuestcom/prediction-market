'use server'

import type { NonDefaultLocale } from '@/i18n/locales'
import { revalidatePath, updateTag } from 'next/cache'
import { z } from 'zod'
import { SUPPORTED_LOCALES } from '@/i18n/locales'
import { cacheTags } from '@/lib/cache-tags'
import { TagRepository } from '@/lib/db/queries/tag'
import { UserRepository } from '@/lib/db/queries/user'

const UpdateCategoryInputSchema = z.object({
  is_main_category: z.boolean().optional(),
  is_hidden: z.boolean().optional(),
  hide_events: z.boolean().optional(),
})

export interface UpdateCategoryInput {
  is_main_category?: boolean
  is_hidden?: boolean
  hide_events?: boolean
}

export interface UpdateCategoryResult {
  success: boolean
  data?: {
    id: number
    name: string
    slug: string
    is_main_category: boolean
    is_hidden: boolean
    display_order: number
    active_markets_count: number
    created_at: string
    updated_at: string
    translations: Partial<Record<NonDefaultLocale, string>>
  }
  error?: string
}

export async function updateCategoryAction(
  categoryId: number,
  input: UpdateCategoryInput,
): Promise<UpdateCategoryResult> {
  try {
    const parsed = UpdateCategoryInputSchema.safeParse(input)
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

    const { data, error } = await TagRepository.updateTagById(categoryId, parsed.data)

    if (error || !data) {
      console.error('Error updating category:', error)
      return {
        success: false,
        error: 'Failed to update category. Please try again.',
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
