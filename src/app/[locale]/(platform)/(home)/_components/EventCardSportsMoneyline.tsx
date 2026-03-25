'use client'

import type { HomeSportsMoneylineButton, HomeSportsMoneylineModel } from '@/lib/sports-home-card'
import type { Event } from '@/types'
import { CheckIcon } from 'lucide-react'
import Image from 'next/image'
import EventBookmark from '@/app/[locale]/(platform)/event/[slug]/_components/EventBookmark'
import IntentPrefetchLink from '@/components/IntentPrefetchLink'
import { Card, CardContent } from '@/components/ui/card'
import { ensureReadableTextColorOnDark } from '@/lib/color-contrast'
import { resolveEventOutcomePath } from '@/lib/events-routing'
import { formatDate, formatVolume } from '@/lib/formatters'
import { isHomeEventResolvedLike } from '@/lib/home-events'
import { resolveHomeSportsButtonChance, resolveResolvedHomeSportsMoneylineWinner } from '@/lib/sports-home-card'
import { resolveSportsTeamFallbackClassName } from '@/lib/sports-team-colors'
import { cn } from '@/lib/utils'

interface EventCardSportsMoneylineProps {
  event: Event
  model: HomeSportsMoneylineModel
  getDisplayChance: (marketId: string) => number
  currentTimestamp?: number | null
}

const HOME_OUTCOME_BUTTON_HEIGHT_CLASS = 'h-[40px]'

function normalizeComparableText(value: string | null | undefined) {
  return value
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    ?? ''
}

function formatSportsDisplayLabel(value: string | null | undefined) {
  const normalized = value?.trim()
  if (!normalized) {
    return null
  }

  return normalized
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((token) => {
      const lowerToken = token.toLowerCase()
      if (/^[a-z0-9]{1,3}$/i.test(lowerToken)) {
        return lowerToken.toUpperCase()
      }

      return lowerToken.charAt(0).toUpperCase() + lowerToken.slice(1)
    })
    .join(' ')
}

function resolveSportsCompetitionLabel(event: Event) {
  const normalizedSportSlug = normalizeComparableText(event.sports_sport_slug)
  const preferredCompetitionTag = (event.sports_tags ?? []).find((tag) => {
    const normalizedTag = normalizeComparableText(tag)
    return normalizedTag
      && normalizedTag !== normalizedSportSlug
      && normalizedTag !== 'games'
      && normalizedTag !== 'game'
      && normalizedTag !== 'props'
      && normalizedTag !== 'prop'
  })

  return formatSportsDisplayLabel(preferredCompetitionTag)
    ?? formatSportsDisplayLabel(event.sports_sport_slug)
}

function formatSportsStartTime(value: string | null | undefined, currentTimestamp?: number | null) {
  if (!value) {
    return null
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  const timeLabel = parsed.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })

  if (currentTimestamp == null) {
    const dateLabel = parsed.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
    return `${dateLabel} ${timeLabel}`
  }

  const now = new Date(currentTimestamp)
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfTarget = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())
  const dayDiff = Math.round((startOfTarget.getTime() - startOfToday.getTime()) / 86_400_000)

  if (dayDiff === 0) {
    return timeLabel
  }

  if (dayDiff === 1) {
    return `Tomorrow ${timeLabel}`
  }

  if (dayDiff === -1) {
    return `Yesterday ${timeLabel}`
  }

  if (dayDiff > 1 && dayDiff < 7) {
    const weekdayLabel = parsed.toLocaleDateString('en-US', { weekday: 'short' })
    return `${weekdayLabel} ${timeLabel}`
  }

  const dateLabel = parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
  return `${dateLabel} ${timeLabel}`
}

