import type {
  SportsMenuEntry,
  SportsMenuGroupEntry,
  SportsMenuLinkEntry,
} from '@/lib/sports-menu-types'
import type { SportsVertical } from '@/lib/sports-vertical'
import {
  isSportsSidebarFutureHref,
  isSportsSidebarLiveHref,
  isSportsSidebarSoonHref,
  resolveSportsSidebarCountKey,
} from '@/lib/sports-sidebar-counts'

export type SportsSidebarMode = 'all' | 'live' | 'soon' | 'futures'

export interface SportsSidebarMenuProps {
  entries: SportsMenuEntry[]
  vertical: SportsVertical
  mode: SportsSidebarMode
  activeTagSlug: string | null
  countByTagSlug?: Record<string, number>
  independentScroll?: boolean
}

type SportsMenuChildLinkEntry = SportsMenuGroupEntry['links'][number]
export type SportsMenuRenderableLinkEntry = SportsMenuLinkEntry | SportsMenuChildLinkEntry
export type SportsMenuNavigableEntry = SportsMenuRenderableLinkEntry | SportsMenuGroupEntry

const MOBILE_MENU_ITEM_MIN_WIDTH = 56
export const MOBILE_MENU_ITEM_GAP = 4
const MOBILE_MENU_MIN_VISIBLE_LINKS = 1
export const MOBILE_MENU_DEFAULT_VISIBLE_LINKS = 5

export type GroupExpansionOverride = { type: 'none' } | { type: 'group', groupId: string } | null

export function resolveMobileVisiblePrimaryLinkCount(width: number) {
  if (width <= 0) {
    return MOBILE_MENU_DEFAULT_VISIBLE_LINKS
  }

  const slotCount = Math.max(
    2,
    Math.floor((width + MOBILE_MENU_ITEM_GAP) / (MOBILE_MENU_ITEM_MIN_WIDTH + MOBILE_MENU_ITEM_GAP)),
  )
  return Math.max(MOBILE_MENU_MIN_VISIBLE_LINKS, slotCount - 1)
}

export function resolveExpandedGroupId(
  override: GroupExpansionOverride,
  activeGroupId: string | null,
  visibleEntries: SportsMenuEntry[],
) {
  if (override?.type === 'none') {
    return null
  }

  if (override?.type === 'group') {
    const hasGroup = visibleEntries
      .filter(isGroupEntry)
      .some(entry => entry.id === override.groupId)
    if (hasGroup) {
      return override.groupId
    }
  }

  return activeGroupId
}

export function normalizeTagSlug(value: string | null | undefined) {
  return value?.trim().toLowerCase() || ''
}

export function areTagSlugsEquivalent(input: string | null | undefined, current: string | null | undefined) {
  const left = normalizeTagSlug(input)
  const right = normalizeTagSlug(current)

  if (!left || !right) {
    return false
  }

  return left === right
}

export function isLinkEntry(entry: SportsMenuEntry): entry is SportsMenuLinkEntry {
  return entry.type === 'link'
}

function isGroupEntry(entry: SportsMenuEntry): entry is SportsMenuGroupEntry {
  return entry.type === 'group'
}

export function isLiveMenuHref(value: string, vertical: SportsVertical) {
  return isSportsSidebarLiveHref(value, vertical)
}

export function isFutureMenuLinkHref(value: string, vertical: SportsVertical) {
  return isSportsSidebarFutureHref(value, vertical)
}

export function isSoonMenuLinkHref(value: string, vertical: SportsVertical) {
  return isSportsSidebarSoonHref(value, vertical)
}

export function isMenuLinkActive({
  entry,
  vertical,
  mode,
  activeTagSlug,
}: {
  entry: SportsMenuRenderableLinkEntry
  vertical: SportsVertical
  mode: SportsSidebarMode
  activeTagSlug: string | null
}) {
  const href = normalizeTagSlug(entry.href)
  const isLiveLink = isLiveMenuHref(href, vertical)
  const isSoonLink = isSoonMenuLinkHref(href, vertical)
  const isFutureLink = isFutureMenuLinkHref(href, vertical)

  if (isLiveLink) {
    return mode === 'live'
  }

  if (isSoonLink) {
    return mode === 'soon'
  }

  if (isFutureLink) {
    return mode === 'futures'
  }

  return mode === 'all' && areTagSlugsEquivalent(entry.menuSlug, activeTagSlug)
}

export function isMenuGroupActive(entry: SportsMenuGroupEntry, activeTagSlug: string | null) {
  if (areTagSlugsEquivalent(entry.menuSlug, activeTagSlug)) {
    return true
  }

  return entry.links.some(link => areTagSlugsEquivalent(link.menuSlug, activeTagSlug))
}

export function isMenuEntryActive({
  entry,
  vertical,
  mode,
  activeTagSlug,
}: {
  entry: SportsMenuNavigableEntry
  vertical: SportsVertical
  mode: SportsSidebarMode
  activeTagSlug: string | null
}) {
  if (entry.type === 'group') {
    return mode === 'all' && isMenuGroupActive(entry, activeTagSlug)
  }

  return isMenuLinkActive({
    entry,
    vertical,
    mode,
    activeTagSlug,
  })
}

export function resolveLinkEventsCount(
  entry: SportsMenuRenderableLinkEntry,
  vertical: SportsVertical,
  countByTagSlug?: Record<string, number>,
) {
  const countKey = resolveSportsSidebarCountKey({
    href: entry.href,
    menuSlug: entry.menuSlug,
    vertical,
  })
  if (!countKey) {
    return null
  }

  const count = countByTagSlug?.[countKey]
  if (typeof count !== 'number' || !Number.isFinite(count)) {
    return null
  }

  return Math.max(0, Math.round(count))
}

export function resolveGroupEventsCount(
  entry: SportsMenuGroupEntry,
  vertical: SportsVertical,
  countByTagSlug?: Record<string, number>,
) {
  let total = 0
  let hasCount = false

  for (const link of entry.links) {
    const count = resolveLinkEventsCount(link, vertical, countByTagSlug)
    if (count == null) {
      continue
    }

    total += count
    hasCount = true
  }

  return hasCount ? total : null
}

export function findActiveGroupId(entries: SportsMenuEntry[], activeTagSlug: string | null) {
  const activeGroup = entries
    .filter(isGroupEntry)
    .find(entry => isMenuGroupActive(entry, activeTagSlug))

  return activeGroup?.id ?? null
}
