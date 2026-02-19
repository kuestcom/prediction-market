'use client'

import type { ReactNode } from 'react'
import type { EventSeriesEntry } from '@/types'
import { ChevronDownIcon, GavelIcon, TriangleIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Link } from '@/i18n/navigation'
import { cn } from '@/lib/utils'

const MAX_PAST_RESULT_BADGES = 5
const LIVE_TRADING_WINDOW_MS = 24 * 60 * 60 * 1000
const LIVE_ET_TIME_SHORT = '4 PM'
const LIVE_ET_TIME_LABEL = '4 PM ET'
const LIVE_UTC_TIME_LABEL = '9 PM'

function parseSeriesEventDate(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed
}

function getSeriesEventDate(event: EventSeriesEntry) {
  return parseSeriesEventDate(event.end_date)
    ?? parseSeriesEventDate(event.resolved_at)
    ?? parseSeriesEventDate(event.created_at)
}

function getSeriesEventTimestamp(event: EventSeriesEntry) {
  const date = getSeriesEventDate(event)
  return date ? date.getTime() : Number.NEGATIVE_INFINITY
}

function isSeriesEventResolved(event: EventSeriesEntry) {
  if (event.status === 'resolved') {
    return true
  }

  return parseSeriesEventDate(event.resolved_at) !== null
}

function getSeriesEventLabel(event: EventSeriesEntry) {
  const date = getSeriesEventDate(event)
  return date
    ? date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      })
    : 'Unknown date'
}

function getSeriesEventLabelWithYear(event: EventSeriesEntry, timeZone: string) {
  const date = getSeriesEventDate(event)
  return date
    ? date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone,
      })
    : 'Unknown date'
}

function getResolvedDirection(event: EventSeriesEntry) {
  if (event.resolved_direction === 'up' || event.resolved_direction === 'down') {
    return event.resolved_direction
  }

  return null
}

function isSeriesEventTradingNow(event: EventSeriesEntry, nowTimestamp: number) {
  const eventTimestamp = getSeriesEventTimestamp(event)
  if (!Number.isFinite(eventTimestamp)) {
    return false
  }

  const tradingWindowStart = eventTimestamp - LIVE_TRADING_WINDOW_MS
  return nowTimestamp >= tradingWindowStart && nowTimestamp < eventTimestamp
}

function isSameEtDay(leftTimestamp: number, rightTimestamp: number) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  return formatter.format(new Date(leftTimestamp)) === formatter.format(new Date(rightTimestamp))
}

type EventSeriesPillsVariant = 'header' | 'live'

interface EventSeriesPillsProps {
  currentEventSlug?: string
  seriesEvents?: EventSeriesEntry[]
  variant?: EventSeriesPillsVariant
  rightSlot?: ReactNode
}

function ResolutionTimeTooltipRows({ event }: { event: EventSeriesEntry }) {
  const etDateLabel = getSeriesEventLabelWithYear(event, 'America/New_York')
  const utcDateLabel = getSeriesEventLabelWithYear(event, 'UTC')

  return (
    <div className="grid gap-2 text-sm text-foreground">
      <div className="flex items-center gap-2">
        <span className="
          inline-flex h-6 min-w-9 items-center justify-center rounded-md bg-muted px-2 text-xs font-semibold
        "
        >
          ET
        </span>
        <span className="tabular-nums">{etDateLabel}</span>
        <span className="ml-auto tabular-nums">{LIVE_ET_TIME_SHORT}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="
          inline-flex h-6 min-w-9 items-center justify-center rounded-md bg-muted px-2 text-xs font-semibold
        "
        >
          UTC
        </span>
        <span className="tabular-nums">{utcDateLabel}</span>
        <span className="ml-auto tabular-nums">{LIVE_UTC_TIME_LABEL}</span>
      </div>
    </div>
  )
}

