'use client'

import { CircleCheckIcon, CircleXIcon } from 'lucide-react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface ResolutionReporterHistoryBadgesProps {
  correctCount: number
  incorrectCount: number
  correctLabel: string
  incorrectLabel: string
  historyLabel: string
  className?: string
  withTooltip?: boolean
}

export default function ResolutionReporterHistoryBadges({
  correctCount,
  incorrectCount,
  correctLabel,
  incorrectLabel,
  historyLabel,
  className,
  withTooltip = true,
}: ResolutionReporterHistoryBadgesProps) {
  if (correctCount + incorrectCount <= 0) {
    return null
  }

  const badges = (
    <span
      role="group"
      tabIndex={withTooltip ? 0 : undefined}
      aria-label={withTooltip ? historyLabel : undefined}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-sm tabular-nums focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none',
        className,
      )}
    >
      <span
        className="inline-flex items-center gap-1 rounded-md border border-yes/25 bg-yes/8 px-1.5 py-0.5 text-xs font-medium text-yes"
        aria-label={`${correctCount} ${correctLabel}`}
      >
        <CircleCheckIcon className="size-3.5" aria-hidden />
        {correctCount}
      </span>
      <span
        className="inline-flex items-center gap-1 rounded-md border border-no/25 bg-no/8 px-1.5 py-0.5 text-xs font-medium text-no"
        aria-label={`${incorrectCount} ${incorrectLabel}`}
      >
        <CircleXIcon className="size-3.5" aria-hidden />
        {incorrectCount}
      </span>
    </span>
  )

  if (!withTooltip) {
    return badges
  }

  return (
    <Tooltip>
      <TooltipTrigger render={badges} />
      <TooltipContent>{historyLabel}</TooltipContent>
    </Tooltip>
  )
}
