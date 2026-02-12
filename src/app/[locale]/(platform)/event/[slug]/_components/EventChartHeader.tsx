import type { EventSeriesEntry } from '@/types'
import { ChevronDownIcon, GavelIcon, TriangleIcon } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { AnimatedCounter } from 'react-animated-counter'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
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
  const [isPastDialogOpen, setIsPastDialogOpen] = useState(false)

  const { pastResolvedEvents, unresolvedEvents, currentResolvedEvent, hasSeriesNavigation } = useMemo(() => {
    const filteredSeriesEvents = seriesEvents.filter(event => Boolean(event?.slug))
    const hasComparableSeriesEvents = filteredSeriesEvents.some(event => event.slug !== currentEventSlug)
    const currentEvent = filteredSeriesEvents.find(event => event.slug === currentEventSlug) ?? null

    const past = filteredSeriesEvents
      .filter(event => event.status === 'resolved' && event.slug !== currentEventSlug)
      .sort((a, b) => getSeriesEventTimestamp(b) - getSeriesEventTimestamp(a))

    const unresolved = filteredSeriesEvents
      .filter(event => event.status !== 'resolved')
      .sort((a, b) => getSeriesEventTimestamp(a) - getSeriesEventTimestamp(b))

    return {
      pastResolvedEvents: past,
      unresolvedEvents: unresolved,
      currentResolvedEvent: currentEvent?.status === 'resolved' ? currentEvent : null,
      hasSeriesNavigation: hasComparableSeriesEvents && (past.length > 0 || unresolved.length > 0),
    }
  }, [currentEventSlug, seriesEvents])

  if (!isSingleMarket) {
    return null
  }

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
          {pastResolvedEvents.length > 0 && (
            <Dialog open={isPastDialogOpen} onOpenChange={setIsPastDialogOpen}>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className={`
                    inline-flex h-8 items-center gap-1.5 rounded-full bg-muted px-4 text-sm leading-none font-semibold
                    text-foreground transition-colors
                    hover:bg-muted/80
                  `}
                >
                  <span>Past</span>
                  <ChevronDownIcon className={cn('size-4 transition-transform', isPastDialogOpen && 'rotate-180')} />
                </button>
              </DialogTrigger>
              <DialogContent className="gap-0 p-0 sm:max-w-sm">
                <DialogHeader className="border-b px-4 py-3">
                  <DialogTitle className="text-base">Past</DialogTitle>
                </DialogHeader>
                <div className="max-h-72 overflow-y-auto p-2">
                  {pastResolvedEvents.map(event => (
                    <Link
                      key={event.id}
                      href={`/event/${event.slug}`}
                      onClick={() => setIsPastDialogOpen(false)}
                      className={`
                        flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-foreground
                        transition-colors
                        hover:bg-muted
                      `}
                    >
                      <GavelIcon className="size-4 shrink-0 text-muted-foreground" />
                      <span>{getSeriesEventLabel(event)}</span>
                    </Link>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
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
