'use client'

import type {
  SportsMenuEntry,
  SportsMenuGroupEntry,
  SportsMenuLinkEntry,
} from '@/lib/sports-menu-types'
import { ChevronDownIcon } from 'lucide-react'
import Image from 'next/image'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Drawer, DrawerContent } from '@/components/ui/drawer'
import { cn } from '@/lib/utils'

export type SportsSidebarMode = 'all' | 'live' | 'futures'

interface SportsSidebarMenuProps {
  entries: SportsMenuEntry[]
  mode: SportsSidebarMode
  activeTagSlug: string | null
  countByTagSlug?: Record<string, number>
  onSelectMode: (mode: SportsSidebarMode) => void
  onSelectTagSlug: (tagSlug: string, href: string) => void
  onNavigateHref: (href: string) => void
}

type SportsMenuChildLinkEntry = SportsMenuGroupEntry['links'][number]
type SportsMenuRenderableLinkEntry = SportsMenuLinkEntry | SportsMenuChildLinkEntry

const MOBILE_MENU_ITEM_WIDTH = 72
const MOBILE_MENU_ITEM_GAP = 6
const MOBILE_MENU_MIN_VISIBLE_LINKS = 1

function normalizeTagSlug(value: string | null | undefined) {
  return value?.trim().toLowerCase() || ''
}

function isFuturesMenuHref(value: string | null | undefined) {
  return normalizeTagSlug(value).startsWith('/sports/futures')
}

function areTagSlugsEquivalent(input: string | null | undefined, current: string | null | undefined) {
  const left = normalizeTagSlug(input)
  const right = normalizeTagSlug(current)

  if (!left || !right) {
    return false
  }

  return left === right
}

function isLinkEntry(entry: SportsMenuEntry): entry is SportsMenuLinkEntry {
  return entry.type === 'link'
}

function isGroupEntry(entry: SportsMenuEntry): entry is SportsMenuGroupEntry {
  return entry.type === 'group'
}

function isLiveMenuHref(value: string) {
  return value === '/sports/live'
}

function isFuturesMenuLinkHref(value: string) {
  return value.startsWith('/sports/futures')
}

function isMenuLinkActive({
  entry,
  mode,
  activeTagSlug,
}: {
  entry: SportsMenuRenderableLinkEntry
  mode: SportsSidebarMode
  activeTagSlug: string | null
}) {
  const href = normalizeTagSlug(entry.href)
  const isLiveLink = isLiveMenuHref(href)
  const isFuturesLink = isFuturesMenuLinkHref(href)

  if (isLiveLink) {
    return mode === 'live'
  }

  if (isFuturesLink) {
    return mode === 'futures'
  }

  return mode === 'all' && areTagSlugsEquivalent(entry.menuSlug, activeTagSlug)
}

function handleMenuLinkSelection({
  entry,
  onSelectMode,
  onSelectTagSlug,
  onNavigateHref,
  onActionComplete,
}: {
  entry: SportsMenuRenderableLinkEntry
  onSelectMode: (mode: SportsSidebarMode) => void
  onSelectTagSlug: (tagSlug: string, href: string) => void
  onNavigateHref: (href: string) => void
  onActionComplete?: () => void
}) {
  const href = normalizeTagSlug(entry.href)
  const isLiveLink = isLiveMenuHref(href)
  const isFuturesLink = isFuturesMenuLinkHref(href)
  const entryTagSlug = entry.menuSlug

  if (isLiveLink) {
    onSelectMode('live')
    onNavigateHref(entry.href)
    onActionComplete?.()
    return
  }

  if (isFuturesLink) {
    onSelectMode('futures')
    onNavigateHref(entry.href)
    onActionComplete?.()
    return
  }

  if (entryTagSlug) {
    onSelectTagSlug(entryTagSlug, entry.href)
    onActionComplete?.()
    return
  }

  onNavigateHref(entry.href)
  onActionComplete?.()
}

