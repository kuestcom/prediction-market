'use client'

import type { HomeSportsMoneylineButton, HomeSportsMoneylineModel } from '@/lib/sports-home-card'
import type { Event } from '@/types'
import Image from 'next/image'
import EventBookmark from '@/app/[locale]/(platform)/event/[slug]/_components/EventBookmark'
import { Link } from '@/i18n/navigation'
import { ensureReadableTextColorOnDark } from '@/lib/color-contrast'
import { resolveEventPagePath } from '@/lib/events-routing'
import { formatVolume } from '@/lib/formatters'
import { cn } from '@/lib/utils'

interface EventCardSportsMoneylineProps {
  event: Event
  model: HomeSportsMoneylineModel
  getDisplayChance: (marketId: string) => number
}

const HOME_OUTCOME_BUTTON_HEIGHT_CLASS = 'h-[40px]'

function formatSportsStartTime(value: string | null | undefined) {
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

  const now = new Date()
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

  const textColor = ensureReadableTextColorOnDark(button.color)

  return {
    className: `${HOME_OUTCOME_BUTTON_HEIGHT_CLASS} flex-1 rounded-sm px-2 text-sm font-semibold`,
    style: textColor ? { color: textColor } : undefined,
    backgroundStyle: button.color ? { backgroundColor: button.color } : undefined,
  }
}

export default function EventCardSportsMoneyline({
  event,
  model,
  getDisplayChance,
}: EventCardSportsMoneylineProps) {
  const eventHref = resolveEventPagePath(event)
  const isResolvedEvent = event.status === 'resolved'
  const sportsTagLabel = event.sports_sport_slug?.trim()?.toUpperCase() || null
  const startTimeLabel = formatSportsStartTime(event.sports_start_time ?? event.start_date)
  const team1Chance = Math.round(getDisplayChance(model.team1Button.conditionId))
  const team2Chance = Math.round(getDisplayChance(model.team2Button.conditionId))

  return (
    <div
      className={`
        group relative flex h-45 cursor-pointer flex-col justify-between overflow-hidden rounded-xl border bg-card px-3
        pt-3 shadow-md shadow-black/4 transition-all
        hover:-translate-y-0.5 hover:shadow-black/8
        dark:hover:bg-secondary
      `}
    >
      <Link href={eventHref} className="flex w-full flex-col gap-1">
        <div className="group/team-row-1 flex h-9 items-center justify-between gap-2">
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
        </div>
        <div className="group/team-row-2 flex h-9 items-center justify-between gap-2">
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
        </div>
      </Link>

      <div className="mt-2 flex flex-col justify-end gap-1.5 pb-2">
        <div className="flex h-fit items-center justify-center gap-2">
          {[model.team1Button, model.drawButton, model.team2Button]
            .filter((button): button is HomeSportsMoneylineButton => Boolean(button))
            .map((button) => {
              const toneStyles = getButtonToneStyles(button)

              return (
                <Link
                  key={`${button.conditionId}:${button.outcomeIndex}`}
                  href={eventHref}
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
                  {toneStyles.backgroundStyle
                    ? (
                        <span
                          className={`
                            absolute inset-0 z-0 rounded-sm opacity-20 transition-opacity
                            group-hover/team-button:opacity-40
                            dark:opacity-30
                            dark:group-hover/team-button:opacity-50
                          `}
                          style={toneStyles.backgroundStyle}
                        />
                      )
                    : null}
                </Link>
              )
            })}
        </div>

        <div className="relative flex w-full items-center justify-between text-xs text-muted-foreground">
          <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto whitespace-nowrap">
            <span>
              {formatVolume(event.volume)}
              {' '}
              Vol.
            </span>
            {sportsTagLabel
              ? (
                  <>
                    <span className="opacity-50">·</span>
                    <span>{sportsTagLabel}</span>
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
          </div>

          {!isResolvedEvent && (
            <div className="shrink-0">
              <EventBookmark event={event} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
