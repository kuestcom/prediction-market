'use client'

import type { Event } from '@/types'
import Image from 'next/image'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { NewBadge } from '@/components/ui/new-badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Link } from '@/i18n/navigation'
import { formatVolume } from '@/lib/formatters'
import { cn, isMarketNew } from '@/lib/utils'

interface MentionsListProps {
  events: Event[]
}

const DAY_FORMATTER = new Intl.DateTimeFormat('en-US', { day: 'numeric' })
const MONTH_FORMATTER = new Intl.DateTimeFormat('en-US', { month: 'short' })
const SCHEDULE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  hour: 'numeric',
  minute: '2-digit',
})

export default function MentionsList({ events }: MentionsListProps) {
  return (
    <div className="mx-auto flex w-full flex-col gap-4 md:gap-5">
      {events.map(event => (
        <MentionsListItem key={event.id} event={event} />
      ))}
    </div>
  )
}

interface MentionsListItemProps {
  event: Event
}

function MentionsListItem({ event }: MentionsListItemProps) {
  const parsedEndDate = event.end_date ? new Date(event.end_date) : null
  const hasValidEndDate = parsedEndDate && !Number.isNaN(parsedEndDate.getTime())
  const eventDate = hasValidEndDate ? parsedEndDate : null
  const dayLabel = eventDate ? DAY_FORMATTER.format(eventDate) : 'TBD'
  const monthLabel = eventDate ? MONTH_FORMATTER.format(eventDate).toUpperCase() : undefined
  const scheduleLabel = eventDate ? SCHEDULE_FORMATTER.format(eventDate) : undefined

  const marketBadges = event.markets
    .map((market) => {
      const metadata = (market.metadata ?? {}) as Record<string, any>
      return typeof metadata.short_title === 'string' && metadata.short_title.trim()
        ? metadata.short_title.trim()
        : (market.short_title ?? market.title)
    })
    .filter((label): label is string => Boolean(label && label.trim()))

  const visibleBadges = marketBadges.slice(0, 2)
  const hiddenBadges = marketBadges.slice(2)

  const hasRecentMarket = event.markets.some(market => isMarketNew(market.created_at))
  const totalVolume = event.markets.reduce((acc, market) => acc + (market.volume ?? 0), 0)

  const statusBadge = hasRecentMarket
    ? (
        <NewBadge
          variant="soft"
          className="rounded-md px-2 py-1 text-2xs font-semibold text-yellow-700 dark:text-yellow-200"
        />
      )
    : (
        <Badge
          variant="outline"
          className={cn(
            'rounded-md bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground',
          )}
        >
          {formatVolume(totalVolume)}
          {' '}
          Vol.
        </Badge>
      )

  return (
    <Link
      href={`/event/${event.slug}`}
      className={cn(
        'group relative flex flex-col gap-4 rounded-2xl border bg-background p-4 transition-all',
        'hover:-translate-y-0.5 hover:bg-card/50 hover:shadow-lg',
        'md:flex-row md:items-center md:gap-8 md:p-5',
      )}
    >
      <div className="flex items-start gap-3 md:w-60 md:shrink-0 md:items-center md:gap-4">
        <div className="flex w-16 flex-col items-center justify-center leading-none md:w-17">
          <span className="text-3xl font-bold tracking-tight text-foreground md:text-3xl">
            {dayLabel}
          </span>
          {monthLabel && (
            <span className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
              {monthLabel}
            </span>
          )}
        </div>
        <h2
          className={cn(
            'flex-1 text-base font-semibold text-foreground transition-colors',
            'md:hidden',
            'group-hover:text-foreground',
          )}
        >
          {event.title}
        </h2>

        <div
          className={cn(
            'relative size-16 overflow-hidden rounded-2xl border bg-muted/50 transition-transform',
            'duration-300 group-hover:scale-105 md:size-20',
          )}
        >
          <Image
            src={event.icon_url}
            alt={event.title}
            fill
            sizes="(max-width: 768px) 4rem, 5rem"
            className="object-cover"
            priority={false}
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 md:gap-3">
        <h2
          className={cn(
            'line-clamp-2 text-base font-semibold text-foreground transition-colors',
            'hidden md:block',
            'group-hover:text-foreground',
            'md:text-lg',
          )}
        >
          {event.title}
        </h2>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {statusBadge}
          {scheduleLabel && (
            <Badge
              variant="outline"
              className={cn(
                'rounded-md bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground',
              )}
            >
              {scheduleLabel}
            </Badge>
          )}
        </div>

        {(visibleBadges.length > 0 || hiddenBadges.length > 0) && (
          <div className="flex flex-wrap items-center gap-2 md:ms-auto">
            {visibleBadges.map(label => (
              <Badge
                key={label}
                variant="outline"
                className={cn(
                  `
                    cursor-pointer rounded-md border bg-background/70 px-3 py-1 text-xs font-medium text-foreground
                    transition-colors
                    hover:bg-card/70
                  `,
                )}
              >
                {label}
              </Badge>
            ))}

            {hiddenBadges.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className={cn(
                      `
                        cursor-pointer rounded-md border bg-background/70 px-3 py-1 text-xs font-medium
                        text-muted-foreground transition-colors
                        hover:bg-card/70
                      `,
                    )}
                  >
                    {`+${hiddenBadges.length}`}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  sideOffset={12}
                  className={cn(
                    `
                      max-w-[calc(100vw-2.5rem)] rounded-xl border border-border bg-background/95 p-3 text-sm
                      wrap-break-word whitespace-normal text-foreground shadow-xl backdrop-blur-sm
                      sm:max-w-90
                    `,
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {hiddenBadges.map(label => (
                      <Badge
                        key={label}
                        variant="outline"
                        className={cn(
                          `
                            cursor-pointer rounded-md border bg-background/80 px-2.5 py-1 text-2xs font-medium
                            text-muted-foreground transition-colors
                            hover:bg-card/70
                          `,
                        )}
                      >
                        {label}
                      </Badge>
                    ))}
                  </div>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        )}
      </div>

      <div className="hidden md:flex md:w-45 md:shrink-0 md:flex-col md:items-center md:justify-center">
        <Button asChild size="lg" className="px-6">
          <span>Trade</span>
        </Button>
      </div>
    </Link>
  )
}
