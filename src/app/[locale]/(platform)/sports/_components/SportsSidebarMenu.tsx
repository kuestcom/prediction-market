'use client'

import type { SportsSidebarMenuProps } from './sports-sidebar-menu/sports-sidebar-menu-utils'
import { ChevronDownIcon, MoreHorizontalIcon } from 'lucide-react'
import Image from 'next/image'
import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { getSportsVerticalConfig } from '@/lib/sports-vertical'
import { cn } from '@/lib/utils'
import {
  useMobileQuickMenuSizing,
  useSidebarEntryDerivations,
  useSidebarGroupExpansion,
} from './sports-sidebar-menu/sports-sidebar-menu-hooks'
import {
  isLinkEntry,
  isMenuEntryActive,
  isMenuGroupActive,
  isMenuLinkActive,
  MOBILE_MENU_ITEM_GAP,
  resolveGroupEventsCount,
} from './sports-sidebar-menu/sports-sidebar-menu-utils'
import SportsMenuLink from './sports-sidebar-menu/SportsMenuLink'
import SportsMobileQuickLink from './sports-sidebar-menu/SportsMobileQuickLink'
import SportsMobileSheetLink from './sports-sidebar-menu/SportsMobileSheetLink'

export type { SportsSidebarMode } from './sports-sidebar-menu/sports-sidebar-menu-utils'

