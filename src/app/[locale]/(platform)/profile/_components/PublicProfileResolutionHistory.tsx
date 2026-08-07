'use client'

import type { Route } from 'next'

import { useExtracted } from 'next-intl'

import ResolutionReporterHistoryBadges from '@/components/ResolutionReporterHistoryBadges'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Link } from '@/i18n/navigation'

interface PublicProfileResolutionHistoryProps {
  correctCount: number
  href: Route
  incorrectCount: number
  username: string
}

export default function PublicProfileResolutionHistory({
  correctCount,
  href,
  incorrectCount,
  username,
}: PublicProfileResolutionHistoryProps) {
  const t = useExtracted()
  const historyLabel = t("{username}'s proposal history: {correct} correct and {incorrect} incorrect.", {
    username,
    correct: String(correctCount),
    incorrect: String(incorrectCount),
  })

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Link
            href={href}
            aria-label={historyLabel}
            className="inline-flex shrink-0 items-center rounded-full border border-border/80 bg-background px-1.5 py-1 transition-colors hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <ResolutionReporterHistoryBadges
              correctCount={correctCount}
              incorrectCount={incorrectCount}
              correctLabel={t('Correct')}
              incorrectLabel={t('Incorrect')}
              historyLabel={historyLabel}
              className="gap-1 [&_svg]:size-3 [&>span]:px-1.5 [&>span]:py-0.5 [&>span]:text-xs"
              withTooltip={false}
            />
          </Link>
        }
      />
      <TooltipContent>{historyLabel}</TooltipContent>
    </Tooltip>
  )
}
