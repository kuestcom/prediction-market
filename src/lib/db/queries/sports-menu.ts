import type {
  SportsMenuEntry,
  SportsMenuGroupEntry,
  SportsMenuLinkEntry,
} from '@/lib/sports-menu-types'
import type { SportsSlugMappingEntry } from '@/lib/sports-slug-mapping'
import type { QueryResult } from '@/types'
import { and, asc, eq, gt, or, sql } from 'drizzle-orm'
import { cacheTag, unstable_cache } from 'next/cache'
import { cacheTags } from '@/lib/cache-tags'
import {
  event_sports,
  events,
  sports_menu_items,
} from '@/lib/db/schema/events/tables'
import { runQuery } from '@/lib/db/utils/run-query'
import { db } from '@/lib/drizzle'
import {
  buildSportsSlugResolver,
  resolveCanonicalSportsSlugAlias,
  resolveCanonicalSportsSportSlug,
} from '@/lib/sports-slug-mapping'

type SportsMenuItemType = 'link' | 'group' | 'header' | 'divider'

interface SportsMenuItemRow {
  id: string
  item_type: string
  label: string | null
  href: string | null
  icon_url: string | null
  parent_id: string | null
  menu_slug: string | null
  h1_title: string | null
  mapped_tags: unknown
  url_aliases: unknown
  games_enabled: boolean
  props_enabled: boolean
  sort_order: number
}

interface ActiveSportsCountRow {
  slug: string | null
  tags: unknown
}

export interface SportsMenuLayoutData {
  menuEntries: SportsMenuEntry[]
  countsBySlug: Record<string, number>
  canonicalSlugByAliasKey: Record<string, string>
  h1TitleBySlug: Record<string, string>
  sectionsBySlug: Record<string, { gamesEnabled: boolean, propsEnabled: boolean }>
}

function normalizeComparableValue(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim().toLowerCase()
  return normalized || null
}

function toOptionalStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[]
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim())
    .filter(Boolean)
}

function requireText(value: string | null | undefined, rowId: string, field: string) {
  if (typeof value !== 'string') {
    throw new TypeError(`sports_menu_items.${field} is required for row ${rowId}`)
  }

  const normalized = value.trim()
  if (!normalized) {
    throw new TypeError(`sports_menu_items.${field} cannot be empty for row ${rowId}`)
  }

  return normalized
}

const getCachedSportsMenuRows = unstable_cache(
  async (): Promise<SportsMenuItemRow[]> => {
    const rows = await db
      .select({
        id: sports_menu_items.id,
        item_type: sports_menu_items.item_type,
        label: sports_menu_items.label,
        href: sports_menu_items.href,
        icon_url: sports_menu_items.icon_url,
        parent_id: sports_menu_items.parent_id,
        menu_slug: sports_menu_items.menu_slug,
        h1_title: sports_menu_items.h1_title,
        mapped_tags: sports_menu_items.mapped_tags,
        url_aliases: sports_menu_items.url_aliases,
        games_enabled: sports_menu_items.games_enabled,
        props_enabled: sports_menu_items.props_enabled,
        sort_order: sports_menu_items.sort_order,
      })
      .from(sports_menu_items)
      .where(eq(sports_menu_items.enabled, true))
      .orderBy(asc(sports_menu_items.sort_order), asc(sports_menu_items.id))

    return rows
  },
  ['sports-menu-items-v1'],
  {
    revalidate: 1800,
    tags: [cacheTags.eventsGlobal],
  },
)

const getCachedActiveSportsCountRows = unstable_cache(
  async (): Promise<ActiveSportsCountRow[]> => {
    const rows = await db
      .select({
        slug: event_sports.sports_sport_slug,
        tags: event_sports.sports_tags,
      })
      .from(event_sports)
      .innerJoin(events, eq(event_sports.event_id, events.id))
      .where(and(
        eq(events.status, 'active'),
        gt(events.active_markets_count, 0),
        sql`LOWER(TRIM(COALESCE(${events.slug}, ''))) NOT LIKE '%-more-markets'`,
        or(
          sql`TRIM(COALESCE(${event_sports.sports_sport_slug}, '')) <> ''`,
          sql`jsonb_array_length(COALESCE(${event_sports.sports_tags}, '[]'::jsonb)) > 0`,
        ),
      ))

    return rows
  },
  ['sports-menu-active-count-rows-v2'],
  {
    revalidate: 300,
    tags: [cacheTags.eventsGlobal],
  },
)

function toMappingEntries(rows: SportsMenuItemRow[]) {
  const mappings: SportsSlugMappingEntry[] = []

  for (const row of rows) {
    if (row.item_type !== 'link') {
      continue
    }

    const menuSlug = normalizeComparableValue(row.menu_slug)
    if (!menuSlug) {
      continue
    }

    const h1Title = row.h1_title?.trim()
    if (!h1Title) {
      throw new Error(`sports_menu_items.h1_title is required for menu slug ${menuSlug}`)
    }

    mappings.push({
      menuSlug,
      h1Title,
      label: row.label,
      aliases: toOptionalStringArray(row.url_aliases),
      mappedTags: toOptionalStringArray(row.mapped_tags),
      sections: {
        gamesEnabled: Boolean(row.games_enabled),
        propsEnabled: Boolean(row.props_enabled),
      },
    })
  }

  return mappings
}

function toLinkEntry(row: SportsMenuItemRow): SportsMenuLinkEntry {
  const label = requireText(row.label, row.id, 'label')
  const href = requireText(row.href, row.id, 'href')
  const iconPath = requireText(row.icon_url, row.id, 'icon_url')

  return {
    type: 'link',
    id: row.id,
    label,
    href,
    iconPath,
    menuSlug: normalizeComparableValue(row.menu_slug),
  }
}