export default function EventSeriesPills({
  currentEventSlug,
  seriesEvents = [],
  variant = 'header',
  rightSlot,
}: EventSeriesPillsProps) {
  const [isPastMenuOpen, setIsPastMenuOpen] = useState(false)
  const [hoveredPastBadgeId, setHoveredPastBadgeId] = useState<string | null>(null)
  const [nowTimestamp, setNowTimestamp] = useState(() => Date.now())

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowTimestamp(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(interval)
    }
  }, [])

  const {
    pastResolvedEvents,
    unresolvedEvents,
    currentResolvedEvent,
    currentTradingEventId,
    hasSeriesNavigation,
  } = useMemo(() => {
    const filteredSeriesEvents = seriesEvents.filter(event => Boolean(event?.slug))
    const hasComparableSeriesEvents = filteredSeriesEvents.some(event => event.slug !== currentEventSlug)
    const currentEvent = filteredSeriesEvents.find(event => event.slug === currentEventSlug) ?? null

    const past = filteredSeriesEvents
      .filter(event => isSeriesEventResolved(event))
      .sort((a, b) => getSeriesEventTimestamp(b) - getSeriesEventTimestamp(a))

    const unresolved = filteredSeriesEvents
      .filter(event => !isSeriesEventResolved(event))
      .sort((a, b) => getSeriesEventTimestamp(a) - getSeriesEventTimestamp(b))

    const currentTradingEvent = unresolved.find(event => isSeriesEventTradingNow(event, nowTimestamp))
      ?? unresolved.find((event) => {
        const eventTimestamp = getSeriesEventTimestamp(event)
        return Number.isFinite(eventTimestamp) && eventTimestamp > nowTimestamp
      })
      ?? (currentEvent && !isSeriesEventResolved(currentEvent) ? currentEvent : null)

    return {
      pastResolvedEvents: past,
      unresolvedEvents: unresolved,
      currentResolvedEvent: currentEvent && isSeriesEventResolved(currentEvent) ? currentEvent : null,
      currentTradingEventId: currentTradingEvent?.id ?? null,
      hasSeriesNavigation: hasComparableSeriesEvents && (past.length > 0 || unresolved.length > 0),
    }
  }, [currentEventSlug, nowTimestamp, seriesEvents])

  if (!hasSeriesNavigation && !rightSlot) {
    return null
  }

  const shouldShowPastDropdown = pastResolvedEvents.length > 0
  const hasRightSlot = Boolean(rightSlot)

  if (variant === 'live') {
    const pastResultBadges = pastResolvedEvents
      .filter(event => event.slug !== currentEventSlug)
      .map(event => ({
        event,
        direction: getResolvedDirection(event),
      }))
      .filter((entry): entry is { event: EventSeriesEntry, direction: 'up' | 'down' } => entry.direction !== null)
      .slice(0, MAX_PAST_RESULT_BADGES)
      .reverse()

    return (
      <div
        className={cn(
          'flex flex-wrap items-center gap-2 pr-4 pl-0 sm:pr-6 sm:pl-0',
          hasRightSlot && 'justify-between gap-3',
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          {hasSeriesNavigation && shouldShowPastDropdown && (
            <DropdownMenu open={isPastMenuOpen} onOpenChange={setIsPastMenuOpen} modal={false}>
              <div
                className={cn(
                  'inline-flex h-8 items-center rounded-full bg-muted px-1 text-sm font-semibold',
                  'text-foreground',
                )}
              >
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      'inline-flex h-7 items-center gap-1.5 rounded-full pr-1 pl-2.5 transition-colors',
                      'hover:bg-muted/85',
                    )}
                  >
                    <span>Past</span>
                    <ChevronDownIcon className={cn('size-4 transition-transform', isPastMenuOpen && 'rotate-180')} />
                  </button>
                </DropdownMenuTrigger>

                {pastResultBadges.length > 0 && (
                  <>
                    <span className="mr-2 ml-0.5 h-4 w-px bg-border" />
                    <span className="inline-flex items-center gap-1 pr-2.5">
                      {pastResultBadges.map(({ event, direction }) => {
                        const isUp = direction === 'up'
                        const shouldDim = hoveredPastBadgeId !== null && hoveredPastBadgeId !== event.id
                        return (
                          <Tooltip key={event.id}>
                            <TooltipTrigger asChild>
                              <Link
                                href={`/event/${event.slug}`}
                                className={cn(
                                  `
                                    inline-flex size-4 items-center justify-center rounded-full transition-transform
                                    duration-150
                                  `,
                                  'hover:scale-105',
                                  shouldDim && 'opacity-55',
                                  isUp ? 'bg-emerald-500' : 'bg-red-500',
                                )}
                                onMouseEnter={() => setHoveredPastBadgeId(event.id)}
                                onMouseLeave={() => setHoveredPastBadgeId(null)}
                              >
                                <TriangleIcon
                                  className={cn('size-2.5 text-white', !isUp && 'rotate-180')}
                                  fill="currentColor"
                                  stroke="none"
                                />
                              </Link>
                            </TooltipTrigger>
                            <TooltipContent align="center" className="px-2 py-1 text-xs">
                              {getSeriesEventLabel(event)}
                            </TooltipContent>
                          </Tooltip>
                        )
                      })}
                    </span>
                  </>
                )}
              </div>

              <DropdownMenuContent
                side="top"
                align="start"
                className="
                  z-20 max-h-80 min-w-44 overflow-y-auto rounded-lg p-0.5
                "
              >
                {pastResolvedEvents.map((event) => {
                  const isCurrentEvent = event.slug === currentEventSlug

                  if (isCurrentEvent) {
                    return (
                      <DropdownMenuItem
                        key={event.id}
                        disabled
                        className={cn(
                          'cursor-default rounded-md py-1.5 text-xs data-disabled:opacity-100',
                          'bg-muted/35 text-muted-foreground',
                        )}
                      >
                        <span className="flex w-full items-center gap-2">
                          <GavelIcon className="size-3.5 shrink-0 text-foreground" />
                          <span className="text-xs font-semibold text-foreground">{LIVE_ET_TIME_LABEL}</span>
                          <span className="size-1 rounded-full bg-foreground/70" />
                          <span className="text-xs text-muted-foreground">{getSeriesEventLabel(event)}</span>
                        </span>
                      </DropdownMenuItem>
                    )
                  }

                  return (
                    <DropdownMenuItem key={event.id} asChild className="cursor-pointer rounded-md py-1.5 text-xs">
                      <Link href={`/event/${event.slug}`} className="flex w-full items-center gap-2">
                        <GavelIcon className="size-3.5 shrink-0 text-foreground" />
                        <span className="text-xs font-semibold text-foreground">{LIVE_ET_TIME_LABEL}</span>
                        <span className="size-1 rounded-full bg-foreground/70" />
                        <span className="text-xs text-muted-foreground">{getSeriesEventLabel(event)}</span>
                      </Link>
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {hasSeriesNavigation && currentResolvedEvent && (
            <span
              className={cn(
                'inline-flex h-8 items-center rounded-full bg-foreground px-3.5 text-sm leading-none font-semibold',
                'text-background',
              )}
            >
              Ended:
              {' '}
              {getSeriesEventLabel(currentResolvedEvent)}
            </span>
          )}

          {hasSeriesNavigation && unresolvedEvents.map((event) => {
            const isCurrentEvent = event.slug === currentEventSlug
            const eventTimestamp = getSeriesEventTimestamp(event)
            const isEndedUnresolved = Number.isFinite(eventTimestamp) && nowTimestamp >= eventTimestamp
            const isTradingNow = event.id === currentTradingEventId
            const isTodayInEt = Number.isFinite(eventTimestamp) && isSameEtDay(eventTimestamp, nowTimestamp)
            const pillLabel = isTodayInEt
              ? LIVE_ET_TIME_SHORT
              : `${LIVE_ET_TIME_SHORT} ${getSeriesEventLabel(event)}`

            return (
              <Tooltip key={event.id}>
                <TooltipTrigger asChild>
                  <Link
                    href={`/event/${event.slug}`}
                    className={cn(
                      `
                        inline-flex h-8 cursor-pointer items-center rounded-full px-3.5 text-sm leading-none
                        font-semibold transition-colors
                      `,
                      isCurrentEvent
                        ? 'bg-foreground text-background hover:bg-foreground/90'
                        : 'bg-muted text-foreground hover:bg-muted/80',
                      isTradingNow && 'gap-1.5',
                    )}
                  >
                    {isTradingNow && (
                      <span className="relative inline-flex size-2 items-center justify-center">
                        <span
                          className={cn(
                            'absolute inset-0 m-auto inline-flex size-2 animate-ping rounded-full',
                            'bg-red-500/50',
                          )}
                        />
                        <span className="relative inline-flex size-1.5 rounded-full bg-red-500" />
                      </span>
                    )}
                    <span>{pillLabel}</span>
                  </Link>
                </TooltipTrigger>
                <TooltipContent align="center" className="w-72 rounded-lg p-2.5 text-left">
                  <div className="grid gap-1.5">
                    {isEndedUnresolved && (
                      <div className="inline-flex items-center gap-1.5 text-foreground">
                        <GavelIcon className="size-3.5 shrink-0" />
                        <span className="text-sm font-semibold">Event was ended</span>
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">Resolution time</div>
                    <ResolutionTimeTooltipRows event={event} />
                  </div>
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>

        {rightSlot && <div className="ml-auto">{rightSlot}</div>}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2',
        hasRightSlot && 'justify-between gap-3',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        {hasSeriesNavigation && shouldShowPastDropdown && (
          <DropdownMenu open={isPastMenuOpen} onOpenChange={setIsPastMenuOpen} modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={`
                  inline-flex h-8 items-center gap-1.5 rounded-full bg-muted px-4 text-sm leading-none font-semibold
                  text-foreground transition-colors
                  hover:bg-muted/80
                `}
              >
                <span>Past</span>
                <ChevronDownIcon className={cn('size-4 transition-transform', isPastMenuOpen && 'rotate-180')} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="
                z-20 max-h-80 min-w-44 overflow-y-auto p-1 [-ms-overflow-style:none] [scrollbar-width:none]
                [&::-webkit-scrollbar]:hidden
              "
            >
              {pastResolvedEvents.map((event) => {
                const isCurrentEvent = event.slug === currentEventSlug

                if (isCurrentEvent) {
                  return (
                    <DropdownMenuItem
                      key={event.id}
                      disabled
                      className={`
                        cursor-default bg-muted/70 py-2 text-sm font-medium text-muted-foreground
                        data-disabled:opacity-100
                      `}
                    >
                      <span className="flex w-full items-center gap-2">
                        <GavelIcon className="size-4 shrink-0 text-muted-foreground" />
                        <span>{getSeriesEventLabel(event)}</span>
                      </span>
                    </DropdownMenuItem>
                  )
                }

                return (
                  <DropdownMenuItem key={event.id} asChild className="cursor-pointer py-2 text-sm font-medium">
                    <Link href={`/event/${event.slug}`} className="flex w-full items-center gap-2">
                      <GavelIcon className="size-4 shrink-0 text-muted-foreground" />
                      <span>{getSeriesEventLabel(event)}</span>
                    </Link>
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {hasSeriesNavigation && currentResolvedEvent && (
          <span
            className={`
              inline-flex h-8 items-center rounded-full bg-foreground px-4 text-sm leading-none font-semibold
              text-background
            `}
          >
            Ended:
            {' '}
            {getSeriesEventLabel(currentResolvedEvent)}
          </span>
        )}

        {hasSeriesNavigation && unresolvedEvents.map((event) => {
          const isCurrent = event.slug === currentEventSlug
          return (
            <Link
              key={event.id}
              href={`/event/${event.slug}`}
              className={cn(
                `inline-flex h-8 items-center rounded-full px-4 text-sm leading-none font-semibold transition-colors`,
                isCurrent
                  ? 'bg-foreground text-background hover:bg-foreground/90'
                  : 'bg-muted text-foreground hover:bg-muted/80',
              )}
            >
              {getSeriesEventLabel(event)}
            </Link>
          )
        })}
      </div>

      {rightSlot && <div className="ml-auto">{rightSlot}</div>}
    </div>
  )
}
