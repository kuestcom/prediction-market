'use client'

import type { Route } from 'next'
import type {
  SportsMenuEntry,
  SportsMenuGroupEntry,
  SportsMenuLinkEntry,
} from '@/lib/sports-menu-types'
import type { SportsVertical } from '@/lib/sports-vertical'
import { ChevronDownIcon } from 'lucide-react'
import Image from 'next/image'
import { useEffect, useMemo, useRef, useState } from 'react'
import IntentPrefetchLink from '@/components/IntentPrefetchLink'
import { Drawer, DrawerContent } from '@/components/ui/drawer'
import { getSportsVerticalConfig } from '@/lib/sports-vertical'
import { cn } from '@/lib/utils'

export type SportsSidebarMode = 'all' | 'live' | 'futures'

interface SportsSidebarMenuProps {
  entries: SportsMenuEntry[]
  vertical: SportsVertical
  mode: SportsSidebarMode
  activeTagSlug: string | null
  countByTagSlug?: Record<string, number>
}

type SportsMenuChildLinkEntry = SportsMenuGroupEntry['links'][number]
type SportsMenuRenderableLinkEntry = SportsMenuLinkEntry | SportsMenuChildLinkEntry
type SportsMenuNavigableEntry = SportsMenuRenderableLinkEntry | SportsMenuGroupEntry

const MOBILE_MENU_ITEM_WIDTH = 72
const MOBILE_MENU_ITEM_GAP = 6
const MOBILE_MENU_MIN_VISIBLE_LINKS = 1

function normalizeTagSlug(value: string | null | undefined) {
  return value?.trim().toLowerCase() || ''
}

// function isFutureMenuHref(value: string | null | undefined, vertical: SportsVertical) {
//   return normalizeTagSlug(value).startsWith(normalizeTagSlug(getSportsVerticalConfig(vertical).futurePathPrefix))
// }

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

function isLiveMenuHref(value: string, vertical: SportsVertical) {
  return value === normalizeTagSlug(getSportsVerticalConfig(vertical).livePath)
}

function isFutureMenuLinkHref(value: string, vertical: SportsVertical) {
  return value.startsWith(normalizeTagSlug(getSportsVerticalConfig(vertical).futurePathPrefix))
}

function isMenuLinkActive({
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
  const isFutureLink = isFutureMenuLinkHref(href, vertical)

  if (isLiveLink) {
    return mode === 'live'
  }

  if (isFutureLink) {
    return mode === 'futures'
  }

  return mode === 'all' && areTagSlugsEquivalent(entry.menuSlug, activeTagSlug)
}

function isMenuGroupActive(entry: SportsMenuGroupEntry, activeTagSlug: string | null) {
  if (areTagSlugsEquivalent(entry.menuSlug, activeTagSlug)) {
    return true
  }

  return entry.links.some(link => areTagSlugsEquivalent(link.menuSlug, activeTagSlug))
}

function isMenuEntryActive({
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
    const count = resolveLinkEventsCount(link, countByTagSlug)
    if (count == null) {
      continue
    }

    total += count
    hasCount = true
  }

  return hasCount ? total : null
}

function findActiveGroupId(entries: SportsMenuEntry[], activeTagSlug: string | null) {
  const activeGroup = entries
    .filter(isGroupEntry)
    .find(entry => isMenuGroupActive(entry, activeTagSlug))

  return activeGroup?.id ?? null
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

function UpcomingStatusIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 18 18"
      className={cn(className, 'text-muted-foreground')}
      fill="none"
    >
      <circle
        cx="9"
        cy="9"
        r="7.25"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <polyline
        points="9 4.75 9 9 12.25 11.25"
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
  futureIconVariant,
  isFutureLink,
  isLiveLink,
  nested,
}: {
  className?: string
  entry: SportsMenuRenderableLinkEntry
  futureIconVariant: 'futures' | 'upcoming'
  isFutureLink: boolean
  isLiveLink: boolean
  nested: boolean
}) {
  if (isLiveLink && !nested) {
    return <LiveStatusIcon className={className} />
  }

  if (isFutureLink && !nested) {
    return futureIconVariant === 'upcoming'
      ? <UpcomingStatusIcon className={className} />
      : <FuturesStatusIcon className={className} />
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
  vertical,
  mode,
  activeTagSlug,
}: {
  entry: SportsMenuLinkEntry
  vertical: SportsVertical
  mode: SportsSidebarMode
  activeTagSlug: string | null
}) {
  const href = normalizeTagSlug(entry.href)
  const isLiveLink = isLiveMenuHref(href, vertical)
  const isFutureLink = isFutureMenuLinkHref(href, vertical)
  const futureIconVariant = vertical === 'esports' ? 'upcoming' : 'futures'
  const isActive = isMenuLinkActive({ entry, vertical, mode, activeTagSlug })

  return (
    <IntentPrefetchLink
      href={entry.href as Route}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        `
          flex h-19 w-[72px] shrink-0 flex-col items-center justify-center gap-1 rounded-xl px-1.5 py-2 text-center
          transition-colors
        `,
        isActive ? 'bg-muted' : 'bg-transparent hover:bg-muted',
      )}
    >
      <span className="size-6">
        <SportsMenuIcon
          entry={entry}
          futureIconVariant={futureIconVariant}
          isFutureLink={isFutureLink}
          isLiveLink={isLiveLink}
          nested={false}
          className="size-full"
        />
      </span>
      <span className="w-full truncate text-2xs leading-none font-semibold tracking-[0.05em] text-foreground uppercase">
        {entry.label}
      </span>
    </IntentPrefetchLink>
  )
}

