'use client'

import type { SeriesConfig } from '@/types/PredictionChartTypes'
import { cn } from '@/lib/utils'

interface EventChartLegendProps {
  entries: Array<SeriesConfig & { value: number | null }>
  compact?: boolean
}

export default function EventChartLegend({ compact = false, entries }: EventChartLegendProps) {
  const entriesWithValues = entries.filter(
    entry => typeof entry.value === 'number' && Number.isFinite(entry.value),
  )

  if (entriesWithValues.length === 0) {
    return null
  }

  return (
    <div
      className={cn(
        compact
          ? 'grid min-h-5 grid-cols-2 gap-x-3 gap-y-1.5'
          : 'flex min-h-5 flex-wrap items-center gap-x-3 gap-y-1.5 sm:gap-x-4 sm:gap-y-2',
      )}
    >
      {entriesWithValues.map((entry) => {
        const resolvedValue = entry.value as number
        return (
          <div key={entry.key} className="flex max-w-full min-w-0 items-center gap-2">
            <div
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span
              className={cn(
                `inline-flex min-w-0 items-center gap-x-1.5 gap-y-0.5 text-xs font-medium text-muted-foreground`,
                compact ? 'w-full' : 'flex-wrap',
              )}
            >
              <span className={cn('min-w-0', compact ? 'truncate' : 'wrap-break-word')}>
                {entry.name}
              </span>
              <span className={cn(`
                inline-flex min-w-8 shrink-0 items-baseline justify-end text-sm font-semibold whitespace-nowrap
                text-foreground tabular-nums
              `)}
              >
                {resolvedValue.toFixed(0)}
                <span className="ml-0.5 text-sm text-foreground">%</span>
              </span>
            </span>
          </div>
        )
      })}
    </div>
  )
}
