'use client'

import type { Route } from 'next'
import type { SportsSidebarMode } from './sports-sidebar-menu-utils'
import type { SportsMenuLinkEntry } from '@/lib/sports-menu-types'
import type { SportsVertical } from '@/lib/sports-vertical'
import { Link } from '@/i18n/navigation'
import { cn } from '@/lib/utils'
import {
  isFutureMenuLinkHref,
  isLiveMenuHref,
  isMenuLinkActive,
  isSoonMenuLinkHref,
  normalizeTagSlug,
} from './sports-sidebar-menu-utils'
import SportsMenuIcon from './SportsMenuIcon'

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
  const isSoonLink = isSoonMenuLinkHref(href, vertical)
  const isFutureLink = isFutureMenuLinkHref(href, vertical)
  const futureIconVariant = isSoonLink ? 'upcoming' : 'futures'
  const isActive = isMenuLinkActive({ entry, vertical, mode, activeTagSlug })

  return (
    <Link
      href={entry.href as Route}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        `
          flex h-[60px] min-w-0 flex-col items-center justify-center gap-1 rounded-md px-1 py-2 text-center
          transition-colors
        `,
        isActive ? 'bg-muted' : 'bg-transparent hover:bg-muted',
      )}
    >
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
      <span className="w-full truncate text-[11px] leading-tight font-medium text-foreground">
        {entry.label}
      </span>
    </Link>
  )
}

export default SportsMobileQuickLink
