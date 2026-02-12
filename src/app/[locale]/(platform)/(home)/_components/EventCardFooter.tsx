import type { Event } from '@/types'
import { Repeat } from 'lucide-react'
import EventBookmark from '@/app/[locale]/(platform)/event/[slug]/_components/EventBookmark'
import { NewBadge } from '@/components/ui/new-badge'
import { formatVolume } from '@/lib/formatters'

interface EventCardFooterProps {
  event: Event
  shouldShowNewBadge: boolean
  resolvedVolume: number
  isInTradingMode: boolean
  endedLabel?: string | null
}

export default function EventCardFooter({
  event,
  shouldShowNewBadge,
  resolvedVolume,
  isInTradingMode,
  endedLabel,
}: EventCardFooterProps) {
  if (isInTradingMode) {
    return null
  }

  const isResolvedEvent = event.status === 'resolved'
  const recurrenceLabel = event.series_recurrence?.trim() || null
  const recurrenceDisplayLabel = recurrenceLabel
    ? `${recurrenceLabel.charAt(0).toUpperCase()}${recurrenceLabel.slice(1)}`
    : null

  return (
    <div className="flex items-center justify-between gap-2 text-xs/tight text-muted-foreground">
      <div className="flex items-center gap-2">
        {shouldShowNewBadge
          ? <NewBadge />
          : (
              <span>
                {formatVolume(resolvedVolume)}
                {' '}
                Vol.
              </span>
            )}
        {recurrenceDisplayLabel && (
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Repeat className="size-3" />
            <span>{recurrenceDisplayLabel}</span>
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