function getButtonToneStyles(button: HomeSportsMoneylineButton) {
  if (button.tone === 'draw') {
    return {
      className: `
        ${HOME_OUTCOME_BUTTON_HEIGHT_CLASS} w-18 shrink-0 rounded-sm border border-button-outline-border px-4
        text-sm font-semibold text-muted-foreground
      `,
      style: undefined,
      backgroundStyle: undefined,
    }
  }

  if (!button.color) {
    return {
      className: cn(
        `${HOME_OUTCOME_BUTTON_HEIGHT_CLASS} flex-1 rounded-sm px-2 text-sm font-semibold text-foreground`,
      ),
      style: undefined,
      backgroundClassName: resolveSportsTeamFallbackClassName(button.tone),
      backgroundStyle: undefined,
    }
  }

  const textColor = ensureReadableTextColorOnDark(button.color)

  return {
    className: `${HOME_OUTCOME_BUTTON_HEIGHT_CLASS} flex-1 rounded-sm px-2 text-sm font-semibold`,
    style: textColor ? { color: textColor } : undefined,
    backgroundClassName: undefined,
    backgroundStyle: button.color ? { backgroundColor: button.color } : undefined,
  }
}

export default function EventCardSportsMoneyline({
  event,
  model,
  getDisplayChance,
  currentTimestamp,
}: EventCardSportsMoneylineProps) {
  const marketSlugByConditionId = new Map(
    (event.markets ?? [])
      .filter(market => Boolean(market.condition_id && market.slug))
      .map(market => [market.condition_id, market.slug as string] as const),
  )
  function resolveButtonHref(button: HomeSportsMoneylineButton) {
    const marketSlug = marketSlugByConditionId.get(button.conditionId)
    return resolveEventOutcomePath(event, {
      marketSlug,
      conditionId: button.conditionId,
      outcomeIndex: button.outcomeIndex,
    })
  }
  const isResolvedEvent = isHomeEventResolvedLike(event)
  const sportsCompetitionLabel = resolveSportsCompetitionLabel(event)
  const startTimeLabel = formatSportsStartTime(event.sports_start_time ?? event.start_date, currentTimestamp)
  const endedLabel = isResolvedEvent && event.resolved_at
    ? (() => {
        const resolvedDate = new Date(event.resolved_at)
        if (Number.isNaN(resolvedDate.getTime())) {
          return null
        }
        return `Ended ${formatDate(resolvedDate)}`
      })()
    : null
  const team1Chance = Math.round(resolveHomeSportsButtonChance(
    getDisplayChance(model.team1Button.conditionId),
    model.team1Button.outcomeIndex,
  ))
  const team2Chance = Math.round(resolveHomeSportsButtonChance(
    getDisplayChance(model.team2Button.conditionId),
    model.team2Button.outcomeIndex,
  ))
  const resolvedWinner = isResolvedEvent
    ? resolveResolvedHomeSportsMoneylineWinner(event, model)
    : null

  return (
    <Card
      className={`
        group relative flex h-45 cursor-pointer flex-col overflow-hidden rounded-xl shadow-md shadow-black/4
        transition-all
        hover:-translate-y-0.5 hover:shadow-black/8
        dark:hover:bg-secondary
      `}
    >
      <CardContent
        className={cn(`
          flex h-full flex-col px-3 pt-3
          ${isResolvedEvent ? 'pb-3' : 'pb-3 md:pb-1'}
        `)}
      >
        <div className="flex w-full flex-col gap-0.5">
          <IntentPrefetchLink
            href={resolveButtonHref(model.team1Button)}
            className="group/team-row-1 flex h-8 items-center justify-between gap-2"
          >
            <div className="flex min-w-0 items-center gap-2">
              <div className="relative size-7 overflow-hidden rounded-sm">
                {model.team1.logoUrl
                  ? (
                      <Image
                        alt={model.team1.name}
                        src={model.team1.logoUrl}
                        fill
                        className="object-contain"
                        sizes="28px"
                      />
                    )
                  : null}
              </div>
              <p className="truncate text-sm font-medium decoration-2 group-hover/team-row-1:underline">
                {model.team1.name}
              </p>
            </div>
            <p className="shrink-0 text-lg font-semibold">
              {team1Chance}
              %
            </p>
          </IntentPrefetchLink>
          <IntentPrefetchLink
            href={resolveButtonHref(model.team2Button)}
            className="group/team-row-2 flex h-8 items-center justify-between gap-2"
          >
            <div className="flex min-w-0 items-center gap-2">
              <div className="relative size-7 overflow-hidden rounded-sm">
                {model.team2.logoUrl
                  ? (
                      <Image
                        alt={model.team2.name}
                        src={model.team2.logoUrl}
                        fill
                        className="object-contain"
                        sizes="28px"
                      />
                    )
                  : null}
              </div>
              <p className="truncate text-sm font-medium decoration-2 group-hover/team-row-2:underline">
                {model.team2.name}
              </p>
            </div>
            <p className="shrink-0 text-lg font-semibold">
              {team2Chance}
              %
            </p>
          </IntentPrefetchLink>
        </div>

        <div className="flex flex-1 flex-col">
          <div className={cn(isResolvedEvent ? 'mt-auto mb-3' : 'mt-auto mb-2')}>
            {isResolvedEvent && resolvedWinner
              ? (
                  <div className={`
                    flex h-12 w-full cursor-default items-center justify-center gap-2 rounded-md border px-3 text-sm
                    font-semibold text-foreground transition-colors
                    dark:border-none dark:bg-secondary
                    dark:group-hover:bg-card
                  `}
                  >
                    <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-yes">
                      <CheckIcon className="size-3 text-background" strokeWidth={2.5} />
                    </span>
                    <span className="min-w-8 truncate text-left">{resolvedWinner.label}</span>
                  </div>
                )
              : (
                  <div className="flex h-fit items-center justify-center gap-2">
                    {[model.team1Button, model.drawButton, model.team2Button]
                      .filter((button): button is HomeSportsMoneylineButton => Boolean(button))
                      .map((button) => {
                        const toneStyles = getButtonToneStyles(button)

                        return (
                          <IntentPrefetchLink
                            key={`${button.conditionId}:${button.outcomeIndex}`}
                            href={resolveButtonHref(button)}
                            className={cn(
                              `
                                relative inline-flex items-center justify-center overflow-hidden transition duration-150
                                active:scale-[97%]
                              `,
                              button.tone === 'draw'
                                ? 'hover:bg-secondary/80 hover:text-foreground'
                                : 'group/team-button hover:bg-transparent',
                              toneStyles.className,
                            )}
                            style={toneStyles.style}
                          >
                            {button.tone === 'draw'
                              ? <span className="relative z-1">{button.label}</span>
                              : (
                                  <span className="relative z-1 truncate">
                                    <span className="group-hover/team-button:hidden">{button.label}</span>
                                    <span className="hidden text-foreground group-hover/team-button:inline">{button.label}</span>
                                  </span>
                                )}
                            {(toneStyles.backgroundClassName || toneStyles.backgroundStyle)
                              ? (
                                  <span
                                    className={cn(
                                      `
                                        absolute inset-0 z-0 rounded-sm opacity-20 transition-opacity
                                        group-hover/team-button:opacity-40
                                        dark:opacity-30
                                        dark:group-hover/team-button:opacity-50
                                      `,
                                      toneStyles.backgroundClassName,
                                    )}
                                    style={toneStyles.backgroundStyle}
                                  />
                                )
                              : null}
                          </IntentPrefetchLink>
                        )
                      })}
                  </div>
                )}
          </div>
        </div>

        <div className="relative flex w-full items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto whitespace-nowrap">
            <span>
              {formatVolume(event.volume)}
              {' '}
              Vol.
            </span>
            {isResolvedEvent
              ? (
                  sportsCompetitionLabel
                    ? (
                        <>
                          <span className="opacity-50">·</span>
                          <span>{sportsCompetitionLabel}</span>
                        </>
                      )
                    : null
                )
              : (
                  <>
                    {sportsCompetitionLabel
                      ? (
                          <>
                            <span className="opacity-50">·</span>
                            <span>{sportsCompetitionLabel}</span>
                          </>
                        )
                      : null}
                    {startTimeLabel
                      ? (
                          <>
                            <span className="opacity-50">·</span>
                            <span>{startTimeLabel}</span>
                          </>
                        )
                      : null}
                  </>
                )}
          </div>

          {isResolvedEvent
            ? (endedLabel
                ? <span className="shrink-0">{endedLabel}</span>
                : null)
            : (
                <div className="shrink-0">
                  <EventBookmark event={event} refreshStatusOnMount={false} />
                </div>
              )}
        </div>
      </CardContent>
    </Card>
  )
}
