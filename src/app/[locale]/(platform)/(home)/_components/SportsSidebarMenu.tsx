'use client'

import type { SportsMenuEntry, SportsMenuGroupEntry, SportsMenuLinkEntry } from '@/app/[locale]/(platform)/(home)/_components/sportsMenuData'
import { ChevronDownIcon } from 'lucide-react'
import Image from 'next/image'
import { useState } from 'react'
import { SPORTS_MENU_ENTRIES } from '@/app/[locale]/(platform)/(home)/_components/sportsMenuData'
import { cn } from '@/lib/utils'

export type SportsSidebarMode = 'all' | 'live' | 'futures'

interface SportsSidebarMenuProps {
  mode: SportsSidebarMode
  activeTagSlug: string | null
  onSelectMode: (mode: SportsSidebarMode) => void
  onSelectTagSlug: (tagSlug: string) => void
}

type SportsMenuChildLinkEntry = SportsMenuGroupEntry['links'][number]
type SportsMenuRenderableLinkEntry = SportsMenuLinkEntry | SportsMenuChildLinkEntry

const TAG_ALIAS_CANDIDATES: Record<string, string[]> = {
  'cbb': ['ncaab'],
  'ncaab': ['cbb'],
  'league-of-legends': ['lol'],
  'lol': ['league-of-legends'],
  'counter-strike': ['cs2'],
  'cs2': ['counter-strike'],
}

function normalizeTagSlug(value: string | null | undefined) {
  return value?.trim().toLowerCase() || ''
}

function normalizeForMatch(value: string | null | undefined) {
  return normalizeTagSlug(value).replace(/[^a-z0-9]/g, '')
}

function getTagAliases(tagSlug: string) {
  const normalized = normalizeTagSlug(tagSlug)
  if (!normalized) {
    return []
  }
  return TAG_ALIAS_CANDIDATES[normalized] ?? []
}

function isLinkEntry(entry: SportsMenuEntry): entry is SportsMenuLinkEntry {
  return entry.type === 'link'
}

function isGroupEntry(entry: SportsMenuEntry): entry is SportsMenuGroupEntry {
  return entry.type === 'group'
}

function resolveTagSlugFromHref(href: string) {
  const segments = href
    .split('/')
    .map(segment => segment.trim().toLowerCase())
    .filter(Boolean)
  const sportsIndex = segments.indexOf('sports')
  if (sportsIndex === -1) {
    return null
  }

  const nextSegment = segments[sportsIndex + 1]
  if (!nextSegment || nextSegment === 'live' || nextSegment === 'futures') {
    return null
  }

  return nextSegment
}

function areTagSlugsEquivalent(input: string | null | undefined, current: string | null | undefined) {
  const left = normalizeTagSlug(input)
  const right = normalizeTagSlug(current)

  if (!left || !right) {
    return false
  }

  if (left === right) {
    return true
  }

  if (left.includes(right) || right.includes(left)) {
    return true
  }

  const leftNormalized = normalizeForMatch(left)
  const rightNormalized = normalizeForMatch(right)
  if (leftNormalized && leftNormalized === rightNormalized) {
    return true
  }

  const leftAliases = new Set(getTagAliases(left))
  const rightAliases = new Set(getTagAliases(right))
  if (leftAliases.has(right) || rightAliases.has(left)) {
    return true
  }

  return false
}

export function resolveSportsMenuTargetTagSlug(params: {
  requestedTagSlug: string
  availableTagSlugs: Set<string>
}) {
  const { requestedTagSlug, availableTagSlugs } = params
  const requested = normalizeTagSlug(requestedTagSlug)
  if (!requested) {
    return null
  }

  if (availableTagSlugs.has(requested)) {
    return requested
  }

  for (const alias of getTagAliases(requested)) {
    if (availableTagSlugs.has(alias)) {
      return alias
    }
  }

  const requestedNormalized = normalizeForMatch(requested)
  for (const candidate of availableTagSlugs) {
    if (
      candidate.includes(requested)
      || requested.includes(candidate)
      || normalizeForMatch(candidate) === requestedNormalized
    ) {
      return candidate
    }
  }

  return requested
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

function SportsMenuLink({
  entry,
  nested = false,
  mode,
  activeTagSlug,
  onSelectMode,
  onSelectTagSlug,
}: {
  entry: SportsMenuRenderableLinkEntry
  nested?: boolean
  mode: SportsSidebarMode
  activeTagSlug: string | null
  onSelectMode: (mode: SportsSidebarMode) => void
  onSelectTagSlug: (tagSlug: string) => void
}) {
  const href = normalizeTagSlug(entry.href)
  const isLiveLink = href === '/sports/live'
  const isFuturesLink = href.startsWith('/sports/futures')
  const entryTagSlug = resolveTagSlugFromHref(entry.href)
  const isActive = isLiveLink
    ? mode === 'live'
    : isFuturesLink
      ? mode === 'futures'
      : mode === 'all' && areTagSlugsEquivalent(entryTagSlug, activeTagSlug)

  function handleClick() {
    if (isLiveLink) {
      onSelectMode('live')
      return
    }

    if (isFuturesLink) {
      onSelectMode('futures')
      return
    }

    if (entryTagSlug) {
      onSelectTagSlug(entryTagSlug)
    }
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

      {typeof entry.count === 'number' && (
        <span className="shrink-0 pl-2 text-xs font-semibold text-muted-foreground tabular-nums">
          {entry.count}
        </span>
      )}
    </button>
  )
}

export default function SportsSidebarMenu({
  mode,
  activeTagSlug,
  onSelectMode,
  onSelectTagSlug,
}: SportsSidebarMenuProps) {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    const groups = SPORTS_MENU_ENTRIES.filter(isGroupEntry)
    return Object.fromEntries(groups.map(group => [group.id, false]))
  })

  return (
    <aside
      className={`
        hidden w-[180px] shrink-0 self-start
        lg:sticky lg:top-22 lg:flex lg:max-h-[calc(100vh-5.5rem)] lg:flex-col lg:overflow-y-auto lg:py-2 lg:pr-1
      `}
    >
      {SPORTS_MENU_ENTRIES.map((entry) => {
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
          return (
            <SportsMenuLink
              key={entry.id}
              entry={entry}
              mode={mode}
              activeTagSlug={activeTagSlug}
              onSelectMode={onSelectMode}
              onSelectTagSlug={onSelectTagSlug}
            />
          )
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
                  {entry.links.map(link => (
                    <SportsMenuLink
                      key={link.id}
                      entry={link}
                      nested
                      mode={mode}
                      activeTagSlug={activeTagSlug}
                      onSelectMode={onSelectMode}
                      onSelectTagSlug={onSelectTagSlug}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </aside>
  )
}
