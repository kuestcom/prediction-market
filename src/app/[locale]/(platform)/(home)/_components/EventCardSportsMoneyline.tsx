'use client'

import type { CSSProperties } from 'react'
import type { HomeSportsMoneylineButton, HomeSportsMoneylineModel } from '@/lib/sports-home-card'
import type { Event } from '@/types'
import { CheckIcon } from 'lucide-react'
import Image from 'next/image'
import EventBookmark from '@/app/[locale]/(platform)/event/[slug]/_components/EventBookmark'
import AppLink from '@/components/AppLink'
import { Card, CardContent } from '@/components/ui/card'
import { NewBadge } from '@/components/ui/new-badge'
import { ensureReadableTextColorOnDark } from '@/lib/color-contrast'
import { shouldShowEventNewBadge } from '@/lib/event-new-badge'
import { resolveEventOutcomePath } from '@/lib/events-routing'
import { formatDate, formatVolume } from '@/lib/formatters'
import { isEventResolvedLike } from '@/lib/home-events'
import { resolveHomeSportsButtonChance, resolveResolvedHomeSportsMoneylineWinner } from '@/lib/sports-home-card'
import { parseSportsScore } from '@/lib/sports-resolution'
import { resolveSportsTeamFallbackClassName } from '@/lib/sports-team-colors'
import { cn } from '@/lib/utils'

export interface EventCardSportsMoneylineProps {
  event: Event
  model: HomeSportsMoneylineModel
  getDisplayChance: (marketId: string) => number
  currentTimestamp?: number | null
}

const HOME_OUTCOME_BUTTON_HEIGHT_CLASS = 'h-[40px]'
const HOME_SPORTS_BUTTON_DARK_TEXT_VAR = '--home-sports-button-dark-text'
const SPORTS_EVENT_TIME_ZONE = 'America/New_York'
const SPORTS_EVENT_TIME_ZONE_LABEL = 'ET'
const SPORTS_EVENT_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: SPORTS_EVENT_TIME_ZONE,
})
const SPORTS_EVENT_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: SPORTS_EVENT_TIME_ZONE,
})
const SPORTS_EVENT_WEEKDAY_FORMATTER = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  timeZone: SPORTS_EVENT_TIME_ZONE,
})
const SPORTS_EVENT_DATE_PARTS_FORMATTER = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  timeZone: SPORTS_EVENT_TIME_ZONE,
})

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

function getSportsEventDayNumber(date: Date) {
  const parts = SPORTS_EVENT_DATE_PARTS_FORMATTER.formatToParts(date)
  const year = Number(parts.find(part => part.type === 'year')?.value)
  const month = Number(parts.find(part => part.type === 'month')?.value)
  const day = Number(parts.find(part => part.type === 'day')?.value)

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null
  }

  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000)
}

function formatSportsStartTime(value: string | null | undefined, currentTimestamp?: number | null) {
  if (!value) {
    return null
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  const timeLabel = `${SPORTS_EVENT_TIME_FORMATTER.format(parsed)} ${SPORTS_EVENT_TIME_ZONE_LABEL}`

  if (currentTimestamp == null) {
    const dateLabel = SPORTS_EVENT_DATE_FORMATTER.format(parsed)
    return `${dateLabel} ${timeLabel}`
  }

  const now = new Date(currentTimestamp)
  const todayDayNumber = getSportsEventDayNumber(now)
  const targetDayNumber = getSportsEventDayNumber(parsed)

  if (todayDayNumber == null || targetDayNumber == null) {
    return timeLabel
  }

  const dayDiff = targetDayNumber - todayDayNumber

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
    const weekdayLabel = SPORTS_EVENT_WEEKDAY_FORMATTER.format(parsed)
    return `${weekdayLabel} ${timeLabel}`
  }

  const dateLabel = SPORTS_EVENT_DATE_FORMATTER.format(parsed)
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
      className: `
        ${HOME_OUTCOME_BUTTON_HEIGHT_CLASS}
        flex-1 rounded-sm px-2 text-xs/snug font-semibold text-foreground
        hover:text-primary-foreground
      `,
      style: undefined,
      backgroundClassName: resolveSportsTeamFallbackClassName(button.tone),
      backgroundStyle: undefined,
    }
  }

  const darkTextColor = ensureReadableTextColorOnDark(button.color)

  return {
    className: `
      ${HOME_OUTCOME_BUTTON_HEIGHT_CLASS} flex-1 rounded-sm px-2 text-xs/snug font-semibold
      hover:!text-white dark:!text-[var(--home-sports-button-dark-text)]
      dark:hover:!text-white
    `,
    style: {
      color: button.color,
      [HOME_SPORTS_BUTTON_DARK_TEXT_VAR]: darkTextColor ?? button.color,
    } as CSSProperties,
    backgroundClassName: undefined,
    backgroundStyle: button.color ? { backgroundColor: button.color } : undefined,
  }
}

