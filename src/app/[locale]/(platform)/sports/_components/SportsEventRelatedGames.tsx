'use client'

import type { SportsGamesCard } from '@/app/[locale]/(platform)/sports/_utils/sports-games-data'
import type { SportsVertical } from '@/lib/sports-vertical'
import Image from 'next/image'
import { useMemo } from 'react'
import { formatRelatedOddsLabel, resolveRelatedTeamOdds } from '@/app/[locale]/(platform)/sports/_components/sports-event-center-utils'
import AppLink from '@/components/AppLink'
import { formatVolume } from '@/lib/formatters'
import { getSportsVerticalConfig } from '@/lib/sports-vertical'
import { cn } from '@/lib/utils'

function SportsEventRelatedGames({
  cards,
  sportSlug,
  sportLabel,
  locale,
  vertical,
}: {
  cards: SportsGamesCard[]
  sportSlug: string
  sportLabel: string
  locale: string
  vertical: SportsVertical
}) {
  const verticalConfig = getSportsVerticalConfig(vertical)
  const dateTimeFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'UTC',
    }),
    [locale],
  )

  if (cards.length === 0) {
    return null
  }

  return (
    <div className="grid gap-2.5">
      <p className="text-sm font-normal text-muted-foreground">
        {'More '}
        <AppLink href={`${verticalConfig.basePath}/${sportSlug}/games`} className="underline-offset-2 hover:underline">
          {sportLabel}
        </AppLink>
        {' Games'}
      </p>

      <div className="grid gap-2">
        {cards.map((relatedCard) => {
          const startTime = relatedCard.startTime ? new Date(relatedCard.startTime) : null
          const hasValidStartTime = Boolean(startTime && !Number.isNaN(startTime.getTime()))
          const topLineDate = hasValidStartTime ? dateTimeFormatter.format(startTime as Date) : 'Date TBD'
          const { team1Cents, team2Cents } = resolveRelatedTeamOdds(relatedCard)
          const team1 = relatedCard.teams[0] ?? null
          const team2 = relatedCard.teams[1] ?? null

          return (
            <AppLink
              intentPrefetch
              key={relatedCard.id}
              href={relatedCard.eventHref}
              className={cn(`block rounded-xl px-3 py-2.5 transition-colors hover:bg-card`)}
            >
              <p className="mb-2 text-xs font-normal text-muted-foreground">
                {topLineDate}
                <span className="mx-2 inline-block">·</span>
                {formatVolume(relatedCard.volume)}
                {' '}
                Vol.
              </p>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="flex size-6 shrink-0 items-center justify-center">
                      {team1?.logoUrl
                        ? (
                            <Image
                              src={team1.logoUrl}
                              alt={`${team1.name} logo`}
                              width={24}
                              height={24}
                              sizes="24px"
                              className="size-full object-contain object-center"
                            />
                          )
                        : (
                            <span className="text-2xs font-semibold text-muted-foreground">
                              {team1?.abbreviation?.slice(0, 1)?.toUpperCase() ?? '—'}
                            </span>
                          )}
                    </span>
                    <span className="truncate text-xs font-normal text-foreground">
                      {team1?.name ?? '—'}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-normal text-muted-foreground">
                    {formatRelatedOddsLabel(team1Cents)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="flex size-6 shrink-0 items-center justify-center">
                      {team2?.logoUrl
                        ? (
                            <Image
                              src={team2.logoUrl}
                              alt={`${team2.name} logo`}
                              width={24}
                              height={24}
                              sizes="24px"
                              className="size-full object-contain object-center"
                            />
                          )
                        : (
                            <span className="text-2xs font-semibold text-muted-foreground">
                              {team2?.abbreviation?.slice(0, 1)?.toUpperCase() ?? '—'}
                            </span>
                          )}
                    </span>
                    <span className="truncate text-xs font-normal text-foreground">
                      {team2?.name ?? '—'}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-normal text-muted-foreground">
                    {formatRelatedOddsLabel(team2Cents)}
                  </span>
                </div>
              </div>
            </AppLink>
          )
        })}
      </div>
    </div>
  )
}

export default SportsEventRelatedGames