function resolveLinkEventsCount(
  entry: SportsMenuRenderableLinkEntry,
  countByTagSlug?: Record<string, number>,
) {
  const menuSlug = normalizeTagSlug(entry.menuSlug)
  if (!menuSlug) {
    return null
  }

  const count = countByTagSlug?.[menuSlug]
  if (typeof count !== 'number' || !Number.isFinite(count)) {
    return null
  }

  return Math.max(0, Math.round(count))
}

function resolveGroupEventsCount(
  entry: SportsMenuGroupEntry,
  countByTagSlug?: Record<string, number>,
) {
  let total = 0
  let hasCount = false

  for (const link of entry.links) {
    if (isFuturesMenuHref(link.href)) {
      continue
    }

    const count = resolveLinkEventsCount(link, countByTagSlug)
    if (count == null) {
      continue
    }

    total += count
    hasCount = true
  }

  return hasCount ? total : null
}

function LiveStatusIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 18 18"
      className={cn(className, 'text-red-500')}
      fill="none"
    >
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5">
        <path d="M5.641,12.359c-1.855-1.855-1.855-4.863,0-6.718" opacity="0.24">
          <animate
            attributeName="opacity"
            values="0.24;1;1;0.24;0.24"
            keyTimes="0;0.28;0.56;0.84;1"
            dur="1.8s"
            repeatCount="indefinite"
          />
        </path>
        <path d="M3.52,14.48C.493,11.454,.493,6.546,3.52,3.52" opacity="0.14">
          <animate
            attributeName="opacity"
            values="0.14;0.14;0.92;0.92;0.14;0.14"
            keyTimes="0;0.4;0.58;0.78;0.92;1"
            dur="1.8s"
            repeatCount="indefinite"
          />
        </path>
        <circle cx="9" cy="9" r="1.75" fill="none" stroke="currentColor" />
        <path d="M12.359,12.359c1.855-1.855,1.855-4.863,0-6.718" opacity="0.24">
          <animate
            attributeName="opacity"
            values="0.24;1;1;0.24;0.24"
            keyTimes="0;0.28;0.56;0.84;1"
            dur="1.8s"
            repeatCount="indefinite"
          />
        </path>
        <path d="M14.48,14.48c3.027-3.027,3.027-7.934,0-10.96" opacity="0.14">
          <animate
            attributeName="opacity"
            values="0.14;0.14;0.92;0.92;0.14;0.14"
            keyTimes="0;0.4;0.58;0.78;0.92;1"
            dur="1.8s"
            repeatCount="indefinite"
          />
        </path>
      </g>
    </svg>
  )
}

function FuturesStatusIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 18 18"
      className={cn(className, 'text-muted-foreground')}
      fill="none"
    >
      <rect
        x="2.75"
        y="2.75"
        width="12.5"
        height="12.5"
        rx="2"
        ry="2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <line
        x1="5.75"
        y1="8"
        x2="5.75"
        y2="12.25"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <line
        x1="12.25"
        y1="10.25"
        x2="12.25"
        y2="12.25"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <line
        x1="9"
        y1="5.75"
        x2="9"
        y2="12.25"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  )
}

function SportsMenuIcon({
  className,
  entry,
  isFuturesLink,
  isLiveLink,
  nested,
}: {
  className?: string
  entry: SportsMenuRenderableLinkEntry
  isFuturesLink: boolean
  isLiveLink: boolean
  nested: boolean
}) {
  if (isLiveLink && !nested) {
    return <LiveStatusIcon className={className} />
  }

  if (isFuturesLink && !nested) {
    return <FuturesStatusIcon className={className} />
  }

  return (
    <Image
      src={entry.iconPath}
      alt=""
      width={nested ? 16 : 20}
      height={nested ? 16 : 20}
      className={cn('size-full object-contain', className)}
    />
  )
}