function toSidebarMenuEntries(rows: SportsMenuItemRow[]) {
  const childrenByParent = new Map<string, SportsMenuItemRow[]>()
  const rootRows: SportsMenuItemRow[] = []

  for (const row of rows) {
    if (row.parent_id) {
      const parentRows = childrenByParent.get(row.parent_id) ?? []
      parentRows.push(row)
      childrenByParent.set(row.parent_id, parentRows)
      continue
    }

    rootRows.push(row)
  }

  rootRows.sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id))
  for (const childRows of childrenByParent.values()) {
    childRows.sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id))
  }

  const entries: SportsMenuEntry[] = []

  for (const row of rootRows) {
    const type = row.item_type as SportsMenuItemType

    if (type === 'divider') {
      entries.push({
        type: 'divider',
        id: row.id,
      })
      continue
    }

    if (type === 'header') {
      entries.push({
        type: 'header',
        id: row.id,
        label: requireText(row.label, row.id, 'label'),
      })
      continue
    }

    if (type === 'link') {
      entries.push(toLinkEntry(row))
      continue
    }

    if (type === 'group') {
      const groupLinks = (childrenByParent.get(row.id) ?? [])
        .filter(child => child.item_type === 'link')
        .map(toLinkEntry)

      const groupEntry: SportsMenuGroupEntry = {
        type: 'group',
        id: row.id,
        label: requireText(row.label, row.id, 'label'),
        iconPath: requireText(row.icon_url, row.id, 'icon_url'),
        links: groupLinks,
      }

      entries.push(groupEntry)
    }
  }

  return entries
}

function buildCountsBySlug(
  resolver: ReturnType<typeof buildSportsSlugResolver>,
  activeCountRows: ActiveSportsCountRow[],
) {
  const countsBySlug: Record<string, number> = {}

  for (const row of activeCountRows) {
    const sportsTags = toOptionalStringArray(row.tags)
    const canonicalSlug = resolveCanonicalSportsSportSlug(resolver, {
      sportsSportSlug: row.slug,
      sportsTags,
    })
    if (!canonicalSlug) {
      continue
    }

    countsBySlug[canonicalSlug] = (countsBySlug[canonicalSlug] ?? 0) + 1
  }

  return countsBySlug
}

function findDefaultLandingHref(menuEntries: SportsMenuEntry[]) {
  for (const entry of menuEntries) {
    if (entry.type === 'link') {
      return entry.href
    }
  }

  return null
}

function findDefaultFuturesHref(menuEntries: SportsMenuEntry[]) {
  for (const entry of menuEntries) {
    if (entry.type === 'link' && entry.href.startsWith('/sports/futures/')) {
      return entry.href
    }

    if (entry.type === 'group') {
      const futuresLink = entry.links.find(link => link.href.startsWith('/sports/futures/'))
      if (futuresLink) {
        return futuresLink.href
      }
    }
  }

  return null
}

export async function getSportsSlugResolverFromDb() {
  const rows = await getCachedSportsMenuRows()
  const mappingEntries = toMappingEntries(rows)
  return buildSportsSlugResolver(mappingEntries)
}

export async function getSportsCountsBySlugFromDb() {
  const [rows, activeCountRows] = await Promise.all([
    getCachedSportsMenuRows(),
    getCachedActiveSportsCountRows(),
  ])
  const resolver = buildSportsSlugResolver(toMappingEntries(rows))
  return buildCountsBySlug(resolver, activeCountRows)
}

export const SportsMenuRepository = {
  async getLayoutData(): Promise<QueryResult<SportsMenuLayoutData>> {
    'use cache'
    cacheTag(cacheTags.eventsGlobal)

    return runQuery(async () => {
      const [rows, activeCountRows] = await Promise.all([
        getCachedSportsMenuRows(),
        getCachedActiveSportsCountRows(),
      ])
      const resolver = buildSportsSlugResolver(toMappingEntries(rows))
      const menuEntries = toSidebarMenuEntries(rows)
      const countsBySlug = buildCountsBySlug(resolver, activeCountRows)

      return {
        data: {
          menuEntries,
          countsBySlug,
          canonicalSlugByAliasKey: Object.fromEntries(resolver.canonicalByAliasKey),
          h1TitleBySlug: Object.fromEntries(resolver.h1TitleBySlug),
          sectionsBySlug: Object.fromEntries(resolver.sectionsBySlug),
        },
        error: null,
      }
    })
  },

  async resolveCanonicalSlugByAlias(alias: string): Promise<QueryResult<string | null>> {
    'use cache'
    cacheTag(cacheTags.eventsGlobal)

    return runQuery(async () => {
      const resolver = await getSportsSlugResolverFromDb()

      return {
        data: resolveCanonicalSportsSlugAlias(resolver, alias),
        error: null,
      }
    })
  },

  async getLandingHref(): Promise<QueryResult<string | null>> {
    'use cache'
    cacheTag(cacheTags.eventsGlobal)

    return runQuery(async () => {
      const rows = await getCachedSportsMenuRows()
      const menuEntries = toSidebarMenuEntries(rows)

      return {
        data: findDefaultLandingHref(menuEntries),
        error: null,
      }
    })
  },

  async getFuturesHref(): Promise<QueryResult<string | null>> {
    'use cache'
    cacheTag(cacheTags.eventsGlobal)

    return runQuery(async () => {
      const rows = await getCachedSportsMenuRows()
      const menuEntries = toSidebarMenuEntries(rows)

      return {
        data: findDefaultFuturesHref(menuEntries),
        error: null,
      }
    })
  },
}
