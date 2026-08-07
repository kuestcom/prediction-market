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
}

export default function ResolutionReporterHistoryBadges({
  correctCount,
  incorrectCount,
  correctLabel,
  incorrectLabel,
  historyLabel,
  className,
}: ResolutionReporterHistoryBadgesProps) {
  if (correctCount + incorrectCount <= 0) {
    return null
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span className={cn('inline-flex shrink-0 items-center gap-1.5 tabular-nums', className)}>
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
        }
      />
      <TooltipContent>{historyLabel}</TooltipContent>
    </Tooltip>
  )
}
