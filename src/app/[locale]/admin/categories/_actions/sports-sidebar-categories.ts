'use server'

import { randomUUID } from 'node:crypto'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { revalidatePath, updateTag } from 'next/cache'
import { z } from 'zod'
import { cacheTags } from '@/lib/cache-tags'
import { UserRepository } from '@/lib/db/queries/user'
import { sports_menu_items } from '@/lib/db/schema/events/tables'
import { db } from '@/lib/drizzle'

const SportsSidebarCategoryInputSchema = z.object({
  id: z.string().min(1).max(200).nullable(),
  name: z.string().trim().min(1, 'Category name is required.').max(80),
  slug: z.string()
    .trim()
    .min(1, 'Slug is required.')
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers, and hyphens only.'),
  enabled: z.boolean(),
  featured: z.boolean(),
  position: z.number().int().nonnegative(),
  nestedPosition: z.number().int().nonnegative(),
  parentId: z.string().min(1).max(200).nullable(),
})

const SportsSidebarCategoriesInputSchema = z.array(SportsSidebarCategoryInputSchema)
  .min(1, 'At least one sports category is required.')
  .max(300)
  .superRefine((categories, context) => {
    const ids = new Set<string>()

    categories.forEach((category, index) => {
      if (category.id && ids.has(category.id)) {
        context.addIssue({
          code: 'custom',
          message: 'Duplicate categories are not allowed.',
          path: [index, 'id'],
        })
      }
      if (category.id) {
        ids.add(category.id)
      }
    })
  })

export interface AdminSportsSidebarCategory {
  id: string
  name: string
  slug: string
  enabled: boolean
  featured: boolean
  position: number
  nestedPosition: number
  parentId: string | null
  canHaveChildren: boolean
}

export interface SportsSidebarCategoriesResult {
  success: boolean
  data?: AdminSportsSidebarCategory[]
  error?: string
}

export interface SportsSidebarCategoryInput {
  id: string | null
  name: string
  slug: string
  enabled: boolean
  featured: boolean
  position: number
  nestedPosition: number
  parentId: string | null
}

interface SportsMenuAdminRow {
  id: string
  item_type: string
  label: string | null
  href: string | null
  icon_url: string | null
  menu_slug: string | null
  sort_order: number
  enabled: boolean
  sidebar_category: boolean
  sidebar_enabled: boolean
  sidebar_featured: boolean
  sidebar_sort_order: number
  parent_id: string | null
}

function toAdminCategory(row: SportsMenuAdminRow): AdminSportsSidebarCategory {
  return {
    id: row.id,
    name: row.label ?? '',
    slug: row.menu_slug ?? '',
    enabled: row.sidebar_enabled,
    featured: row.sidebar_featured,
    position: row.sidebar_sort_order,
    nestedPosition: row.sort_order,
    parentId: row.parent_id,
    canHaveChildren: row.parent_id === null,
  }
}

function sortAdminCategories(categories: AdminSportsSidebarCategory[]) {
  return categories.toSorted((a, b) => {
    if (a.featured !== b.featured) {
      return Number(b.featured) - Number(a.featured)
    }
    if (a.featured) {
      return a.position - b.position || a.name.localeCompare(b.name)
    }
    if (Boolean(a.parentId) !== Boolean(b.parentId)) {
      return Number(Boolean(a.parentId)) - Number(Boolean(b.parentId))
    }
    if (a.parentId && b.parentId) {
      return a.parentId.localeCompare(b.parentId)
        || a.nestedPosition - b.nestedPosition
        || a.name.localeCompare(b.name)
    }

    return a.position - b.position || a.name.localeCompare(b.name)
  })
}

