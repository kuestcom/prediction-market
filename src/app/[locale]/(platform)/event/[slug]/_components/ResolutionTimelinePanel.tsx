import type { ResolutionTimelineItem, ResolutionTimelineOutcome } from '@/app/[locale]/(platform)/event/[slug]/_utils/resolution-timeline-builder'
import type { Event } from '@/types'
import { CheckIcon, GavelIcon, SquareArrowOutUpRightIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import {
  buildResolutionTimeline,
  formatResolutionCountdown,
} from '@/app/[locale]/(platform)/event/[slug]/_utils/resolution-timeline-builder'
import { Button } from '@/components/ui/button'
import { useSiteIdentity } from '@/hooks/useSiteIdentity'
import { buildUmaProposeUrl } from '@/lib/uma'
import { cn } from '@/lib/utils'

interface ResolutionTimelinePanelProps {
  market: Event['markets'][number]
  settledUrl: string | null
  showLink?: boolean
  className?: string
}

function TimelineIcon({ item }: { item: ResolutionTimelineItem }) {
  if (item.icon === 'gavel') {
    return (
      <span className="relative flex size-6 shrink-0 items-center justify-center rounded-full bg-muted">
        <GavelIcon className="size-3.5 text-muted-foreground" />
      </span>
    )
  }

  if (item.icon === 'open') {
    return (
      <span
        className={`
          relative flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-transparent
        `}
      />
    )
  }

  return (
    <span className="relative flex size-6 shrink-0 items-center justify-center rounded-full bg-primary">
      <CheckIcon className="size-3.5 text-primary-foreground" />
    </span>
  )
}

function TimelineLabel({
  item,
  disputeUrl,
}: {
  item: ResolutionTimelineItem
  disputeUrl: string | null
}) {
  const t = useExtracted()

  function outcomeLabel(outcome: ResolutionTimelineOutcome | null): string {
    if (outcome === 'yes') {
      return t('Yes')
    }
    if (outcome === 'no') {
      return t('No')
    }
    if (outcome === 'invalid') {
      return t('Invalid')
    }
    return t('Unknown')
  }

  if (item.type === 'outcomeProposed') {
    return (
      <span className="text-sm font-medium text-foreground">
        {t('Outcome proposed:')}
        {' '}
        {outcomeLabel(item.outcome)}
      </span>
    )
  }

  if (item.type === 'noDispute') {
    return <span className="text-sm font-medium text-foreground">{t('No dispute')}</span>
  }

  if (item.type === 'disputed') {
    return <span className="text-sm font-medium text-foreground">{t('Disputed')}</span>
  }

  if (item.type === 'finalReview') {
    const countdown = formatResolutionCountdown(item.remainingSeconds ?? 0)
    return (
      <span className="text-sm font-medium text-foreground">
        {t('Final review')}
        {' '}
        <span className="font-semibold text-primary">{countdown}</span>
      </span>
    )
  }

  if (item.type === 'disputeWindow') {
    const countdown = formatResolutionCountdown(item.remainingSeconds ?? 0)

    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-foreground">
          {t('Dispute window')}
          {' '}
          <span className="font-semibold text-primary">{countdown}</span>
        </span>
        {disputeUrl
          ? (
              <Button
                variant="outline"
                size="sm"
                className="h-7 bg-transparent px-2.5 text-xs font-semibold"
                asChild
              >
                <a href={disputeUrl} target="_blank" rel="noopener noreferrer">
                  {t('Dispute')}
                </a>
              </Button>
            )
          : (
              <Button
                variant="outline"
                size="sm"
                className="h-7 bg-transparent px-2.5 text-xs font-semibold"
                disabled
              >
                {t('Dispute')}
              </Button>
            )}
      </div>
    )
  }

  return (
    <span className="text-sm font-medium text-foreground">
      {t('Final outcome:')}
      {' '}
      {outcomeLabel(item.outcome)}
    </span>
  )
}

export default function ResolutionTimelinePanel({
  market,
  settledUrl,
  showLink = true,
  className,
}: ResolutionTimelinePanelProps) {
  const t = useExtracted()
  const siteIdentity = useSiteIdentity()
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    setNowMs(Date.now())
  }, [market.condition_id])

  const timeline = useMemo(
    () => buildResolutionTimeline(market, { nowMs }),
    [market, nowMs],
  )
  const disputeUrl = useMemo(
    () => buildUmaProposeUrl(market.condition, siteIdentity.name),
    [market.condition, siteIdentity.name],
  )

  const hasActiveCountdown = timeline.items.some(item =>
    (item.type === 'finalReview' || item.type === 'disputeWindow')
    && item.state === 'active'
    && (item.remainingSeconds ?? 0) > 0)

  useEffect(() => {
    if (!hasActiveCountdown) {
      return
    }

    const interval = window.setInterval(() => {
      setNowMs(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(interval)
    }
  }, [hasActiveCountdown])

  if (timeline.items.length === 0) {
    return null
  }

  const hasFinalOutcome = timeline.items.some(item => item.type === 'finalOutcome' && item.state === 'done')
  const hasLink = Boolean(settledUrl) && showLink && hasFinalOutcome

  return (
    <div className={cn('flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div className="relative flex flex-col gap-6">
        {timeline.items.length > 1 && (
          <div className="absolute inset-y-3 left-2.5 w-1 bg-primary" aria-hidden="true" />
        )}

        {timeline.items.map(item => (
          <div key={item.id} className="relative flex items-center gap-3">
            <TimelineIcon item={item} />
            <TimelineLabel item={item} disputeUrl={disputeUrl} />
          </div>
        ))}
      </div>

      {hasLink && (
        <a
          href={settledUrl ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm font-semibold text-foreground hover:underline"
        >
          {t('View details')}
          <SquareArrowOutUpRightIcon className="size-4" />
        </a>
      )}
    </div>
  )
}
