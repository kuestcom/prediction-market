import type { NonDefaultLocale, SupportedLocale } from '@/i18n/locales'
import { and, asc, count, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { cacheTag, revalidatePath } from 'next/cache'
import { DEFAULT_LOCALE, NON_DEFAULT_LOCALES } from '@/i18n/locales'
import { cacheTags } from '@/lib/cache-tags'
import { tag_translations, tags, v_main_tag_subcategories } from '@/lib/db/schema/events/tables'
import { runQuery } from '@/lib/db/utils/run-query'
import { db } from '@/lib/drizzle'

const EXCLUDED_SUB_SLUGS = new Set(['hide-from-new'])

interface ListTagsParams {
  limit?: number
  offset?: number
  search?: string
  sortBy?: 'name' | 'slug' | 'display_order' | 'created_at' | 'updated_at' | 'active_markets_count'
  sortOrder?: 'asc' | 'desc'
}

interface ParentTagPreview {
  id: number
  name: string
  slug: string
}

export type TagTranslationsMap = Partial<Record<NonDefaultLocale, string>>

interface AdminTagRow {
  id: number
  name: string
  slug: string
  is_main_category: boolean
  is_hidden: boolean
  hide_events: boolean
  display_order: number
  parent_tag_id: number | null
  active_markets_count: number
  created_at: string
  updated_at: string
  parent?: ParentTagPreview | null
  translations: TagTranslationsMap
}

interface TagWithChilds {
  id: number
  name: string
  slug: string
  is_main_category: boolean | null
  is_hidden: boolean
  display_order: number | null
  parent_tag_id: number | null
  active_markets_count: number | null
  created_at: Date
  updated_at: Date
  childs: { name: string, slug: string }[]
}

interface MainTagsResult {
  data: TagWithChilds[] | null
  error: string | null
  globalChilds: { name: string, slug: string }[]
}

interface TagTranslationRecord {
  tag_id: number
  locale: string
  name: string
}

function normalizeTranslationLocale(locale: string): NonDefaultLocale | null {
  return NON_DEFAULT_LOCALES.includes(locale as NonDefaultLocale)
    ? locale as NonDefaultLocale
    : null
}

function buildTagTranslationsByTagId(rows: TagTranslationRecord[]): Map<number, TagTranslationsMap> {
  const mapByTagId = new Map<number, TagTranslationsMap>()

  for (const row of rows) {
    const locale = normalizeTranslationLocale(row.locale)
    if (!locale) {
      continue
    }

    const current = mapByTagId.get(row.tag_id) ?? {}
    current[locale] = row.name
    mapByTagId.set(row.tag_id, current)
  }

  return mapByTagId
}

async function getTranslationsByTagIds(tagIds: number[]): Promise<{
  data: Map<number, TagTranslationsMap>
  error: string | null
}> {
  if (tagIds.length === 0) {
    return { data: new Map(), error: null }
  }

  const { data, error } = await runQuery(async () => {
    const result = await db
      .select({
        tag_id: tag_translations.tag_id,
        locale: tag_translations.locale,
        name: tag_translations.name,
      })
      .from(tag_translations)
      .where(inArray(tag_translations.tag_id, tagIds))

    return { data: result as TagTranslationRecord[], error: null }
  })

  if (error || !data) {
    return {
      data: new Map(),
      error: typeof error === 'string' ? error : 'Unknown error',
    }
  }

  return { data: buildTagTranslationsByTagId(data), error: null }
}

async function getLocalizedNamesByTagId(tagIds: number[], locale: SupportedLocale): Promise<{
  data: Map<number, string>
  error: string | null
}> {
  if (locale === DEFAULT_LOCALE || tagIds.length === 0) {
    return { data: new Map(), error: null }
  }

  const { data, error } = await runQuery(async () => {
    const result = await db
      .select({
        tag_id: tag_translations.tag_id,
        name: tag_translations.name,
      })
      .from(tag_translations)
      .where(and(
        inArray(tag_translations.tag_id, tagIds),
        eq(tag_translations.locale, locale),
      ))

    return { data: result, error: null }
  })

  if (error || !data) {
    return {
      data: new Map(),
      error: typeof error === 'string' ? error : 'Unknown error',
    }
  }

  const localized = new Map<number, string>()
  for (const row of data) {
    localized.set(row.tag_id, row.name)
  }

  return { data: localized, error: null }
}

export const TagRepository = {
  async getMainTags(locale: SupportedLocale = DEFAULT_LOCALE): Promise<MainTagsResult> {
    'use cache'
    cacheTag(cacheTags.mainTags(locale))

    const mainTagsQuery = db
      .select({
        id: tags.id,
        name: tags.name,
        slug: tags.slug,
        is_main_category: tags.is_main_category,
        is_hidden: tags.is_hidden,
        display_order: tags.display_order,
        parent_tag_id: tags.parent_tag_id,
        active_markets_count: tags.active_markets_count,
        created_at: tags.created_at,
        updated_at: tags.updated_at,
      })
      .from(tags)
      .where(and(
        eq(tags.is_main_category, true),
        eq(tags.is_hidden, false),
      ))
      .orderBy(asc(tags.display_order), asc(tags.name))

    const { data: mainTagsResult, error } = await runQuery(async () => {
      const result = await mainTagsQuery
      return { data: result, error: null }
    })

    if (error || !mainTagsResult) {
      const errorMessage = typeof error === 'string' ? error : 'Unknown error'
      return { data: null, error: errorMessage, globalChilds: [] }
    }

    const mainVisibleTags = mainTagsResult
    const mainSlugs = mainVisibleTags.map(tag => tag.slug)

    const subcategoriesQuery = db
      .select({
        main_tag_id: v_main_tag_subcategories.main_tag_id,
        main_tag_slug: v_main_tag_subcategories.main_tag_slug,
        main_tag_name: v_main_tag_subcategories.main_tag_name,
        main_tag_is_hidden: v_main_tag_subcategories.main_tag_is_hidden,
        sub_tag_id: v_main_tag_subcategories.sub_tag_id,
        sub_tag_name: v_main_tag_subcategories.sub_tag_name,
        sub_tag_slug: v_main_tag_subcategories.sub_tag_slug,
        sub_tag_is_main_category: v_main_tag_subcategories.sub_tag_is_main_category,
        sub_tag_is_hidden: v_main_tag_subcategories.sub_tag_is_hidden,
        active_markets_count: v_main_tag_subcategories.active_markets_count,
        last_market_activity_at: v_main_tag_subcategories.last_market_activity_at,
      })
      .from(v_main_tag_subcategories)
      .where(inArray(v_main_tag_subcategories.main_tag_slug, mainSlugs))

    const { data: subcategoriesResult, error: viewError } = await runQuery(async () => {
      const result = await subcategoriesQuery
      return { data: result, error: null }
    })

    if (viewError || !subcategoriesResult) {
      const tagsWithChilds = mainVisibleTags.map((tag: any) => ({ ...tag, childs: [] }))
      const errorMessage = typeof viewError === 'string' ? viewError : 'Unknown error'
      return { data: tagsWithChilds, error: errorMessage, globalChilds: [] }
    }

    const translationTagIds = new Set<number>()
    for (const tag of mainVisibleTags) {
      translationTagIds.add(tag.id)
    }
    for (const subtag of subcategoriesResult) {
      if (subtag.main_tag_id) {
        translationTagIds.add(subtag.main_tag_id)
      }
      if (subtag.sub_tag_id) {
        translationTagIds.add(subtag.sub_tag_id)
      }
    }

    const { data: localizedNamesByTagId, error: translationError } = await getLocalizedNamesByTagId(
      Array.from(translationTagIds),
      locale,
    )

    if (translationError) {
      return { data: null, error: translationError, globalChilds: [] }
    }

    const grouped = new Map<string, { name: string, slug: string, count: number }[]>()
    const bestMainBySubSlug = new Map<string, { mainSlug: string, count: number }>()
    const globalCounts = new Map<string, { name: string, slug: string, count: number }>()

    const mainSlugSet = new Set(mainSlugs)

    for (const subtag of subcategoriesResult) {
      if (
        !subtag.sub_tag_slug
        || mainSlugSet.has(subtag.sub_tag_slug)
        || EXCLUDED_SUB_SLUGS.has(subtag.sub_tag_slug)
        || subtag.sub_tag_is_hidden
        || subtag.main_tag_is_hidden
      ) {
        continue
      }

      const localizedSubTagName = localizedNamesByTagId.get(subtag.sub_tag_id ?? -1) ?? subtag.sub_tag_name!
      const current = grouped.get(subtag.main_tag_slug!) ?? []
      const existingIndex = current.findIndex(item => item.slug === subtag.sub_tag_slug)
      const nextCount = subtag.active_markets_count ?? 0

      if (existingIndex >= 0) {
        current[existingIndex] = {
          name: localizedSubTagName,
          slug: subtag.sub_tag_slug,
          count: Math.max(current[existingIndex].count, nextCount),
        }
      }
      else {
        current.push({
          name: localizedSubTagName,
          slug: subtag.sub_tag_slug,
          count: nextCount,
        })
      }

      grouped.set(subtag.main_tag_slug!, current)

      const best = bestMainBySubSlug.get(subtag.sub_tag_slug)
      if (
        !best
        || nextCount > best.count
        || (nextCount === best.count && subtag.main_tag_slug!.localeCompare(best.mainSlug) < 0)
      ) {
        bestMainBySubSlug.set(subtag.sub_tag_slug, {
          mainSlug: subtag.main_tag_slug!,
          count: nextCount,
        })
      }

      const globalExisting = globalCounts.get(subtag.sub_tag_slug)
      globalCounts.set(subtag.sub_tag_slug, {
        name: localizedSubTagName,
        slug: subtag.sub_tag_slug,
        count: (globalExisting?.count ?? 0) + nextCount,
      })
    }

    const enhanced = mainVisibleTags.map(tag => ({
      ...tag,
      name: localizedNamesByTagId.get(tag.id) ?? tag.name,
      childs: (grouped.get(tag.slug) ?? [])
        .filter(child => bestMainBySubSlug.get(child.slug)?.mainSlug === tag.slug)
        .sort((a, b) => {
          if (b.count === a.count) {
            return a.name.localeCompare(b.name)
          }
          return b.count - a.count
        })
        .map(({ name, slug }) => ({ name, slug })),
    }))

    const globalChilds = Array.from(globalCounts.values())
      .filter(child => child.count > 0)
      .sort((a, b) => {
        if (b.count === a.count) {
          return a.name.localeCompare(b.name)
        }
        return b.count - a.count
      })
      .map(({ name, slug }) => ({ name, slug }))

    return { data: enhanced, error: null, globalChilds }
  },

  async listTags({
    limit = 50,
    offset = 0,
    search,
    sortBy = 'display_order',
    sortOrder = 'asc',
  }: ListTagsParams = {}): Promise<{
    data: AdminTagRow[]
    error: string | null
    totalCount: number
  }> {
    'use cache'
    cacheTag(cacheTags.adminCategories)

    const cappedLimit = Math.min(Math.max(limit, 1), 100)
    const safeOffset = Math.max(offset, 0)

    const validSortFields: ListTagsParams['sortBy'][] = [
      'name',
      'slug',
      'display_order',
      'created_at',
      'updated_at',
      'active_markets_count',
    ]
    const orderField = validSortFields.includes(sortBy) ? sortBy : 'display_order'
    const ascending = (sortOrder ?? 'asc') === 'asc'
    const parentTags = alias(tags, 'parent_tags')

    const whereCondition = search && search.trim()
      ? or(
          ilike(tags.name, `%${search.trim()}%`),
          ilike(tags.slug, `%${search.trim()}%`),
        )
      : undefined

    let orderByClause
    switch (orderField) {
      case 'name':
        orderByClause = ascending ? asc(tags.name) : desc(tags.name)
        break
      case 'slug':
        orderByClause = ascending ? asc(tags.slug) : desc(tags.slug)
        break
      case 'created_at':
        orderByClause = ascending ? asc(tags.created_at) : desc(tags.created_at)
        break
      case 'updated_at':
        orderByClause = ascending ? asc(tags.updated_at) : desc(tags.updated_at)
        break
      case 'active_markets_count':
        orderByClause = ascending ? asc(tags.active_markets_count) : desc(tags.active_markets_count)
        break
      case 'display_order':
      default:
        orderByClause = ascending ? asc(tags.display_order) : desc(tags.display_order)
        break
    }

    const baseQuery = db
      .select({
        id: tags.id,
        name: tags.name,
        slug: tags.slug,
        is_main_category: tags.is_main_category,
        is_hidden: tags.is_hidden,
        hide_events: tags.hide_events,
        display_order: tags.display_order,
        parent_tag_id: tags.parent_tag_id,
        active_markets_count: tags.active_markets_count,
        created_at: tags.created_at,
        updated_at: tags.updated_at,
        parent: {
          id: parentTags.id,
          name: parentTags.name,
          slug: parentTags.slug,
        },
      })
      .from(tags)
      .leftJoin(parentTags, eq(tags.parent_tag_id, parentTags.id))

    const finalQuery = whereCondition
      ? baseQuery.where(whereCondition).orderBy(orderByClause).limit(cappedLimit).offset(safeOffset)
      : baseQuery.orderBy(orderByClause).limit(cappedLimit).offset(safeOffset)

    const baseCountQuery = db
      .select({ count: count() })
      .from(tags)

    const countQuery = whereCondition
      ? baseCountQuery.where(whereCondition)
      : baseCountQuery

    const { data, error } = await runQuery(async () => {
      const result = await finalQuery
      return { data: result, error: null }
    })

    const { data: countResult, error: countError } = await runQuery(async () => {
      const result = await countQuery
      return { data: result, error: null }
    })

    if (error || countError) {
      const errorMessage = error || countError
      return {
        data: [],
        error: errorMessage,
        totalCount: 0,
      }
    }

    const rawRows = data || []
    const tagIds = rawRows.map((row: any) => row.id)
    const { data: translationsByTagId, error: translationError } = await getTranslationsByTagIds(tagIds)

    if (translationError) {
      return {
        data: [],
        error: translationError,
        totalCount: 0,
      }
    }

    const formattedData: AdminTagRow[] = rawRows.map((row: any) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      is_main_category: row.is_main_category,
      is_hidden: row.is_hidden,
      hide_events: row.hide_events,
      display_order: row.display_order,
      parent_tag_id: row.parent_tag_id,
      active_markets_count: row.active_markets_count,
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString(),
      parent: row.parent?.id
        ? {
            id: row.parent.id,
            name: row.parent.name,
            slug: row.parent.slug,
          }
        : null,
      translations: translationsByTagId.get(row.id) ?? {},
    }))

    return {
      data: formattedData,
      error: null,
      totalCount: countResult?.[0]?.count ?? 0,
    }
  },

  async updateTagById(id: number, payload: any): Promise<{
    data: AdminTagRow | null
    error: string | null
  }> {
    const updateQuery = db
      .update(tags)
      .set(payload)
      .where(eq(tags.id, id))
      .returning()

    const { data: updateResult, error } = await runQuery(async () => {
      const result = await updateQuery
      return { data: result, error: null }
    })

    if (error || !updateResult?.[0]) {
      return { data: null, error: error ?? 'Unknown error' }
    }

    const parentTags = alias(tags, 'parent_tags')

    const selectQuery = db
      .select({
        id: tags.id,
        name: tags.name,
        slug: tags.slug,
        is_main_category: tags.is_main_category,
        is_hidden: tags.is_hidden,
        hide_events: tags.hide_events,
        display_order: tags.display_order,
        parent_tag_id: tags.parent_tag_id,
        active_markets_count: tags.active_markets_count,
        created_at: tags.created_at,
        updated_at: tags.updated_at,
        parent: {
          id: parentTags.id,
          name: parentTags.name,
          slug: parentTags.slug,
        },
      })
      .from(tags)
      .leftJoin(parentTags, eq(tags.parent_tag_id, parentTags.id))
      .where(eq(tags.id, id))

    const { data: selectResult, error: selectError } = await runQuery(async () => {
      const result = await selectQuery
      return { data: result, error: null }
    })

    if (selectError || !selectResult?.[0]) {
      return { data: null, error: selectError ?? 'Unknown error' }
    }

    const { data: translationsByTagId, error: translationError } = await getTranslationsByTagIds([id])

    if (translationError) {
      return { data: null, error: translationError }
    }

    revalidatePath('/')

    const row = selectResult[0]
    const formattedData: AdminTagRow = {
      id: row.id,
      name: row.name,
      slug: row.slug,
      is_main_category: row.is_main_category ?? false,
      is_hidden: row.is_hidden,
      hide_events: row.hide_events,
      display_order: row.display_order ?? 0,
      parent_tag_id: row.parent_tag_id,
      active_markets_count: row.active_markets_count ?? 0,
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString(),
      parent: row.parent?.id
        ? {
            id: row.parent.id,
            name: row.parent.name,
            slug: row.parent.slug,
          }
        : null,
      translations: translationsByTagId.get(row.id) ?? {},
    }

    return {
      data: formattedData,
      error: null,
    }
  },

  async updateTagTranslationsById(tagId: number, translations: TagTranslationsMap): Promise<{
    data: TagTranslationsMap | null
    error: string | null
  }> {
    const normalizedEntries = NON_DEFAULT_LOCALES.map((locale) => {
      const rawValue = translations[locale]
      const value = typeof rawValue === 'string' ? rawValue.trim() : ''
      return { locale, value }
    })

    const localesToDelete = normalizedEntries
      .filter(entry => entry.value.length === 0)
      .map(entry => entry.locale)

    const rowsToUpsert = normalizedEntries
      .filter(entry => entry.value.length > 0)
      .map(entry => ({
        tag_id: tagId,
        locale: entry.locale,
        name: entry.value,
      }))

    const { data: tagExists, error: tagCheckError } = await runQuery(async () => {
      const result = await db
        .select({ id: tags.id })
        .from(tags)
        .where(eq(tags.id, tagId))
        .limit(1)

      return { data: result.length > 0, error: null }
    })

    if (tagCheckError || !tagExists) {
      return { data: null, error: tagCheckError ?? 'Tag not found.' }
    }

    const { error } = await runQuery(async () => {
      await db.transaction(async (tx) => {
        if (localesToDelete.length > 0) {
          await tx
            .delete(tag_translations)
            .where(and(
              eq(tag_translations.tag_id, tagId),
              inArray(tag_translations.locale, localesToDelete),
            ))
        }

        if (rowsToUpsert.length > 0) {
          await tx
            .insert(tag_translations)
            .values(rowsToUpsert)
            .onConflictDoUpdate({
              target: [tag_translations.tag_id, tag_translations.locale],
              set: {
                name: sql`EXCLUDED.name`,
              },
            })
        }
      })

      return { data: true, error: null }
    })

    if (error) {
      return {
        data: null,
        error: typeof error === 'string' ? error : 'Unknown error',
      }
    }

    const { data: translationsByTagId, error: translationError } = await getTranslationsByTagIds([tagId])

    if (translationError) {
      return {
        data: null,
        error: translationError,
      }
    }

    revalidatePath('/')

    return {
      data: translationsByTagId.get(tagId) ?? {},
      error: null,
    }
  },
}