async function loadManageableSportsMenuRows() {
  const rows: SportsMenuAdminRow[] = await db
    .select({
      id: sports_menu_items.id,
      item_type: sports_menu_items.item_type,
      label: sports_menu_items.label,
      href: sports_menu_items.href,
      icon_url: sports_menu_items.icon_url,
      menu_slug: sports_menu_items.menu_slug,
      sort_order: sports_menu_items.sort_order,
      enabled: sports_menu_items.enabled,
      sidebar_category: sports_menu_items.sidebar_category,
      sidebar_enabled: sports_menu_items.sidebar_enabled,
      sidebar_featured: sports_menu_items.sidebar_featured,
      sidebar_sort_order: sports_menu_items.sidebar_sort_order,
      parent_id: sports_menu_items.parent_id,
    })
    .from(sports_menu_items)
    .where(eq(sports_menu_items.enabled, true))
    .orderBy(asc(sports_menu_items.sort_order), asc(sports_menu_items.id))

  const topLevelCategoryIds = new Set(rows
    .filter(row => row.sidebar_category && !row.parent_id)
    .map(row => row.id))

  return rows.filter(row => (
    row.item_type === 'link' || row.item_type === 'group'
  ) && Boolean(row.label) && Boolean(row.menu_slug) && (
    row.sidebar_category || Boolean(row.parent_id && topLevelCategoryIds.has(row.parent_id))
  ))
}

async function listSportsSidebarCategories() {
  const rows = await loadManageableSportsMenuRows()

  return sortAdminCategories(rows.map(toAdminCategory))
}

function findDuplicateSlugError(
  categories: SportsSidebarCategoryInput[],
  existingById: Map<string, SportsMenuAdminRow>,
) {
  const categoriesBySlug = new Map<string, SportsSidebarCategoryInput[]>()

  for (const category of categories) {
    const matchingCategories = categoriesBySlug.get(category.slug) ?? []
    matchingCategories.push(category)
    categoriesBySlug.set(category.slug, matchingCategories)
  }

  for (const [slug, matchingCategories] of categoriesBySlug) {
    if (matchingCategories.length === 1) {
      continue
    }

    if (matchingCategories.length !== 2) {
      return `The slug "${slug}" is already used in this sidebar.`
    }

    const [firstCategory, secondCategory] = matchingCategories
    const firstParentId = firstCategory.id
      ? existingById.get(firstCategory.id)?.parent_id ?? firstCategory.parentId
      : firstCategory.parentId
    const secondParentId = secondCategory.id
      ? existingById.get(secondCategory.id)?.parent_id ?? secondCategory.parentId
      : secondCategory.parentId
    const isParentAndChild = firstParentId === secondCategory.id
      || secondParentId === firstCategory.id
    if (!isParentAndChild) {
      return `The slug "${slug}" is already used in this sidebar.`
    }
  }

  return null
}

function buildUpdatedHref(currentHref: string | null, itemType: string, slug: string) {
  if (itemType === 'group') {
    return `/sports/${slug}/games`
  }

  if (itemType !== 'link' || !currentHref?.startsWith('/sports/')) {
    return currentHref
  }

  if (!currentHref.endsWith('/games') && !currentHref.endsWith('/props')) {
    return `/sports/${slug}`
  }

  const section = currentHref.endsWith('/props') ? 'props' : 'games'
  return `/sports/${slug}/${section}`
}

function revalidateSportsSidebar() {
  revalidatePath('/[locale]/admin/categories', 'page')
  revalidatePath('/[locale]/sports', 'layout')
  updateTag(cacheTags.sportsMenu)
}

async function requireAdmin() {
  const currentUser = await UserRepository.getCurrentUser({ minimal: true })
  return Boolean(currentUser?.is_admin)
}

export async function getSportsSidebarCategoriesAction(): Promise<SportsSidebarCategoriesResult> {
  try {
    if (!await requireAdmin()) {
      return { success: false, error: 'Unauthorized. Admin access required.' }
    }

    return {
      success: true,
      data: await listSportsSidebarCategories(),
    }
  }
  catch (error) {
    console.error('Failed to load sports sidebar categories:', error)
    return { success: false, error: 'Failed to load sports sidebar categories. Please try again.' }
  }
}

