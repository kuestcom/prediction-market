import type {
  SportsMenuEntry,
  SportsMenuGroupEntry,
  SportsMenuLinkEntry,
} from '@/lib/sports-menu-types'
import type { SportsSlugMappingEntry } from '@/lib/sports-slug-mapping'
import type { SportsVertical } from '@/lib/sports-vertical'
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
import { normalizeComparableValue, slugifyText } from '@/lib/slug'
import { SPORTS_AUXILIARY_SLUG_SQL_REGEX } from '@/lib/sports-event-slugs'
import {
  buildSportsSlugResolver,
  resolveCanonicalSportsSlugAlias,
  resolveCanonicalSportsSportSlug,
} from '@/lib/sports-slug-mapping'
import { getSportsVerticalConfig } from '@/lib/sports-vertical'

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
  series_slug: string | null
  tags: unknown
  is_hidden: boolean
}

export interface SportsMenuLayoutData {
  menuEntries: SportsMenuEntry[]
  countsBySlug: Record<string, number>
  canonicalSlugByAliasKey: Record<string, string>
  h1TitleBySlug: Record<string, string>
  sectionsBySlug: Record<string, { gamesEnabled: boolean, propsEnabled: boolean }>
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

function buildChildrenByParent(rows: SportsMenuItemRow[]) {
  const childrenByParent = new Map<string, SportsMenuItemRow[]>()

  for (const row of rows) {
    if (!row.parent_id) {
      continue
    }

    const childRows = childrenByParent.get(row.parent_id) ?? []
    childRows.push(row)
    childrenByParent.set(row.parent_id, childRows)
  }

  for (const childRows of childrenByParent.values()) {
    childRows.sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id))
  }

  return childrenByParent
}

function createSyntheticMenuRow(params: Partial<SportsMenuItemRow> & {
  id: string
  item_type: SportsMenuItemType
  sort_order: number
}) {
  return {
    id: params.id,
    item_type: params.item_type,
    label: params.label ?? null,
    href: params.href ?? null,
    icon_url: params.icon_url ?? null,
    parent_id: params.parent_id ?? null,
    menu_slug: params.menu_slug ?? null,
    h1_title: params.h1_title ?? null,
    mapped_tags: params.mapped_tags ?? [],
    url_aliases: params.url_aliases ?? [],
    games_enabled: params.games_enabled ?? false,
    props_enabled: params.props_enabled ?? false,
    sort_order: params.sort_order,
  } satisfies SportsMenuItemRow
}

function resolveGroupMenuSlug(row: SportsMenuItemRow) {
  const configuredSlug = normalizeComparableValue(row.menu_slug)
  if (configuredSlug) {
    return configuredSlug
  }

  const label = row.label?.trim()
  if (!label) {
    return null
  }

  return slugifyText(label) || null
}

function resolveGroupSectionConfig(childRows: SportsMenuItemRow[]) {
  const hrefs = childRows
    .map(child => child.href?.trim().toLowerCase() ?? '')
    .filter(Boolean)

  return {
    gamesEnabled: childRows.some(child => child.item_type === 'link' && Boolean(child.games_enabled))
      || hrefs.some(href => href.endsWith('/games')),
    propsEnabled: childRows.some(child => child.item_type === 'link' && Boolean(child.props_enabled))
      || hrefs.some(href => href.endsWith('/props')),
  }
}

function resolveDefaultGroupSection(childRows: SportsMenuItemRow[]) {
  const sectionConfig = resolveGroupSectionConfig(childRows)
  if (sectionConfig.gamesEnabled) {
    return 'games' as const
  }

  if (sectionConfig.propsEnabled) {
    return 'props' as const
  }

  const hrefs = childRows
    .map(child => child.href?.trim().toLowerCase() ?? '')
    .filter(Boolean)

  if (hrefs.some(href => href.endsWith('/games'))) {
    return 'games' as const
  }

  if (hrefs.some(href => href.endsWith('/props'))) {
    return 'props' as const
  }

  return null
}

