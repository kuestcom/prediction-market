'use client'

import type { GroupExpansionOverride } from './sports-sidebar-menu-utils'
import type { SportsMenuEntry, SportsMenuLinkEntry } from '@/lib/sports-menu-types'
import type { SportsVertical } from '@/lib/sports-vertical'
import { useCallback, useMemo, useState, useSyncExternalStore } from 'react'
import {
  findActiveGroupId,
  isFutureMenuLinkHref,
  isLinkEntry,
  MOBILE_MENU_DEFAULT_VISIBLE_LINKS,
  resolveExpandedGroupId,
  resolveMobileVisiblePrimaryLinkCount,
} from './sports-sidebar-menu-utils'

export function useSidebarEntryDerivations({
  entries,
  vertical,
}: {
  entries: SportsMenuEntry[]
  vertical: SportsVertical
}) {
  const visibleEntries = useMemo(
    () => entries.filter((entry) => {
      return !(
        vertical === 'sports'
        && entry.type === 'link'
        && isFutureMenuLinkHref(entry.href, vertical)
      )
    }),
    [entries, vertical],
  )
  const primaryTopLevelLinks = useMemo(
    () => visibleEntries.filter(isLinkEntry),
    [visibleEntries],
  )
  const allMenuEntries = useMemo(
    () => visibleEntries.flatMap((entry) => {
      if (entry.type === 'link') {
        return [entry]
      }

      if (entry.type === 'group') {
        return [entry, ...entry.links]
      }

      return []
    }),
    [visibleEntries],
  )
  return { visibleEntries, primaryTopLevelLinks, allMenuEntries }
}

export function useSidebarGroupExpansion({
  visibleEntries,
  activeTagSlug,
}: {
  visibleEntries: SportsMenuEntry[]
  activeTagSlug: string | null
}) {
  const [groupExpansionOverride, setGroupExpansionOverride] = useState<GroupExpansionOverride>(null)
  const activeGroupId = useMemo(
    () => findActiveGroupId(visibleEntries, activeTagSlug),
    [activeTagSlug, visibleEntries],
  )
  const expandedGroupId = useMemo(
    () => resolveExpandedGroupId(groupExpansionOverride, activeGroupId, visibleEntries),
    [activeGroupId, groupExpansionOverride, visibleEntries],
  )

  function toggleExpandedGroup(groupId: string) {
    setGroupExpansionOverride((current) => {
      const currentExpandedGroupId = resolveExpandedGroupId(current, activeGroupId, visibleEntries)
      if (currentExpandedGroupId === groupId) {
        return { type: 'none' }
      }
      return { type: 'group', groupId }
    })
  }

  return { expandedGroupId, toggleExpandedGroup, setGroupExpansionOverride }
}

export function useMobileQuickMenuSizing({
  primaryTopLevelLinks,
}: {
  primaryTopLevelLinks: SportsMenuLinkEntry[]
}) {
  const [mobileQuickMenuContainer, setMobileQuickMenuContainer] = useState<HTMLDivElement | null>(null)
  const [isMobileMoreMenuOpen, setIsMobileMoreMenuOpen] = useState(false)

  const mobileQuickMenuContainerRef = useCallback((nextContainer: HTMLDivElement | null) => {
    setMobileQuickMenuContainer(nextContainer)
  }, [])

  const subscribeToMobileQuickMenuContainerWidth = useCallback((onStoreChange: () => void) => {
    if (!mobileQuickMenuContainer) {
      return function noopUnsubscribe() {}
    }

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', onStoreChange)
      return function removeMobileQuickMenuResizeListener() {
        window.removeEventListener('resize', onStoreChange)
      }
    }

    const resizeObserver = new ResizeObserver(() => onStoreChange())
    resizeObserver.observe(mobileQuickMenuContainer)

    return function disconnectMobileQuickMenuResizeObserver() {
      resizeObserver.disconnect()
    }
  }, [mobileQuickMenuContainer])

  const getMobileQuickMenuContainerWidth = useCallback(() => {
    return mobileQuickMenuContainer?.clientWidth ?? 0
  }, [mobileQuickMenuContainer])

  const mobileQuickMenuContainerWidth = useSyncExternalStore(
    subscribeToMobileQuickMenuContainerWidth,
    getMobileQuickMenuContainerWidth,
    () => 0,
  )
  const mobileVisiblePrimaryLinkCount = useMemo(() => {
    if (mobileQuickMenuContainerWidth <= 0) {
      return MOBILE_MENU_DEFAULT_VISIBLE_LINKS
    }
    return resolveMobileVisiblePrimaryLinkCount(mobileQuickMenuContainerWidth)
  }, [mobileQuickMenuContainerWidth])

  const mobileVisiblePrimaryLinks = useMemo(
    () => primaryTopLevelLinks.slice(0, mobileVisiblePrimaryLinkCount),
    [primaryTopLevelLinks, mobileVisiblePrimaryLinkCount],
  )

  return {
    mobileQuickMenuContainerRef,
    mobileVisiblePrimaryLinks,
    isMobileMoreMenuOpen,
    setIsMobileMoreMenuOpen,
  }
}