function SportsMobileSheetLink({
  entry,
  vertical,
  nested = false,
  mode,
  activeTagSlug,
  countByTagSlug,
  onActionComplete,
}: {
  entry: SportsMenuRenderableLinkEntry
  vertical: SportsVertical
  nested?: boolean
  mode: SportsSidebarMode
  activeTagSlug: string | null
  countByTagSlug?: Record<string, number>
  onActionComplete?: () => void
}) {
  const href = normalizeTagSlug(entry.href)
  const isLiveLink = isLiveMenuHref(href, vertical)
  const isFutureLink = isFutureMenuLinkHref(href, vertical)
  const futureIconVariant = vertical === 'esports' ? 'upcoming' : 'futures'
  const isActive = isMenuLinkActive({ entry, vertical, mode, activeTagSlug })
  const displayCount = resolveLinkEventsCount(entry, countByTagSlug)

  return (
    <IntentPrefetchLink
      href={entry.href as Route}
      aria-current={isActive ? 'page' : undefined}
      onClick={() => onActionComplete?.()}
      className={cn(
        `flex w-full items-center gap-2.5 rounded-md p-3 text-left transition-colors hover:bg-muted`,
        nested && 'py-2.5 pl-7',
        isActive ? 'bg-muted' : 'bg-transparent',
      )}
    >
      <span className={cn('shrink-0', nested ? 'size-4' : 'size-5')}>
        <SportsMenuIcon
          entry={entry}
          futureIconVariant={futureIconVariant}
          isFutureLink={isFutureLink}
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
    </IntentPrefetchLink>
  )
}

function SportsMenuLink({
  entry,
  vertical,
  nested = false,
  mode,
  activeTagSlug,
  countByTagSlug,
  onActionComplete,
}: {
  entry: SportsMenuRenderableLinkEntry
  vertical: SportsVertical
  nested?: boolean
  mode: SportsSidebarMode
  activeTagSlug: string | null
  countByTagSlug?: Record<string, number>
  onActionComplete?: () => void
}) {
  const href = normalizeTagSlug(entry.href)
  const isLiveLink = isLiveMenuHref(href, vertical)
  const isFutureLink = isFutureMenuLinkHref(href, vertical)
  const futureIconVariant = vertical === 'esports' ? 'upcoming' : 'futures'
  const isActive = isMenuLinkActive({ entry, vertical, mode, activeTagSlug })
  const displayCount = resolveLinkEventsCount(entry, countByTagSlug)

  if (nested) {
    return (
      <IntentPrefetchLink
        href={entry.href as Route}
        aria-current={isActive ? 'page' : undefined}
        onClick={() => onActionComplete?.()}
        className="block"
      >
        <div
          className={cn(
            'relative rounded-md p-3 transition-colors hover:bg-muted',
            isActive ? 'bg-muted' : 'bg-transparent',
          )}
        >
          <div className="flex min-w-0 items-center gap-x-2.5">
            <span className="shrink-0 text-muted-foreground [&_svg]:size-4">
              <SportsMenuIcon
                entry={entry}
                futureIconVariant={futureIconVariant}
                isFutureLink={isFutureLink}
                isLiveLink={isLiveLink}
                nested
                className="size-5 object-contain"
              />
            </span>
            <span className="truncate pr-4 text-sm font-medium whitespace-nowrap">
              {entry.label}
            </span>
          </div>

          {displayCount !== null && (
            <span
              className="absolute top-1/2 right-3 -translate-y-1/2 text-[11px] font-bold text-neutral-400 tabular-nums"
            >
              {displayCount}
            </span>
          )}
        </div>
      </IntentPrefetchLink>
    )
  }

  return (
    <IntentPrefetchLink
      href={entry.href as Route}
      aria-current={isActive ? 'page' : undefined}
      onClick={() => onActionComplete?.()}
      className={cn(
        `
          flex w-full flex-row items-center justify-between rounded-md bg-transparent p-3 text-left transition-colors
          hover:bg-muted
        `,
        isActive ? 'bg-muted' : 'bg-transparent',
      )}
    >
      <span className="flex min-w-0 flex-1 flex-row items-center gap-x-2.5">
        <span className="size-5 shrink-0 text-muted-foreground [&_svg]:size-5">
          <SportsMenuIcon
            entry={entry}
            futureIconVariant={futureIconVariant}
            isFutureLink={isFutureLink}
            isLiveLink={isLiveLink}
            nested={false}
            className="size-full"
          />
        </span>
        <span className="truncate text-sm font-semibold">{entry.label}</span>
      </span>

      {displayCount !== null && (
        <span className="shrink-0 pl-2 text-xs font-semibold text-muted-foreground tabular-nums">
          {displayCount}
        </span>
      )}
    </IntentPrefetchLink>
  )
}