function resolveButtonDisplayLabel(model: HomeSportsMoneylineModel, button: HomeSportsMoneylineButton) {
  if (button.tone === 'team1') {
    return model.team1.name
  }

  if (button.tone === 'team2') {
    return model.team2.name
  }

  return button.label
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
  const isResolvedEvent = isEventResolvedLike(event)
  const sportsCompetitionLabel = resolveSportsCompetitionLabel(event)
  const startTimeLabel = formatSportsStartTime(event.sports_start_time ?? event.start_date, currentTimestamp)
  const shouldShowNewBadge = shouldShowEventNewBadge(event, currentTimestamp ?? null)
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
  const showLiveScore = !isResolvedEvent && event.sports_live === true
  const parsedLiveScore = showLiveScore ? parseSportsScore(event.sports_score) : null
  const team1Score = parsedLiveScore?.team1 ?? null
  const team2Score = parsedLiveScore?.team2 ?? null

  return (
    <Card
      className={cn(`
        group relative flex h-45 cursor-pointer flex-col overflow-hidden rounded-xl shadow-md shadow-black/4
        transition-all
        hover:-translate-y-0.5 hover:shadow-black/8
        dark:hover:bg-secondary
      `)}
    >
      <CardContent
        className={cn(`
          flex h-full flex-col px-3 pt-3
          ${isResolvedEvent ? 'pb-3' : 'pb-3 md:pb-1'}
        `)}
      >
        <div className="flex w-full flex-col gap-0.5">
          <AppLink
            intentPrefetch
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
              {team1Score !== null && (
                <>
                  <span
                    aria-label={`${model.team1.name} score ${team1Score}`}
                    className="shrink-0 text-sm font-medium text-foreground tabular-nums"
                  >
                    {team1Score}
                  </span>
                  <span className="h-4 w-px shrink-0 bg-border" aria-hidden="true" />
                </>
              )}
              <p className="truncate text-sm font-medium decoration-2 group-hover/team-row-1:underline">
                {model.team1.name}
              </p>
            </div>
            <p className="shrink-0 text-lg font-semibold">
              {team1Chance}
              %
            </p>
          </AppLink>
          <AppLink
            intentPrefetch
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
              {team2Score !== null && (
                <>
                  <span
                    aria-label={`${model.team2.name} score ${team2Score}`}
                    className="shrink-0 text-sm font-medium text-foreground tabular-nums"
                  >
                    {team2Score}
                  </span>
                  <span className="h-4 w-px shrink-0 bg-border" aria-hidden="true" />
                </>
              )}
              <p className="truncate text-sm font-medium decoration-2 group-hover/team-row-2:underline">
                {model.team2.name}
              </p>
            </div>
            <p className="shrink-0 text-lg font-semibold">
              {team2Chance}
              %
            </p>
          </AppLink>
        </div>

        <div className="flex flex-1 flex-col">
          <div className={cn(isResolvedEvent ? 'mt-auto mb-3' : 'mt-auto mb-2')}>
            {isResolvedEvent && resolvedWinner
              ? (
                  <div className={cn(`
                    flex h-12 w-full cursor-default items-center justify-center gap-2 rounded-md border px-3 text-sm
                    font-semibold text-foreground transition-colors
                    dark:border-none dark:bg-secondary
                    dark:group-hover:bg-card
                  `)}
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
                        const displayLabel = resolveButtonDisplayLabel(model, button)

                        return (
                          <AppLink
                            intentPrefetch
                            key={`${button.conditionId}:${button.outcomeIndex}`}
                            href={resolveButtonHref(button)}
                            className={cn(
                              `
                                relative inline-flex items-center justify-center overflow-hidden transition duration-150
                                active:scale-[97%]
                              `,
                              button.tone === 'draw'
                                ? 'hover:bg-foreground/10 hover:text-foreground dark:hover:bg-background/70'
                                : 'group/team-button hover:bg-transparent',
                              toneStyles.className,
                            )}
                            style={toneStyles.style}
                          >
                            {button.tone === 'draw'
                              ? <span className="relative z-1">{displayLabel}</span>
                              : (
                                  <span className="relative z-1 line-clamp-2 max-w-full text-center">
                                    {displayLabel}
                                  </span>
                                )}
                            {(toneStyles.backgroundClassName || toneStyles.backgroundStyle)
                              ? (
                                  <span
                                    className={cn(
                                      `
                                        absolute inset-0 z-0 rounded-sm opacity-[0.15] transition-opacity
                                        group-hover/team-button:opacity-100
                                      `,
                                      toneStyles.backgroundClassName,
                                    )}
                                    style={toneStyles.backgroundStyle}
                                  />
                                )
                              : null}
                          </AppLink>
                        )
                      })}
                  </div>
                )}
          </div>
        </div>

        <div className="relative flex w-full items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto whitespace-nowrap">
            {shouldShowNewBadge
              ? <NewBadge />
              : (
                  <span>
                    {formatVolume(event.volume)}
                    {' '}
                    Vol.
                  </span>
                )}
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
