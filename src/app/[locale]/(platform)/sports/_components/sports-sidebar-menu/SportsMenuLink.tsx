'use client'

import type { Route } from 'next'
import type { SportsMenuRenderableLinkEntry, SportsSidebarMode } from './sports-sidebar-menu-utils'
import type { SportsVertical } from '@/lib/sports-vertical'
import AppLink from '@/components/AppLink'
import { cn } from '@/lib/utils'
import {
  isFutureMenuLinkHref,
  isLiveMenuHref,
  isMenuLinkActive,
  isSoonMenuLinkHref,
  normalizeTagSlug,
  resolveLinkEventsCount,
} from './sports-sidebar-menu-utils'
import SportsMenuIcon from './SportsMenuIcon'

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
  const isSoonLink = isSoonMenuLinkHref(href, vertical)
  const isFutureLink = isFutureMenuLinkHref(href, vertical)
  const futureIconVariant = isSoonLink ? 'upcoming' : 'futures'
  const isActive = isMenuLinkActive({ entry, vertical, mode, activeTagSlug })
  const displayCount = resolveLinkEventsCount(entry, vertical, countByTagSlug)
  const showNestedIcon = vertical !== 'esports'

  if (nested) {
    return (
      <AppLink
        intentPrefetch
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
            {showNestedIcon && (
              <span className="shrink-0 text-muted-foreground [&_svg]:size-4">
                <SportsMenuIcon
                  entry={entry}
                  futureIconVariant={futureIconVariant}
                  isFutureLink={isSoonLink || isFutureLink}
                  isLiveLink={isLiveLink}
                  nested
                  className="size-5 object-contain"
                />
              </span>
            )}
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
      </AppLink>
    )
  }

  return (
    <AppLink
      intentPrefetch
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
            isFutureLink={isSoonLink || isFutureLink}
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
    </AppLink>
  )
}

export default SportsMenuLink