export async function updateSportsSidebarCategoriesAction(
  input: SportsSidebarCategoryInput[],
): Promise<SportsSidebarCategoriesResult> {
  try {
    const parsed = SportsSidebarCategoriesInputSchema.safeParse(input)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
    }

    if (!await requireAdmin()) {
      return { success: false, error: 'Unauthorized. Admin access required.' }
    }

    const existingRows = await loadManageableSportsMenuRows()
    const existingById = new Map(existingRows.map(row => [row.id, row]))

    if (parsed.data.some(category => category.id && !existingById.has(category.id))) {
      return { success: false, error: 'Sports categories changed. Reopen the manager and try again.' }
    }

    const hasChangedParent = parsed.data.some((category) => {
      const existing = category.id ? existingById.get(category.id) : null
      return existing && existing.parent_id !== category.parentId
    })
    if (hasChangedParent) {
      return { success: false, error: 'Existing sports categories cannot be moved to another parent.' }
    }

    const hasInvalidNewParent = parsed.data.some((category) => {
      if (category.id || !category.parentId) {
        return false
      }

      const parent = existingById.get(category.parentId)
      return !parent
        || parent.parent_id !== null
        || !parent.sidebar_category
    })
    if (hasInvalidNewParent) {
      return { success: false, error: 'Select a valid parent sport for the nested league.' }
    }

    const duplicateSlugError = findDuplicateSlugError(parsed.data, existingById)
    if (duplicateSlugError) {
      return { success: false, error: duplicateSlugError }
    }

    await db.transaction(async (tx) => {
      const categoryIdsToExpose = existingRows
        .filter(row => !row.sidebar_category)
        .map(row => row.id)
      if (categoryIdsToExpose.length > 0) {
        await tx
          .update(sports_menu_items)
          .set({
            sidebar_category: true,
            updated_at: new Date(),
          })
          .where(inArray(sports_menu_items.id, categoryIdsToExpose))
      }

      for (const category of parsed.data) {
        const existing = category.id ? existingById.get(category.id) : null
        if (existing) {
          const updatedHref = buildUpdatedHref(existing.href, existing.item_type, category.slug)
          const hasChanges = existing.label !== category.name
            || existing.href !== updatedHref
            || existing.menu_slug !== category.slug
            || existing.sort_order !== category.nestedPosition
            || existing.sidebar_enabled !== category.enabled
            || existing.sidebar_featured !== category.featured
            || existing.sidebar_sort_order !== category.position
          if (!hasChanges) {
            continue
          }

          await tx
            .update(sports_menu_items)
            .set({
              label: category.name,
              href: updatedHref,
              menu_slug: category.slug,
              h1_title: category.name,
              sort_order: category.nestedPosition,
              sidebar_category: true,
              sidebar_enabled: category.enabled,
              sidebar_featured: category.featured,
              sidebar_sort_order: category.position,
              updated_at: new Date(),
            })
            .where(and(
              eq(sports_menu_items.id, existing.id),
              eq(sports_menu_items.enabled, true),
            ))
          continue
        }

        const parent = category.parentId ? existingById.get(category.parentId) : null
        await tx.insert(sports_menu_items).values({
          id: `sidebar-category-${category.slug}-${randomUUID()}`,
          item_type: 'link',
          label: category.name,
          href: `/sports/${category.slug}/games`,
          icon_url: parent?.icon_url ?? '/images/sports/menu/soccer.svg',
          parent_id: category.parentId,
          menu_slug: category.slug,
          h1_title: category.name,
          mapped_tags: [category.name],
          url_aliases: [],
          games_enabled: true,
          props_enabled: false,
          sort_order: category.nestedPosition,
          enabled: true,
          sidebar_category: true,
          sidebar_enabled: category.enabled,
          sidebar_featured: category.featured,
          sidebar_sort_order: category.position,
        })
      }
    })

    revalidateSportsSidebar()

    return {
      success: true,
      data: await listSportsSidebarCategories(),
    }
  }
  catch (error) {
    console.error('Failed to update sports sidebar categories:', error)
    return { success: false, error: 'Failed to update sports sidebar categories. Please try again.' }
  }
}
