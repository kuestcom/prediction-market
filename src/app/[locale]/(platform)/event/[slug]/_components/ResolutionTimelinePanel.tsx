'use client'

import type { ResolutionTimelineItem, ResolutionTimelineOutcome } from '@/app/[locale]/(platform)/event/[slug]/_utils/resolution-timeline-builder'
import type { Event } from '@/types'
import { CheckIcon, GavelIcon, SquareArrowOutUpRightIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useMemo, useSyncExternalStore } from 'react'
import {
  buildResolutionTimeline,
  formatResolutionCountdown,
} from '@/app/[locale]/(platform)/event/[slug]/_utils/resolution-timeline-builder'
import { Button } from '@/components/ui/button'
import { useOutcomeLabel } from '@/hooks/useOutcomeLabel'
import { useSiteIdentity } from '@/hooks/useSiteIdentity'
import { OUTCOME_INDEX } from '@/lib/constants'
import { buildUmaProposeUrl } from '@/lib/uma'
import { cn } from '@/lib/utils'

interface ResolutionTimelinePanelProps {
  market: Event['markets'][number]
  settledUrl: string | null
  outcomeOverride?: ResolutionTimelineOutcome | null
  showLink?: boolean
  className?: string
}

const RESOLUTION_TIMELINE_TICK_INTERVAL_MS = 1000
let resolutionTimelineNowMsStore = 0
const resolutionTimelineNowMsListeners = new Set<() => void>()
let resolutionTimelineNowMsInterval: number | null = null

function subscribeToResolutionTimelineNowMs(onStoreChange: () => void) {
  resolutionTimelineNowMsListeners.add(onStoreChange)
  const nextNowTimestamp = Date.now()
  if (nextNowTimestamp !== resolutionTimelineNowMsStore) {
    resolutionTimelineNowMsStore = nextNowTimestamp
    onStoreChange()
  }

  if (resolutionTimelineNowMsInterval === null) {
    resolutionTimelineNowMsInterval = window.setInterval(() => {
      resolutionTimelineNowMsStore = Date.now()
      for (const listener of resolutionTimelineNowMsListeners) {
        listener()
      }
    }, RESOLUTION_TIMELINE_TICK_INTERVAL_MS)
  }

  return () => {
    resolutionTimelineNowMsListeners.delete(onStoreChange)
    if (resolutionTimelineNowMsListeners.size === 0 && resolutionTimelineNowMsInterval !== null) {
      window.clearInterval(resolutionTimelineNowMsInterval)
      resolutionTimelineNowMsInterval = null
    }
  }
}

function getResolutionTimelineNowMsSnapshot() {
  return resolutionTimelineNowMsStore
}

function getResolutionTimelineNowMsServerSnapshot() {
  return 0
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
          relative flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-background
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
  yesOutcomeLabel,
  noOutcomeLabel,
  outcomeOverride,
}: {
  item: ResolutionTimelineItem
  disputeUrl: string | null
  yesOutcomeLabel: string
  noOutcomeLabel: string
  outcomeOverride: ResolutionTimelineOutcome | null
}) {
  const t = useExtracted()

  function outcomeLabel(outcome: ResolutionTimelineOutcome | null): string {
    if (outcome === 'yes') {
      return yesOutcomeLabel
    }
    if (outcome === 'no') {
      return noOutcomeLabel
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
        {outcomeLabel(item.outcome ?? outcomeOverride)}
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
    const remainingSeconds = item.remainingSeconds ?? 0
    const showCountdown = remainingSeconds > 0
    const countdown = formatResolutionCountdown(remainingSeconds)
    return (
      <span className="text-sm font-medium text-foreground">
        {t('Final review')}
        {showCountdown && (
          <>
            {' '}
            <span className="font-semibold text-primary">{countdown}</span>
          </>
        )}
      </span>
    )
  }

  if (item.type === 'disputeWindow') {
    const remainingSeconds = item.remainingSeconds ?? 0
    const showCountdown = remainingSeconds > 0
    const countdown = formatResolutionCountdown(remainingSeconds)

    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-foreground">
          {t('Dispute window')}
          {showCountdown && (
            <>
              {' '}
              <span className="font-semibold text-primary">{countdown}</span>
            </>
          )}
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
      {outcomeLabel(item.outcome ?? outcomeOverride)}
    </span>
  )
}

function useResolutionTimeline(market: Event['markets'][number], siteName: string) {
  const nowMs = useSyncExternalStore(
    subscribeToResolutionTimelineNowMs,
    getResolutionTimelineNowMsSnapshot,
    getResolutionTimelineNowMsServerSnapshot,
  )
  const timeline = useMemo(
    () => (nowMs <= 0 ? null : buildResolutionTimeline(market, { nowMs })),
    [market, nowMs],
  )
  const disputeUrl = useMemo(
    () => buildUmaProposeUrl(market.condition, siteName),
    [market.condition, siteName],
  )

  return { timeline, disputeUrl }
}

export default function ResolutionTimelinePanel({
  market,
  settledUrl,
  outcomeOverride = null,
  showLink = true,
  className,
}: ResolutionTimelinePanelProps) {
  const t = useExtracted()
  const normalizeOutcomeLabel = useOutcomeLabel()
  const siteIdentity = useSiteIdentity()
  const { timeline, disputeUrl } = useResolutionTimeline(market, siteIdentity.name)
  const yesOutcomeText = market.outcomes.find(outcome => outcome.outcome_index === OUTCOME_INDEX.YES)?.outcome_text
  const noOutcomeText = market.outcomes.find(outcome => outcome.outcome_index === OUTCOME_INDEX.NO)?.outcome_text
  const yesOutcomeLabel = (yesOutcomeText ? normalizeOutcomeLabel(yesOutcomeText) : '') || yesOutcomeText || t('Yes')
  const noOutcomeLabel = (noOutcomeText ? normalizeOutcomeLabel(noOutcomeText) : '') || noOutcomeText || t('No')

  if (!timeline || timeline.items.length === 0) {
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
            <TimelineLabel
              item={item}
              disputeUrl={disputeUrl}
              yesOutcomeLabel={yesOutcomeLabel}
              noOutcomeLabel={noOutcomeLabel}
              outcomeOverride={outcomeOverride}
            />
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