export default function SportsSidebarMenu({
  entries,
  vertical,
  mode,
  activeTagSlug,
  countByTagSlug,
}: SportsSidebarMenuProps) {
  const verticalConfig = getSportsVerticalConfig(vertical)
  const mobileQuickMenuContainerRef = useRef<HTMLDivElement | null>(null)
  const [isMobileMoreMenuOpen, setIsMobileMoreMenuOpen] = useState(false)
  const [mobileVisiblePrimaryLinkCount, setMobileVisiblePrimaryLinkCount] = useState(4)
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(() =>
    findActiveGroupId(entries, activeTagSlug),
  )
  const primaryTopLevelLinks = useMemo(
    () => entries.filter(isLinkEntry),
    [entries],
  )
  const allMenuEntries = useMemo(
    () => entries.flatMap((entry) => {
      if (entry.type === 'link') {
        return [entry]
      }

      if (entry.type === 'group') {
        return [entry, ...entry.links]
      }

      return []
    }),
    [entries],
  )
  const mobileVisiblePrimaryLinks = useMemo(
    () => primaryTopLevelLinks.slice(0, mobileVisiblePrimaryLinkCount),
    [primaryTopLevelLinks, mobileVisiblePrimaryLinkCount],
  )
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

  useEffect(() => {
    const nextExpandedGroupId = findActiveGroupId(entries, activeTagSlug)
    setExpandedGroupId(current => (current === nextExpandedGroupId ? current : nextExpandedGroupId))
  }, [entries, activeTagSlug])

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
        return <div key={entry.id} className="mb-2 w-full border-b pb-2" />
      }

      if (entry.type === 'header') {
        return (
          <div
            key={entry.id}
            className="
              mt-4 mb-3 flex items-center p-3 text-[11px] font-medium tracking-wider whitespace-nowrap
              text-muted-foreground uppercase
            "
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
      const isCurrentPage = areTagSlugsEquivalent(entry.menuSlug, activeTagSlug)

      return (
        <div key={entry.id}>
          <IntentPrefetchLink
            href={entry.href as Route}
            aria-current={isCurrentPage ? 'page' : undefined}
            onClick={(event) => {
              if (isCurrentPage) {
                event.preventDefault()
                setExpandedGroupId(current => (current === entry.id ? null : entry.id))
                return
              }

              setExpandedGroupId(entry.id)
              onActionComplete?.()
            }}
            className={cn(
              `flex w-full flex-row items-center justify-between rounded-md p-3 transition-colors hover:bg-muted`,
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
          </IntentPrefetchLink>

          <div
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
      const groupCount = resolveGroupEventsCount(entry, countByTagSlug)

      return (
        <div key={entry.id}>
          <button
            type="button"
            className={cn(
              'flex w-full items-center gap-2.5 rounded-md p-3 text-left transition-colors hover:bg-muted',
              isGroupActive ? 'bg-muted' : 'bg-transparent',
            )}
            onClick={() => {
              setExpandedGroupId(current => (current === entry.id ? null : entry.id))
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
      <nav className="mb-3 pb-2 lg:hidden">
        <div ref={mobileQuickMenuContainerRef} className="flex min-w-0 items-stretch gap-1.5 overflow-hidden">
          {mobileVisiblePrimaryLinks.map(entry => (
            <SportsMobileQuickLink
              key={entry.id}
              entry={entry}
              vertical={vertical}
              mode={mode}
              activeTagSlug={activeTagSlug}
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
                ? 'bg-muted'
                : 'bg-transparent hover:bg-muted',
            )}
            aria-label={`Open more ${verticalConfig.label.toLowerCase()}`}
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
              <p className="text-base font-semibold text-foreground">{verticalConfig.label}</p>
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
          hidden w-[190px] shrink-0 self-start
          lg:sticky lg:top-22 lg:flex lg:max-h-[calc(100vh-5.5rem)] lg:flex-col lg:overflow-y-auto lg:py-2 lg:pr-1
        `}
      >
        {renderDesktopMenuEntries()}
      </aside>
    </>
  )
}