function buildGroupQueryCandidates(childRows: SportsMenuItemRow[]) {
  const queryCandidates = new Set<string>()

  for (const child of childRows) {
    if (child.item_type !== 'link') {
      continue
    }

    const menuSlug = normalizeComparableValue(child.menu_slug)
    if (menuSlug) {
      queryCandidates.add(menuSlug)
    }

    if (child.label?.trim()) {
      queryCandidates.add(child.label)
    }

    for (const alias of toOptionalStringArray(child.url_aliases)) {
      queryCandidates.add(alias)
    }

    for (const mappedTag of toOptionalStringArray(child.mapped_tags)) {
      queryCandidates.add(mappedTag)
    }
  }

  return Array.from(queryCandidates)
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
        series_slug: event_sports.sports_series_slug,
        tags: event_sports.sports_tags,
        is_hidden: events.is_hidden,
      })
      .from(event_sports)
      .innerJoin(events, eq(event_sports.event_id, events.id))
      .where(and(
        eq(events.status, 'active'),
        eq(events.is_hidden, false),
        gt(events.active_markets_count, 0),
        sql`LOWER(TRIM(COALESCE(${events.slug}, ''))) !~ ${SPORTS_AUXILIARY_SLUG_SQL_REGEX}`,
        or(
          sql`TRIM(COALESCE(${event_sports.sports_sport_slug}, '')) <> ''`,
          sql`TRIM(COALESCE(${event_sports.sports_series_slug}, '')) <> ''`,
          sql`jsonb_array_length(COALESCE(${event_sports.sports_tags}, '[]'::jsonb)) > 0`,
        ),
      ))

    return rows
  },
  ['sports-menu-active-count-rows-v4'],
  {
    revalidate: 300,
    tags: [cacheTags.eventsGlobal],
  },
)

