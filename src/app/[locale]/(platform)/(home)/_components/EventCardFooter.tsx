import type { Event } from '@/types'
import { Repeat } from 'lucide-react'
import EventBookmark from '@/app/[locale]/(platform)/event/[slug]/_components/EventBookmark'
import { NewBadge } from '@/components/ui/new-badge'
import { formatVolume } from '@/lib/formatters'

interface EventCardFooterProps {
  event: Event
  shouldShowNewBadge: boolean
  showLiveBadge: boolean
  resolvedVolume: number
  isInTradingMode: boolean
  endedLabel?: string | null
}

export default function EventCardFooter({
  event,
  shouldShowNewBadge,
  showLiveBadge,
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
        {showLiveBadge && !shouldShowNewBadge && (
          <span className="inline-flex items-center gap-1.5 text-red-500">
            <span className="relative inline-flex size-2.5 items-center justify-center">
              <span className="absolute inset-0 m-auto inline-flex size-2.5 animate-ping rounded-full bg-red-500/45" />
              <span className="relative inline-flex size-2 rounded-full bg-red-500" />
            </span>
            <span className="text-sm font-medium tracking-[0.04em] uppercase">Live</span>
          </span>
        )}
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
