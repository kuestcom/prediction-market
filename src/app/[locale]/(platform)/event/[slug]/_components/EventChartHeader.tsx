import type { EventSeriesEntry } from '@/types'
import { ChevronDownIcon, GavelIcon, TriangleIcon } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { AnimatedCounter } from 'react-animated-counter'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { OUTCOME_INDEX } from '@/lib/constants'
import { cn, sanitizeSvg } from '@/lib/utils'

interface EventChartHeaderProps {
  isSingleMarket: boolean
  activeOutcomeIndex: typeof OUTCOME_INDEX.YES | typeof OUTCOME_INDEX.NO
  activeOutcomeLabel: string
  primarySeriesColor: string
  yesChanceValue: number | null
  effectiveBaselineYesChance: number | null
  effectiveCurrentYesChance: number | null
  watermark: { iconSvg?: string | null, label?: string | null }
  currentEventSlug?: string
  seriesEvents?: EventSeriesEntry[]
}

const PAST_EVENTS_WINDOW_DAYS = 7
const PAST_EVENTS_WINDOW_MS = PAST_EVENTS_WINDOW_DAYS * 24 * 60 * 60 * 1000

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

function isSeriesEventWithinPastWindow(event: EventSeriesEntry, nowTimestamp: number) {
  const eventTimestamp = getSeriesEventTimestamp(event)

  if (!Number.isFinite(eventTimestamp)) {
    return false
  }

  return eventTimestamp <= nowTimestamp && eventTimestamp >= nowTimestamp - PAST_EVENTS_WINDOW_MS
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

export default function EventChartHeader({
  isSingleMarket,
  activeOutcomeIndex,
  activeOutcomeLabel,
  primarySeriesColor,
  yesChanceValue,
  effectiveBaselineYesChance,
  effectiveCurrentYesChance,
  watermark,
  currentEventSlug,
  seriesEvents = [],
}: EventChartHeaderProps) {
  const [isPastMenuOpen, setIsPastMenuOpen] = useState(false)

  const { pastResolvedEvents, unresolvedEvents, currentResolvedEvent, hasSeriesNavigation } = useMemo(() => {
    const nowTimestamp = Date.now()
    const filteredSeriesEvents = seriesEvents.filter(event => Boolean(event?.slug))
    const hasComparableSeriesEvents = filteredSeriesEvents.some(event => event.slug !== currentEventSlug)
    const currentEvent = filteredSeriesEvents.find(event => event.slug === currentEventSlug) ?? null

    const past = filteredSeriesEvents
      .filter(event => isSeriesEventResolved(event) && isSeriesEventWithinPastWindow(event, nowTimestamp))
      .sort((a, b) => getSeriesEventTimestamp(b) - getSeriesEventTimestamp(a))

    const unresolved = filteredSeriesEvents
      .filter(event => !isSeriesEventResolved(event))
      .sort((a, b) => getSeriesEventTimestamp(a) - getSeriesEventTimestamp(b))

    return {
      pastResolvedEvents: past,
      unresolvedEvents: unresolved,
      currentResolvedEvent: currentEvent && isSeriesEventResolved(currentEvent) ? currentEvent : null,
      hasSeriesNavigation: hasComparableSeriesEvents && (past.length > 0 || unresolved.length > 0),
    }
  }, [currentEventSlug, seriesEvents])

  if (!isSingleMarket) {
    return null
  }

  const shouldShowPastDropdown = pastResolvedEvents.length > 0

  const changeIndicator = (() => {
    if (
      effectiveBaselineYesChance === null
      || effectiveCurrentYesChance === null
      || !Number.isFinite(effectiveBaselineYesChance)
      || !Number.isFinite(effectiveCurrentYesChance)
    ) {
      return null
    }

    const rawChange = effectiveCurrentYesChance - effectiveBaselineYesChance
    const roundedChange = Math.round(rawChange)

    if (roundedChange === 0) {
      return null
    }

    const isPositive = roundedChange > 0
    const magnitude = Math.abs(roundedChange)
    const colorClass = isPositive ? 'text-yes' : 'text-no'

    return (
      <div className={cn('flex items-center gap-1 tabular-nums', colorClass)}>
        <TriangleIcon
          className="size-3.5"
          fill="currentColor"
          stroke="none"
          style={{ transform: isPositive ? 'rotate(0deg)' : 'rotate(180deg)' }}
        />
        <span className="text-xs font-semibold">
          {magnitude}
          %
        </span>
      </div>
    )
  })()

  return (
    <div className="flex flex-col gap-2">
      {hasSeriesNavigation && (
        <div className="flex flex-wrap items-center gap-2">
          {shouldShowPastDropdown && (
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
                  <ChevronDownIcon className={cn('size-4 transition-transform', { 'rotate-180': isPastMenuOpen })} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-72 min-w-44 overflow-y-auto p-1">
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

          {currentResolvedEvent && (
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

          {unresolvedEvents.map((event) => {
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
      )}

      <div className="flex flex-row items-end justify-between gap-3">
        <div className="flex flex-row items-end gap-3">
          <div
            className="flex flex-col gap-1 font-semibold tabular-nums"
            style={{ color: primarySeriesColor }}
          >
            {activeOutcomeIndex === OUTCOME_INDEX.NO && activeOutcomeLabel && (
              <span className="text-xs leading-none">
                {activeOutcomeLabel}
              </span>
            )}
            <div className="inline-flex items-baseline gap-0 text-2xl leading-none font-semibold">
              {typeof yesChanceValue === 'number'
                ? (
                    <AnimatedCounter
                      value={yesChanceValue}
                      color="currentColor"
                      fontSize="24px"
                      includeCommas={false}
                      includeDecimals={false}
                      incrementColor="currentColor"
                      decrementColor="currentColor"
                      digitStyles={{
                        fontWeight: 600,
                        letterSpacing: '-0.02em',
                        lineHeight: '1',
                        display: 'inline-block',
                      }}
                      containerStyles={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        flexDirection: 'row-reverse',
                        gap: '0.05em',
                        lineHeight: '1',
                      }}
                    />
                  )
                : (
                    <span>--</span>
                  )}
              <span>
                % chance
              </span>
            </div>
          </div>

          {changeIndicator}
        </div>

        {(watermark.iconSvg || watermark.label) && (
          <div className="mr-2 flex items-center gap-1 self-start text-xl text-muted-foreground opacity-50 select-none">
            {watermark.iconSvg
              ? (
                  <div
                    className="size-[1em] **:fill-current **:stroke-current"
                    dangerouslySetInnerHTML={{ __html: sanitizeSvg(watermark.iconSvg) }}
                  />
                )
              : null}
            {watermark.label
              ? (
                  <span className="font-semibold">
                    {watermark.label}
                  </span>
                )
              : null}
          </div>
        )}
      </div>
    </div>
  )
}