function toMappingEntries(rows: SportsMenuItemRow[]) {
  const childrenByParent = buildChildrenByParent(rows)
  const mappings: SportsSlugMappingEntry[] = []

  for (const row of rows) {
    if (row.item_type === 'link') {
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
      continue
    }

    if (row.item_type !== 'group') {
      continue
    }

    const menuSlug = resolveGroupMenuSlug(row)
    if (!menuSlug) {
      continue
    }

    const childRows = childrenByParent.get(row.id) ?? []
    const sectionConfig = resolveGroupSectionConfig(childRows)
    if (!sectionConfig.gamesEnabled && !sectionConfig.propsEnabled) {
      continue
    }

    mappings.push({
      menuSlug,
      h1Title: row.h1_title?.trim() || requireText(row.label, row.id, 'label'),
      label: row.label,
      aliases: toOptionalStringArray(row.url_aliases),
      mappedTags: toOptionalStringArray(row.mapped_tags),
      queryCandidates: buildGroupQueryCandidates(childRows),
      sections: sectionConfig,
      useForEventClassification: false,
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

function rewriteVerticalHref(href: string | null | undefined, vertical: SportsVertical) {
  if (!href) {
    return href ?? null
  }

  const verticalConfig = getSportsVerticalConfig(vertical)
  if (href === '/sports/live') {
    return verticalConfig.livePath
  }

  if (href === '/sports/futures' || href.startsWith('/sports/futures/')) {
    return href.replace('/sports/futures', verticalConfig.futurePathPrefix)
  }

  if (href.startsWith('/sports/')) {
    return href.replace('/sports', verticalConfig.basePath)
  }

  return href
}

function findEsportsGroupRow(rows: SportsMenuItemRow[]) {
  return rows.find(row =>
    row.item_type === 'group'
    && normalizeComparableValue(row.label) === 'esports',
  ) ?? null
}

function buildVerticalMenuRows(rows: SportsMenuItemRow[], vertical: SportsVertical) {
  if (vertical === 'sports') {
    const esportsGroupRow = findEsportsGroupRow(rows)
    if (!esportsGroupRow) {
      return rows
    }

    return rows.filter(row => row.id !== esportsGroupRow.id)
  }

  const verticalConfig = getSportsVerticalConfig(vertical)
  const esportsGroupRow = findEsportsGroupRow(rows)
  if (!esportsGroupRow) {
    return rows
  }

  const liveTemplateRow = rows.find(row =>
    row.item_type === 'link'
    && row.href === '/sports/live',
  )
  const futureTemplateRow = rows.find(row =>
    row.item_type === 'link'
    && row.href?.startsWith('/sports/futures'),
  )
  const esportsLinks = rows
    .filter(row => row.parent_id === esportsGroupRow.id && row.item_type === 'link')
    .map((row, index) =>
      createSyntheticMenuRow({
        ...row,
        item_type: 'link',
        id: `esports-link-${row.id}`,
        href: rewriteVerticalHref(row.href, vertical),
        parent_id: null,
        sort_order: 100 + index,
      }),
    )

  return [
    createSyntheticMenuRow({
      ...liveTemplateRow,
      id: 'esports-top-link-live',
      item_type: 'link',
      label: liveTemplateRow?.label ?? 'Live',
      href: verticalConfig.livePath,
      icon_url: liveTemplateRow?.icon_url ?? futureTemplateRow?.icon_url ?? '/images/sports/menu/full/top-live-live.svg',
      sort_order: 0,
    }),
    createSyntheticMenuRow({
      ...futureTemplateRow,
      id: 'esports-top-link-upcoming',
      item_type: 'link',
      label: verticalConfig.futureLabel,
      href: verticalConfig.futurePath,
      icon_url: futureTemplateRow?.icon_url ?? liveTemplateRow?.icon_url ?? '/images/sports/menu/full/top-futures-futures-nba.svg',
      sort_order: 1,
    }),
    createSyntheticMenuRow({
      id: 'esports-divider',
      item_type: 'divider',
      sort_order: 2,
    }),
    createSyntheticMenuRow({
      id: 'esports-header',
      item_type: 'header',
      label: verticalConfig.menuHeaderLabel,
      sort_order: 3,
    }),
    ...esportsLinks,
  ]
}

function toSidebarMenuEntries(rows: SportsMenuItemRow[], vertical: SportsVertical) {
  const childrenByParent = buildChildrenByParent(rows)
  const rootRows: SportsMenuItemRow[] = []
  const verticalConfig = getSportsVerticalConfig(vertical)

  for (const row of rows) {
    if (!row.parent_id) {
      rootRows.push(row)
    }
  }

  rootRows.sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id))

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
      const menuSlug = resolveGroupMenuSlug(row)
      const defaultSection = resolveDefaultGroupSection(childrenByParent.get(row.id) ?? [])

      if (!menuSlug || !defaultSection || groupLinks.length === 0) {
        continue
      }

      const groupEntry: SportsMenuGroupEntry = {
        type: 'group',
        id: row.id,
        label: requireText(row.label, row.id, 'label'),
        href: rewriteVerticalHref(row.href, vertical)
          ?? `${verticalConfig.basePath}/${menuSlug}/${defaultSection}`,
        iconPath: requireText(row.icon_url, row.id, 'icon_url'),
        menuSlug,
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
    if (row.is_hidden) {
      continue
    }

    const sportsTags = toOptionalStringArray(row.tags)
    const canonicalSlug = resolveCanonicalSportsSportSlug(resolver, {
      sportsSportSlug: row.slug,
      sportsSeriesSlug: row.series_slug,
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
  async getMenuEntries(vertical: SportsVertical = 'sports'): Promise<QueryResult<SportsMenuEntry[]>> {
    'use cache'
    cacheTag(cacheTags.eventsGlobal)

    return runQuery(async () => {
      const rows = await getCachedSportsMenuRows()
      const verticalRows = buildVerticalMenuRows(rows, vertical)

      return {
        data: toSidebarMenuEntries(verticalRows, vertical),
        error: null,
      }
    })
  },

  async getLayoutData(vertical: SportsVertical = 'sports'): Promise<QueryResult<SportsMenuLayoutData>> {
    'use cache'
    cacheTag(cacheTags.eventsGlobal)

    return runQuery(async () => {
      const [rows, activeCountRows] = await Promise.all([
        getCachedSportsMenuRows(),
        getCachedActiveSportsCountRows(),
      ])
      const resolver = buildSportsSlugResolver(toMappingEntries(rows))
      const menuEntries = toSidebarMenuEntries(buildVerticalMenuRows(rows, vertical), vertical)
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

  async getLandingHref(vertical: SportsVertical = 'sports'): Promise<QueryResult<string | null>> {
    'use cache'
    cacheTag(cacheTags.eventsGlobal)

    return runQuery(async () => {
      const rows = await getCachedSportsMenuRows()
      const menuEntries = toSidebarMenuEntries(buildVerticalMenuRows(rows, vertical), vertical)

      return {
        data: findDefaultLandingHref(menuEntries),
        error: null,
      }
    })
  },

  async getFuturesHref(vertical: SportsVertical = 'sports'): Promise<QueryResult<string | null>> {
    'use cache'
    cacheTag(cacheTags.eventsGlobal)

    return runQuery(async () => {
      const rows = await getCachedSportsMenuRows()
      const menuEntries = toSidebarMenuEntries(buildVerticalMenuRows(rows, vertical), vertical)

      return {
        data: findDefaultFuturesHref(menuEntries),
        error: null,
      }
    })
  },
}