function SportsMobileQuickLink({
  entry,
  mode,
  activeTagSlug,
  onSelectMode,
  onSelectTagSlug,
  onNavigateHref,
}: {
  entry: SportsMenuLinkEntry
  mode: SportsSidebarMode
  activeTagSlug: string | null
  onSelectMode: (mode: SportsSidebarMode) => void
  onSelectTagSlug: (tagSlug: string, href: string) => void
  onNavigateHref: (href: string) => void
}) {
  const href = normalizeTagSlug(entry.href)
  const isLiveLink = isLiveMenuHref(href)
  const isFuturesLink = isFuturesMenuLinkHref(href)
  const isActive = isMenuLinkActive({ entry, mode, activeTagSlug })

  return (
    <button
      type="button"
      onClick={() => {
        handleMenuLinkSelection({
          entry,
          onSelectMode,
          onSelectTagSlug,
          onNavigateHref,
        })
      }}
      className={cn(
        `
          flex h-19 w-[72px] shrink-0 flex-col items-center justify-center gap-1 rounded-xl px-1.5 py-2 text-center
          transition-colors
        `,
        isActive ? 'bg-muted/75' : 'bg-transparent hover:bg-muted/55',
      )}
    >
      <span className="size-6">
        <SportsMenuIcon
          entry={entry}
          isFuturesLink={isFuturesLink}
          isLiveLink={isLiveLink}
          nested={false}
          className="size-full"
        />
      </span>
      <span className="w-full truncate text-2xs leading-none font-semibold tracking-[0.05em] text-foreground uppercase">
        {entry.label}
      </span>
    </button>
  )
}

function SportsMobileSheetLink({
  entry,
  nested = false,
  mode,
  activeTagSlug,
  countByTagSlug,
  onSelectMode,
  onSelectTagSlug,
  onNavigateHref,
  onActionComplete,
}: {
  entry: SportsMenuRenderableLinkEntry
  nested?: boolean
  mode: SportsSidebarMode
  activeTagSlug: string | null
  countByTagSlug?: Record<string, number>
  onSelectMode: (mode: SportsSidebarMode) => void
  onSelectTagSlug: (tagSlug: string, href: string) => void
  onNavigateHref: (href: string) => void
  onActionComplete?: () => void
}) {
  const href = normalizeTagSlug(entry.href)
  const isLiveLink = isLiveMenuHref(href)
  const isFuturesLink = isFuturesMenuLinkHref(href)
  const isActive = isMenuLinkActive({ entry, mode, activeTagSlug })
  const displayCount = resolveLinkEventsCount(entry, countByTagSlug)

  return (
    <button
      type="button"
      onClick={() => {
        handleMenuLinkSelection({
          entry,
          onSelectMode,
          onSelectTagSlug,
          onNavigateHref,
          onActionComplete,
        })
      }}
      className={cn(
        `flex w-full items-center gap-2.5 rounded-md px-3 py-3 text-left transition-colors hover:bg-muted/55`,
        nested && 'py-2.5 pl-7',
        isActive ? 'bg-muted/70' : 'bg-transparent',
      )}
    >
      <span className={cn('shrink-0', nested ? 'size-4' : 'size-5')}>
        <SportsMenuIcon
          entry={entry}
          isFuturesLink={isFuturesLink}
          isLiveLink={isLiveLink}
          nested={nested}
          className="size-full"
        />
      </span>

      <span
        className={cn(
          'min-w-0 truncate text-foreground',
          nested ? 'text-sm font-medium' : 'text-sm font-semibold',
        )}
      >
        {entry.label}
      </span>

      {displayCount != null && (
        <span className="ml-auto shrink-0 text-xs font-medium text-muted-foreground tabular-nums">
          (
          {displayCount}
          )
        </span>
      )}
    </button>
  )
}

