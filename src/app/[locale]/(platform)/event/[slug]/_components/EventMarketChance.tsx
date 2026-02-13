'use client'

import type { EventMarketRow } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventMarketRows'
import { ExternalLinkIcon, TriangleIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useMemo, useState } from 'react'
import ResolutionTimelinePanel from '@/app/[locale]/(platform)/event/[slug]/_components/ResolutionTimelinePanel'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useSiteIdentity } from '@/hooks/useSiteIdentity'
import { buildUmaProposeUrl, buildUmaSettledUrl } from '@/lib/uma'
import { cn } from '@/lib/utils'

interface EventMarketChanceProps {
  market: EventMarketRow['market']
  chanceMeta: EventMarketRow['chanceMeta']
  layout: 'mobile' | 'desktop'
  highlightKey: string
  showInReviewTag?: boolean
}

export default function EventMarketChance({
  market,
  chanceMeta,
  layout,
  highlightKey,
  showInReviewTag = false,
}: EventMarketChanceProps) {
  const t = useExtracted()
  const siteIdentity = useSiteIdentity()
  const [isResolutionDialogOpen, setIsResolutionDialogOpen] = useState(false)
  const chanceChangeColorClass = chanceMeta.isChanceChangePositive ? 'text-yes' : 'text-no'
  const shouldReserveDelta = layout === 'desktop'
  const shouldRenderDelta = chanceMeta.shouldShowChanceChange || shouldReserveDelta
  const umaDetailsUrl = useMemo(
    () => buildUmaSettledUrl(market.condition, siteIdentity.name) ?? buildUmaProposeUrl(market.condition, siteIdentity.name),
    [market.condition, siteIdentity.name],
  )

  const baseClass = layout === 'mobile'
    ? 'text-lg font-medium'
    : 'text-3xl font-medium'

  return (
    <div
      className={cn(
        'flex flex-col items-end gap-1',
        { 'flex-row items-center gap-2': layout === 'desktop' },
      )}
    >
      <div className="flex items-center justify-end gap-1.5">
        <span
          key={`${layout}-chance-${highlightKey}`}
          className={cn(
            baseClass,
            chanceMeta.isSubOnePercent ? 'text-muted-foreground' : 'text-foreground',
            'motion-safe:animate-[pulse_0.8s_ease-out] motion-reduce:animate-none',
            'inline-block w-[4ch] text-right tabular-nums',
          )}
        >
          {chanceMeta.chanceDisplay}
        </span>
        {showInReviewTag && (
          <button
            type="button"
            className={`
              inline-flex items-center rounded-sm px-1.5 py-0.5 text-xs/tight font-semibold text-primary
              transition-colors
              hover:bg-primary/15
            `}
            onClick={(event) => {
              event.stopPropagation()
              setIsResolutionDialogOpen(true)
            }}
          >
            {t('In Review')}
          </button>
        )}
      </div>
      {shouldRenderDelta && (
        <div
          className={cn(
            'flex items-center justify-end gap-0.5 text-xs font-semibold',
            chanceChangeColorClass,
            { invisible: !chanceMeta.shouldShowChanceChange },
            { 'w-[5.5ch]': layout === 'desktop' },
          )}
        >
          <TriangleIcon
            className={cn('size-3 fill-current', { 'rotate-180': !chanceMeta.isChanceChangePositive })}
            fill="currentColor"
          />
          <span className="inline-block tabular-nums">
            {chanceMeta.chanceChangeLabel}
          </span>
        </div>
      )}

      {showInReviewTag && (
        <Dialog open={isResolutionDialogOpen} onOpenChange={setIsResolutionDialogOpen}>
          <DialogContent className="sm:max-w-lg sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-center text-2xl font-bold">{t('Resolution')}</DialogTitle>
            </DialogHeader>
            <div className="mt-2">
              <ResolutionTimelinePanel market={market} settledUrl={umaDetailsUrl} showLink={false} />
            </div>
            {umaDetailsUrl && (
              <div className="mt-3 flex justify-end">
                <a
                  href={umaDetailsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:underline"
                >
                  <span>{t('View details')}</span>
                  <ExternalLinkIcon className="size-3.5" />
                </a>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
