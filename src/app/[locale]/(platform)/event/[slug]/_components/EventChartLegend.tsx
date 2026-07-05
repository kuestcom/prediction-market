'use client'

import type { EventChartLegendVariant } from '@/app/[locale]/(platform)/event/[slug]/_types/EventChartTypes'
import type { SeriesConfig } from '@/types/PredictionChartTypes'
import { cn } from '@/lib/utils'

interface EventChartLegendProps {
  entries: Array<SeriesConfig & { value: number | null }>
  compact?: boolean
  variant?: EventChartLegendVariant
}

export default function EventChartLegend({ compact = false, entries, variant }: EventChartLegendProps) {
  const entriesWithValues = entries.filter(
    entry => typeof entry.value === 'number' && Number.isFinite(entry.value),
  )
  const resolvedVariant = variant ?? (compact ? 'compact' : 'default')

  if (entriesWithValues.length === 0) {
    return null
  }

  return (
    <div
      className={cn(
        resolvedVariant === 'card'
          ? 'flex min-h-5 flex-wrap items-center gap-x-5 gap-y-1.5'
          : resolvedVariant === 'compact'
            ? 'grid min-h-5 grid-cols-2 gap-x-3 gap-y-1.5'
            : 'flex min-h-5 flex-wrap items-center gap-x-3 gap-y-1.5 sm:gap-x-4 sm:gap-y-2',
      )}
    >
      {entriesWithValues.map((entry) => {
        const resolvedValue = entry.value as number
        const isCardVariant = resolvedVariant === 'card'
        const valueNode = (
          <span
            className={cn(
              `
                inline-flex shrink-0 items-baseline justify-end font-semibold whitespace-nowrap text-foreground
                tabular-nums
              `,
              isCardVariant ? 'min-w-7 text-xs leading-none' : 'min-w-8 text-sm',
            )}
          >
            {resolvedValue.toFixed(0)}
            <span className={cn('ml-0.5 text-foreground', isCardVariant ? 'text-xs' : 'text-sm')}>%</span>
          </span>
        )

        return (
          <div
            key={entry.key}
            className={cn(
              resolvedVariant === 'card'
                ? 'flex max-w-full min-w-0 items-center gap-2'
                : 'flex max-w-full min-w-0 items-center gap-2',
            )}
          >
            <div
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            {resolvedVariant === 'card'
              ? (
                  <>
                    <span className="min-w-0 truncate text-xs leading-none font-medium text-muted-foreground">
                      {entry.name}
                    </span>
                    {valueNode}
                  </>
                )
              : (
                  <span
                    className={cn(
                      `inline-flex min-w-0 items-center gap-x-1.5 gap-y-0.5 text-xs font-medium text-muted-foreground`,
                      resolvedVariant === 'compact' ? 'w-full' : 'flex-wrap',
                    )}
                  >
                    <span className={cn('min-w-0', resolvedVariant === 'compact' ? 'truncate' : 'wrap-break-word')}>
                      {entry.name}
                    </span>
                    {valueNode}
                  </span>
                )}
          </div>
        )
      })}
    </div>
  )
}