function SportsMenuLink({
  entry,
  nested = false,
  mode,
  activeTagSlug,
  countByTagSlug,
  onSelectMode,
  onSelectTagSlug,
  onNavigateHref,
  onActionComplete,
}: {
  entry: SportsMenuRenderableLinkEntry
  nested?: boolean
  mode: SportsSidebarMode
  activeTagSlug: string | null
  countByTagSlug?: Record<string, number>
  onSelectMode: (mode: SportsSidebarMode) => void
  onSelectTagSlug: (tagSlug: string, href: string) => void
  onNavigateHref: (href: string) => void
  onActionComplete?: () => void
}) {
  const href = normalizeTagSlug(entry.href)
  const isLiveLink = isLiveMenuHref(href)
  const isFuturesLink = isFuturesMenuLinkHref(href)
  const entryTagSlug = entry.menuSlug
  const isActive = isMenuLinkActive({ entry, mode, activeTagSlug })
  const dynamicCount = entryTagSlug ? countByTagSlug?.[entryTagSlug] : null
  const displayCount = typeof dynamicCount === 'number' && dynamicCount > 0
    ? dynamicCount
    : null

  function handleClick() {
    handleMenuLinkSelection({
      entry,
      onSelectMode,
      onSelectTagSlug,
      onNavigateHref,
      onActionComplete,
    })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        `flex w-full items-center justify-between rounded-md p-3 text-left transition-colors hover:bg-muted/55`,
        nested && 'py-2.5',
        isActive ? 'bg-muted/70' : 'bg-transparent',
      )}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2.5">
        <span className={cn('shrink-0', nested ? 'size-4' : 'size-5')}>
          <SportsMenuIcon
            entry={entry}
            isFuturesLink={isFuturesLink}
            isLiveLink={isLiveLink}
            nested={nested}
            className="size-full"
          />
        </span>
        <span
          className={cn(
            'truncate text-foreground',
            nested ? 'text-sm font-medium' : 'text-sm font-semibold',
          )}
        >
          {entry.label}
        </span>
      </span>

      {displayCount !== null && (
        <span className="shrink-0 pl-2 text-xs font-semibold text-muted-foreground tabular-nums">
          {displayCount}
        </span>
      )}
    </button>
  )
}

