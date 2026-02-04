'use client'

import type { EventMarketRow } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventMarketRows'
import { TriangleIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EventMarketChanceProps {
  chanceMeta: EventMarketRow['chanceMeta']
  layout: 'mobile' | 'desktop'
  highlightKey: string
}

export default function EventMarketChance({ chanceMeta, layout, highlightKey }: EventMarketChanceProps) {
  const chanceChangeColorClass = chanceMeta.isChanceChangePositive ? 'text-yes' : 'text-no'
  const shouldReserveDelta = layout === 'desktop'
  const shouldRenderDelta = chanceMeta.shouldShowChanceChange || shouldReserveDelta

  const baseClass = layout === 'mobile'
    ? 'text-lg font-medium'
    : 'text-3xl font-medium'

  return (
    <div
      className={cn(
        'flex flex-col items-end gap-1',
        layout === 'desktop' && 'flex-row items-center gap-2',
      )}
    >
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
      {shouldRenderDelta && (
        <div
          className={cn(
            'flex items-center justify-end gap-0.5 text-xs font-semibold',
            chanceChangeColorClass,
            !chanceMeta.shouldShowChanceChange && 'invisible',
            layout === 'desktop' && 'w-[5.5ch]',
          )}
        >
          <TriangleIcon
            className={cn('size-3 fill-current', chanceMeta.isChanceChangePositive ? '' : 'rotate-180')}
            fill="currentColor"
          />
          <span className="inline-block tabular-nums">
            {chanceMeta.chanceChangeLabel}
          </span>
        </div>
      )}
    </div>
  )
}
