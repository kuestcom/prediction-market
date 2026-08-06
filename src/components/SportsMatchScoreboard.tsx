import type { ReactNode } from 'react'

import type { SportsSegmentScore } from '@/types'

import EventIconImage from '@/components/EventIconImage'
import { cn } from '@/lib/utils'

export interface SportsMatchScoreboardTeam {
  name: string
  abbreviation?: string | null
  logoUrl?: string | null
}

export default function SportsMatchScoreboard({
  homeTeam,
  awayTeam,
  scores,
  renderScore,
  className,
}: {
  homeTeam: SportsMatchScoreboardTeam
  awayTeam: SportsMatchScoreboardTeam
  scores: SportsSegmentScore[]
  renderScore?: (input: { score: SportsSegmentScore; team: 'home' | 'away' }) => ReactNode
  className?: string
}) {
  return (
    <div className={cn('grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2', className)}>
      <span aria-hidden />
      <div className="flex items-center">
        {scores.map((score) => (
          <span
            key={score.segment}
            className="flex w-10 shrink-0 justify-center text-2xs font-semibold tracking-wide text-muted-foreground uppercase"
          >
            M{score.segment}
          </span>
        ))}
      </div>

      {(['home', 'away'] as const).map((team) => {
        const teamData = team === 'home' ? homeTeam : awayTeam

        return (
          <div key={team} className="contents">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center">
                {teamData.logoUrl ? (
                  <EventIconImage
                    src={teamData.logoUrl}
                    alt={`${teamData.name} logo`}
                    sizes="40px"
                    containerClassName="size-full"
                    imageClassName="object-contain"
                  />
                ) : (
                  <span className="text-xs font-semibold text-muted-foreground">
                    {teamData.abbreviation ?? teamData.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              <span className="min-w-0 truncate text-sm font-semibold text-foreground">{teamData.name}</span>
            </div>

            <div className="flex items-center">
              {scores.map((score) => (
                <div
                  key={score.segment}
                  className="flex w-10 shrink-0 justify-center text-sm font-semibold tabular-nums"
                >
                  {renderScore
                    ? renderScore({ score, team })
                    : ((team === 'home' ? score.homeScore : score.awayScore) ?? '—')}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
