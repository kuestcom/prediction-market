'use server'

import type { MainCategoryOrderRow } from '@/lib/db/queries/tag'
import { revalidatePath, updateTag } from 'next/cache'
import { z } from 'zod'
import { SUPPORTED_LOCALES } from '@/i18n/locales'
import { cacheTags } from '@/lib/cache-tags'
import { TagRepository } from '@/lib/db/queries/tag'
import { UserRepository } from '@/lib/db/queries/user'

const MainCategoryOrderSchema = z.array(z.number().int().positive())
  .min(1, 'At least one main category is required.')
  .refine(ids => new Set(ids).size === ids.length, {
    message: 'Duplicate categories are not allowed.',
  })

export interface MainCategoryOrderListResult {
  success: boolean
  data?: MainCategoryOrderRow[]
  error?: string
}

export interface UpdateMainCategoryOrderResult {
  success: boolean
  error?: string
}

function revalidateCategoryCaches(userId: string) {
  revalidatePath('/[locale]/admin/categories', 'page')
  revalidatePath('/[locale]', 'layout')
  updateTag(cacheTags.adminCategories)
  updateTag(cacheTags.eventsGlobal)
  updateTag(cacheTags.events(userId))

  for (const locale of SUPPORTED_LOCALES) {
    updateTag(cacheTags.mainTags(locale))
  }
}

export async function getMainCategoriesForOrderingAction(): Promise<MainCategoryOrderListResult> {
  try {
    const currentUser = await UserRepository.getCurrentUser()
    if (!currentUser || !currentUser.is_admin) {
      return {
        success: false,
        error: 'Unauthorized. Admin access required.',
      }
    }

    const { data, error } = await TagRepository.listMainCategoriesForOrdering()
    if (error) {
      console.error('Error loading main category order:', error)
      return {
        success: false,
        error: 'Failed to load main categories. Please try again.',
      }
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

export async function updateMainCategoriesDisplayOrderAction(categoryIds: number[]): Promise<UpdateMainCategoryOrderResult> {
  try {
    const parsed = MainCategoryOrderSchema.safeParse(categoryIds)
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

    const { data: currentCategories, error: currentCategoriesError } = await TagRepository.listMainCategoriesForOrdering()
    if (currentCategoriesError) {
      console.error('Error validating main category order:', currentCategoriesError)
      return {
        success: false,
        error: 'Failed to validate main categories. Please try again.',
      }
    }

    const currentCategoryIds = currentCategories.map(category => category.id)
    const nextCategoryIds = parsed.data
    const currentCategoryIdSet = new Set(currentCategoryIds)

    if (
      currentCategoryIds.length !== nextCategoryIds.length
      || nextCategoryIds.some(categoryId => !currentCategoryIdSet.has(categoryId))
    ) {
      return {
        success: false,
        error: 'Main categories changed. Reopen the sorter and try again.',
      }
    }

    const { error } = await TagRepository.updateMainCategoriesDisplayOrder(nextCategoryIds)
    if (error) {
      console.error('Error updating main category order:', error)
      return {
        success: false,
        error: 'Failed to update main category order. Please try again.',
      }
    }

    revalidateCategoryCaches(currentUser.id)

    return {
      success: true,
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
