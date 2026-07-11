import type { Event } from '@/types'
import { Repeat } from 'lucide-react'
import { useExtracted } from 'next-intl'
import EventBookmark from '@/app/[locale]/(platform)/event/[slug]/_components/EventBookmark'
import { NewBadge } from '@/components/ui/new-badge'
import { formatVolume } from '@/lib/formatters'
import { isEventResolvedLike } from '@/lib/home-events'

interface EventCardFooterProps {
  event: Event
  shouldShowNewBadge: boolean
  showLiveBadge: boolean
  resolvedVolume: number
  endedLabel?: string | null
}

export default function EventCardFooter({
  event,
  shouldShowNewBadge,
  showLiveBadge,
  resolvedVolume,
  endedLabel,
}: EventCardFooterProps) {
  const t = useExtracted()
  const isResolvedEvent = isEventResolvedLike(event)
  const recurrenceLabel = event.series_recurrence?.trim().toLowerCase() || null
  const recurrenceDisplayLabel = recurrenceLabel === 'daily'
    ? t('Daily')
    : recurrenceLabel === 'weekly'
      ? t('Weekly')
      : recurrenceLabel === 'monthly'
        ? t('Monthly')
        : recurrenceLabel
          ? `${recurrenceLabel.charAt(0).toUpperCase()}${recurrenceLabel.slice(1)}`
          : null

  return (
    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
      <div className="flex items-center gap-2">
        {showLiveBadge && !shouldShowNewBadge && (
          <span className="flex items-center gap-1.5">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-2 animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-red-500" />
            </span>
            <span className="leading-none font-medium text-red-500 uppercase">{t('Live')}</span>
          </span>
        )}
        {shouldShowNewBadge
          ? <NewBadge />
          : (
              <span>
                {t('{amount} Vol.', { amount: formatVolume(resolvedVolume) })}
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
        : <EventBookmark event={event} refreshStatusOnMount={false} />}
    </div>
  )
}