export default function SportsSidebarMenu({
  entries,
  mode,
  activeTagSlug,
  countByTagSlug,
  onSelectMode,
  onSelectTagSlug,
  onNavigateHref,
}: SportsSidebarMenuProps) {
  const mobileQuickMenuContainerRef = useRef<HTMLDivElement | null>(null)
  const [isMobileMoreMenuOpen, setIsMobileMoreMenuOpen] = useState(false)
  const [mobileVisiblePrimaryLinkCount, setMobileVisiblePrimaryLinkCount] = useState(4)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    const groups = entries.filter(isGroupEntry)
    return Object.fromEntries(groups.map(group => [group.id, false]))
  })
  const nonFuturesTopLevelLinks = useMemo(
    () => entries
      .filter(isLinkEntry)
      .filter(entry => !isFuturesMenuHref(entry.href)),
    [entries],
  )
  const allNonFuturesLinks = useMemo(
    () => entries.flatMap((entry) => {
      if (entry.type === 'link') {
        return isFuturesMenuHref(entry.href) ? [] : [entry]
      }

      if (entry.type === 'group') {
        return entry.links.filter(link => !isFuturesMenuHref(link.href))
      }

      return []
    }),
    [entries],
  )
  const mobileVisiblePrimaryLinks = useMemo(
    () => nonFuturesTopLevelLinks.slice(0, mobileVisiblePrimaryLinkCount),
    [nonFuturesTopLevelLinks, mobileVisiblePrimaryLinkCount],
  )
  const hasVisibleActiveMobilePrimaryLink = mobileVisiblePrimaryLinks.some(entry => isMenuLinkActive({
    entry,
    mode,
    activeTagSlug,
  }))
  const isMobileMoreButtonActive = !hasVisibleActiveMobilePrimaryLink && allNonFuturesLinks.some(entry =>
    isMenuLinkActive({
      entry,
      mode,
      activeTagSlug,
    }),
  )

  useEffect(() => {
    const groupIds = entries
      .filter(isGroupEntry)
      .map(group => group.id)

    setExpandedGroups((current) => {
      const next: Record<string, boolean> = {}
      let changed = false

      for (const groupId of groupIds) {
        next[groupId] = current[groupId] ?? false
      }

      if (Object.keys(current).length !== Object.keys(next).length) {
        changed = true
      }
      else {
        for (const groupId of groupIds) {
          if ((current[groupId] ?? false) !== next[groupId]) {
            changed = true
            break
          }
        }
      }

      return changed ? next : current
    })
  }, [entries])

  useEffect(() => {
    const container = mobileQuickMenuContainerRef.current
    if (!container) {
      return
    }

    function updateVisibleLinkCount() {
      const nextContainer = mobileQuickMenuContainerRef.current
      if (!nextContainer) {
        return
      }

      const width = nextContainer.clientWidth
      if (width <= 0) {
        return
      }

      const slotCount = Math.max(
        2,
        Math.floor((width + MOBILE_MENU_ITEM_GAP) / (MOBILE_MENU_ITEM_WIDTH + MOBILE_MENU_ITEM_GAP)),
      )
      const nextCount = Math.max(MOBILE_MENU_MIN_VISIBLE_LINKS, slotCount - 1)
      setMobileVisiblePrimaryLinkCount(current => (current === nextCount ? current : nextCount))
    }

    updateVisibleLinkCount()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateVisibleLinkCount)
      return () => {
        window.removeEventListener('resize', updateVisibleLinkCount)
      }
    }

    const resizeObserver = new ResizeObserver(updateVisibleLinkCount)
    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  function renderDesktopMenuEntries(onActionComplete?: () => void) {
    return entries.map((entry) => {
      if (entry.type === 'divider') {
        return <div key={entry.id} className="mb-2 w-full border-b border-border pb-2" />
      }

      if (entry.type === 'header') {
        return (
          <div
            key={entry.id}
            className={`
              mt-2 mb-1 flex w-full items-center px-3 py-2 text-left text-[11px] font-semibold tracking-[0.08em]
              text-muted-foreground uppercase
            `}
          >
            {entry.label}
          </div>
        )
      }

      if (isLinkEntry(entry)) {
        if (isFuturesMenuHref(entry.href)) {
          return null
        }

        return (
          <SportsMenuLink
            key={entry.id}
            entry={entry}
            mode={mode}
            activeTagSlug={activeTagSlug}
            countByTagSlug={countByTagSlug}
            onSelectMode={onSelectMode}
            onSelectTagSlug={onSelectTagSlug}
            onNavigateHref={onNavigateHref}
            onActionComplete={onActionComplete}
          />
        )
      }

      const visibleLinks = entry.links.filter(link => !isFuturesMenuHref(link.href))
      if (visibleLinks.length === 0) {
        return null
      }

      const isExpanded = expandedGroups[entry.id] ?? true
      return (
        <div key={entry.id}>
          <button
            type="button"
            className={`
              flex w-full items-center justify-between rounded-md bg-transparent px-3 py-3 text-left transition-colors
              hover:bg-muted/55
            `}
            onClick={() => {
              setExpandedGroups(current => ({
                ...current,
                [entry.id]: !(current[entry.id] ?? true),
              }))
            }}
          >
            <span className="flex min-w-0 flex-1 items-center gap-2.5">
              <span className="size-5 shrink-0">
                <Image
                  src={entry.iconPath}
                  alt=""
                  width={20}
                  height={20}
                  className="size-full object-contain"
                />
              </span>
              <span className="truncate text-sm font-semibold text-foreground">{entry.label}</span>
            </span>
            <ChevronDownIcon
              className={cn(
                'size-3.5 shrink-0 text-muted-foreground transition-transform duration-200',
                isExpanded ? 'rotate-180' : 'rotate-0',
              )}
            />
          </button>

          <div
            aria-hidden={!isExpanded}
            className={cn(
              `grid overflow-hidden transition-[grid-template-rows,opacity] duration-300 ease-out`,
              isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-65',
            )}
          >
            <div className="min-h-0 overflow-hidden">
              <div className="flex flex-col pt-0.5 pl-5">
                {visibleLinks.map(link => (
                  <SportsMenuLink
                    key={link.id}
                    entry={link}
                    nested
                    mode={mode}
                    activeTagSlug={activeTagSlug}
                    countByTagSlug={countByTagSlug}
                    onSelectMode={onSelectMode}
                    onSelectTagSlug={onSelectTagSlug}
                    onNavigateHref={onNavigateHref}
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
    return entries.map((entry) => {
      if (entry.type === 'divider') {
        return <div key={entry.id} className="my-1.5 w-full border-b border-border" />
      }

      if (entry.type === 'header') {
        return (
          <div
            key={entry.id}
            className={`
              mt-2 mb-1 px-3 py-1.5 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase
            `}
          >
            {entry.label}
          </div>
        )
      }

      if (isLinkEntry(entry)) {
        if (isFuturesMenuHref(entry.href)) {
          return null
        }

        return (
          <SportsMobileSheetLink
            key={entry.id}
            entry={entry}
            mode={mode}
            activeTagSlug={activeTagSlug}
            countByTagSlug={countByTagSlug}
            onSelectMode={onSelectMode}
            onSelectTagSlug={onSelectTagSlug}
            onNavigateHref={onNavigateHref}
            onActionComplete={() => setIsMobileMoreMenuOpen(false)}
          />
        )
      }

      const visibleLinks = entry.links.filter(link => !isFuturesMenuHref(link.href))
      if (visibleLinks.length === 0) {
        return null
      }

      const isExpanded = expandedGroups[entry.id] ?? true
      const groupCount = resolveGroupEventsCount(entry, countByTagSlug)

      return (
        <div key={entry.id}>
          <button
            type="button"
            className={`
              flex w-full items-center gap-2.5 rounded-md px-3 py-3 text-left transition-colors
              hover:bg-muted/55
            `}
            onClick={() => {
              setExpandedGroups(current => ({
                ...current,
                [entry.id]: !(current[entry.id] ?? true),
              }))
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
                    nested
                    mode={mode}
                    activeTagSlug={activeTagSlug}
                    countByTagSlug={countByTagSlug}
                    onSelectMode={onSelectMode}
                    onSelectTagSlug={onSelectTagSlug}
                    onNavigateHref={onNavigateHref}
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
      <nav className="mb-3 pb-2 lg:hidden">
        <div ref={mobileQuickMenuContainerRef} className="flex min-w-0 items-stretch gap-1.5 overflow-hidden">
          {mobileVisiblePrimaryLinks.map(entry => (
            <SportsMobileQuickLink
              key={entry.id}
              entry={entry}
              mode={mode}
              activeTagSlug={activeTagSlug}
              onSelectMode={onSelectMode}
              onSelectTagSlug={onSelectTagSlug}
              onNavigateHref={onNavigateHref}
            />
          ))}

          <button
            type="button"
            onClick={() => setIsMobileMoreMenuOpen(true)}
            className={cn(
              `
                flex h-19 w-[72px] shrink-0 flex-col items-center justify-center rounded-xl px-1.5 py-2 text-center
                transition-colors
              `,
              isMobileMoreButtonActive || isMobileMoreMenuOpen
                ? 'bg-muted/75'
                : 'bg-transparent hover:bg-muted/55',
            )}
            aria-label="Open more sports"
          >
            <span className="relative -top-1 text-[30px] leading-none font-bold text-foreground">...</span>
            <span className="
              w-full truncate text-2xs leading-none font-semibold tracking-[0.05em] text-foreground uppercase
            "
            >
              More
            </span>
          </button>
        </div>

        <Drawer open={isMobileMoreMenuOpen} onOpenChange={setIsMobileMoreMenuOpen}>
          <DrawerContent className="max-h-[88vh] w-full border-border/70 bg-background px-0 pt-2 pb-4">
            <div className="px-4 pb-2">
              <p className="text-base font-semibold text-foreground">Sports</p>
            </div>
            <div className="max-h-[72dvh] overflow-y-auto px-2">
              {renderMobileSheetMenuEntries()}
            </div>
          </DrawerContent>
        </Drawer>
      </nav>

      <aside
        data-sports-scroll-pane="sidebar"
        className={`
          hidden w-[180px] shrink-0 self-start
          lg:sticky lg:top-22 lg:flex lg:max-h-[calc(100vh-5.5rem)] lg:flex-col lg:overflow-y-auto lg:py-2 lg:pr-1
        `}
      >
        {renderDesktopMenuEntries()}
      </aside>
    </>
  )
}