export default function SportsSidebarMenu({
  entries,
  vertical,
  mode,
  activeTagSlug,
  countByTagSlug,
  independentScroll = false,
}: SportsSidebarMenuProps) {
  const verticalConfig = getSportsVerticalConfig(vertical)
  const { visibleEntries, primaryTopLevelLinks, allMenuEntries } = useSidebarEntryDerivations({
    entries,
    vertical,
  })
  const { expandedGroupId, toggleExpandedGroup } = useSidebarGroupExpansion({
    visibleEntries,
    activeTagSlug,
  })
  const {
    mobileQuickMenuContainerRef,
    mobileVisiblePrimaryLinks,
    isMobileMoreMenuOpen,
    setIsMobileMoreMenuOpen,
  } = useMobileQuickMenuSizing({ primaryTopLevelLinks })
  const mobileQuickNavColumnCount = Math.max(1, mobileVisiblePrimaryLinks.length + 1)
  const hasVisibleActiveMobilePrimaryLink = mobileVisiblePrimaryLinks.some(entry => isMenuLinkActive({
    entry,
    vertical,
    mode,
    activeTagSlug,
  }))
  const isMobileMoreButtonActive = !hasVisibleActiveMobilePrimaryLink && allMenuEntries.some(entry =>
    isMenuEntryActive({
      entry,
      vertical,
      mode,
      activeTagSlug,
    }),
  )

  function renderDesktopMenuEntries(onActionComplete?: () => void) {
    return visibleEntries.map((entry) => {
      if (entry.type === 'divider') {
        return <div key={entry.id} className="mb-2 w-full border-b pb-2" />
      }

      if (entry.type === 'header') {
        return (
          <div
            key={entry.id}
            className={cn(
              `
                mt-2 mb-1.5 flex items-center px-3 py-1.5 text-[11px] font-medium tracking-wider whitespace-nowrap
                text-muted-foreground uppercase
              `,
            )}
          >
            {entry.label}
          </div>
        )
      }

      if (isLinkEntry(entry)) {
        return (
          <SportsMenuLink
            key={entry.id}
            entry={entry}
            vertical={vertical}
            mode={mode}
            activeTagSlug={activeTagSlug}
            countByTagSlug={countByTagSlug}
            onActionComplete={onActionComplete}
          />
        )
      }

      const visibleLinks = entry.links
      if (visibleLinks.length === 0) {
        return null
      }

      const isExpanded = expandedGroupId === entry.id
      const panelId = `${entry.id}-desktop-panel`

      return (
        <div key={entry.id}>
          <button
            type="button"
            aria-expanded={isExpanded}
            aria-controls={panelId}
            onClick={() => toggleExpandedGroup(entry.id)}
            className={cn(
              `
                flex w-full flex-row items-center justify-between rounded-md p-3 text-left transition-colors
                hover:bg-muted
              `,
              isExpanded ? 'bg-muted' : 'bg-transparent',
            )}
          >
            <span className="flex min-w-0 items-center gap-x-2.5">
              <span className="size-5 shrink-0 text-muted-foreground [&_svg]:size-5">
                <Image
                  src={entry.iconPath}
                  alt=""
                  width={20}
                  height={20}
                  className="size-full object-contain"
                />
              </span>
              <span className="truncate text-sm font-semibold">{entry.label}</span>
            </span>
            <ChevronDownIcon
              className={cn(
                'size-3 shrink-0 text-muted-foreground transition-transform duration-200',
                isExpanded ? 'rotate-180' : 'rotate-0',
              )}
            />
          </button>

          <div
            id={panelId}
            aria-hidden={!isExpanded}
            className={cn(
              'grid overflow-hidden transition-[grid-template-rows,opacity] duration-300 ease-out',
              isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
            )}
          >
            <div className="min-h-0 overflow-hidden">
              <div className="flex flex-col pt-0.5 pl-5">
                {visibleLinks.map(link => (
                  <SportsMenuLink
                    key={link.id}
                    entry={link}
                    vertical={vertical}
                    nested
                    mode={mode}
                    activeTagSlug={activeTagSlug}
                    countByTagSlug={countByTagSlug}
                    onActionComplete={onActionComplete}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )
    })
  }

  function renderMobileSheetMenuEntries() {
    return visibleEntries.map((entry) => {
      if (entry.type === 'divider') {
        return <div key={entry.id} className="my-1.5 w-full border-b border-border" />
      }

      if (entry.type === 'header') {
        return (
          <div
            key={entry.id}
            className={cn(`
              mt-1.5 mb-0.5 px-3 py-1 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase
            `)}
          >
            {entry.label}
          </div>
        )
      }

      if (isLinkEntry(entry)) {
        return (
          <SportsMobileSheetLink
            key={entry.id}
            entry={entry}
            vertical={vertical}
            mode={mode}
            activeTagSlug={activeTagSlug}
            countByTagSlug={countByTagSlug}
            onActionComplete={() => setIsMobileMoreMenuOpen(false)}
          />
        )
      }

      const visibleLinks = entry.links
      if (visibleLinks.length === 0) {
        return null
      }

      const isExpanded = expandedGroupId === entry.id
      const isGroupActive = isMenuGroupActive(entry, activeTagSlug)
      const groupCount = resolveGroupEventsCount(entry, vertical, countByTagSlug)
      const panelId = `${entry.id}-mobile-panel`

      return (
        <div key={entry.id}>
          <button
            type="button"
            aria-expanded={isExpanded}
            aria-controls={panelId}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-md p-3 text-left transition-colors hover:bg-muted',
              isGroupActive ? 'bg-muted' : 'bg-transparent',
            )}
            onClick={() => {
              toggleExpandedGroup(entry.id)
            }}
          >
            <span className="size-5 shrink-0">
              <Image
                src={entry.iconPath}
                alt=""
                width={20}
                height={20}
                className="size-full object-contain"
              />
            </span>

            <span className="min-w-0 truncate text-sm font-semibold text-foreground">
              {entry.label}
            </span>

            {groupCount != null && (
              <span className="shrink-0 text-xs font-medium text-muted-foreground tabular-nums">
                (
                {groupCount}
                )
              </span>
            )}

            <ChevronDownIcon
              className={cn(
                'ml-auto size-4 shrink-0 text-muted-foreground transition-transform duration-200',
                isExpanded ? 'rotate-0' : '-rotate-90',
              )}
            />
          </button>

          <div
            id={panelId}
            aria-hidden={!isExpanded}
            className={cn(
              'grid overflow-hidden transition-[grid-template-rows,opacity] duration-300 ease-out',
              isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-65',
            )}
          >
            <div className="min-h-0 overflow-hidden pb-1">
              <div className="flex flex-col gap-0.5">
                {visibleLinks.map(link => (
                  <SportsMobileSheetLink
                    key={link.id}
                    entry={link}
                    vertical={vertical}
                    nested
                    mode={mode}
                    activeTagSlug={activeTagSlug}
                    countByTagSlug={countByTagSlug}
                    onActionComplete={() => setIsMobileMoreMenuOpen(false)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )
    })
  }

  return (
    <>
      <Drawer open={isMobileMoreMenuOpen} onOpenChange={setIsMobileMoreMenuOpen}>
        <nav className="mb-3 pb-2 min-[1200px]:hidden">
          <div
            ref={mobileQuickMenuContainerRef}
            className="grid min-w-0 items-stretch"
            style={{
              gap: `${MOBILE_MENU_ITEM_GAP}px`,
              gridTemplateColumns: `repeat(${mobileQuickNavColumnCount}, minmax(0, 1fr))`,
            }}
          >
            {mobileVisiblePrimaryLinks.map(entry => (
              <SportsMobileQuickLink
                key={entry.id}
                entry={entry}
                vertical={vertical}
                mode={mode}
                activeTagSlug={activeTagSlug}
              />
            ))}

            <DrawerTrigger asChild>
              <button
                type="button"
                className={cn(
                  `
                    flex h-[60px] min-w-0 flex-col items-center justify-center gap-1 rounded-md px-1 py-2 text-center
                    transition-colors
                  `,
                  isMobileMoreButtonActive || isMobileMoreMenuOpen
                    ? 'bg-muted'
                    : 'bg-transparent hover:bg-muted',
                )}
                aria-label={`Open more ${verticalConfig.label.toLowerCase()}`}
              >
                <span className="flex size-5 shrink-0 items-center justify-center text-muted-foreground">
                  <MoreHorizontalIcon className="size-5 text-foreground" />
                </span>
                <span className="w-full truncate text-[11px] leading-tight font-medium text-foreground">
                  More
                </span>
              </button>
            </DrawerTrigger>
          </div>
        </nav>

        <DrawerContent className="max-h-[88vh] w-full border-border/70 bg-background px-0 pt-2 pb-4">
          <DrawerTitle className="sr-only">{verticalConfig.label}</DrawerTitle>
          <div className="mt-4 max-h-[72dvh] overflow-y-auto px-2">
            {renderMobileSheetMenuEntries()}
          </div>
        </DrawerContent>
      </Drawer>

      <aside
        data-sports-scroll-pane="sidebar"
        className={cn(
          'hidden w-[190px] shrink-0',
          independentScroll
            ? `
              min-[1200px]:flex min-[1200px]:h-full min-[1200px]:min-h-0 min-[1200px]:flex-col
              min-[1200px]:justify-start min-[1200px]:overflow-y-auto min-[1200px]:overscroll-contain min-[1200px]:pt-2
              min-[1200px]:pb-8
            `
            : `
              min-[1200px]:sticky min-[1200px]:top-22 min-[1200px]:flex min-[1200px]:h-[calc(100vh-5.5rem)]
              min-[1200px]:flex-col min-[1200px]:justify-start min-[1200px]:overflow-y-auto
              min-[1200px]:overscroll-contain min-[1200px]:py-8
            `,
        )}
      >
        {renderDesktopMenuEntries()}
      </aside>
    </>
  )
}
