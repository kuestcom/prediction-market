import type { Event } from '@/types'
import { Repeat } from 'lucide-react'
import EventBookmark from '@/app/[locale]/(platform)/event/[slug]/_components/EventBookmark'
import { NewBadge } from '@/components/ui/new-badge'
import { formatVolume } from '@/lib/formatters'
import { cn } from '@/lib/utils'

interface EventCardFooterProps {
  event: Event
  hasRecentMarket: boolean
  resolvedVolume: number
  isInTradingMode: boolean
  endedLabel?: string | null
}

export default function EventCardFooter({
  event,
  hasRecentMarket,
  resolvedVolume,
  isInTradingMode,
  endedLabel,
}: EventCardFooterProps) {
  if (isInTradingMode) {
    return null
  }

  const isResolvedEvent = event.status === 'resolved'
  const recurrenceLabel = event.series_recurrence?.trim() || null

  return (
    <div className={cn(`flex items-center justify-between gap-2 pb-2 text-xs/tight text-muted-foreground md:pb-0`, { 'pb-2': isResolvedEvent })}>
      <div className="flex items-center gap-2">
        {hasRecentMarket
          ? <NewBadge />
          : (
              <span>
                {formatVolume(resolvedVolume)}
                {' '}
                Vol.
              </span>
            )}
        {recurrenceLabel && (
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Repeat className="size-3" />
            <span>{recurrenceLabel}</span>
          </span>
        )}
      </div>
      {isResolvedEvent
        ? (endedLabel
            ? <span>{endedLabel}</span>
            : null)
        : <EventBookmark event={event} />}
    </div>
  )
}
