'use client'

import type { Route } from 'next'
import type { SportsMenuRenderableLinkEntry, SportsSidebarMode } from './sports-sidebar-menu-utils'
import type { SportsVertical } from '@/lib/sports-vertical'
import { Link } from '@/i18n/navigation'
import { cn } from '@/lib/utils'
import { resolveSportsMenuLinkState } from './sports-sidebar-menu-utils'
import SportsMenuIcon from './SportsMenuIcon'

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
  const {
    displayCount,
    futureIconVariant,
    isActive,
    isFutureLink,
    isLiveLink,
  } = resolveSportsMenuLinkState({
    entry,
    vertical,
    mode,
    activeTagSlug,
    countByTagSlug,
  })

  return (
    <Link
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
    </Link>
  )
}

export default SportsMobileSheetLink
