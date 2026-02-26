'use client'

import { useEffect, useMemo, useState } from 'react'
import { formatCompactCount } from '@/lib/formatters'

interface EventTweetMarketsPanelProps {
  tweetCount: number | null
  countdownTargetMs: number | null
}

interface CountdownUnit {
  label: 'DAYS' | 'HRS' | 'MIN' | 'SEG'
  value: string
}

function padTwoDigits(value: number) {
  return String(Math.max(0, value)).padStart(2, '0')
}

function buildCountdownUnits(countdownTargetMs: number | null, nowMs: number): CountdownUnit[] {
  if (countdownTargetMs == null || !Number.isFinite(countdownTargetMs)) {
    return [
      { label: 'DAYS', value: '--' },
      { label: 'HRS', value: '--' },
      { label: 'MIN', value: '--' },
      { label: 'SEG', value: '--' },
    ]
  }

  const totalSeconds = Math.max(0, Math.floor((countdownTargetMs - nowMs) / 1000))
  const days = Math.floor(totalSeconds / (24 * 60 * 60))
  const hours = Math.floor((totalSeconds % (24 * 60 * 60)) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return [
    { label: 'DAYS', value: String(days) },
    { label: 'HRS', value: padTwoDigits(hours) },
    { label: 'MIN', value: padTwoDigits(minutes) },
    { label: 'SEG', value: padTwoDigits(seconds) },
  ]
}

export default function EventTweetMarketsPanel({
  tweetCount,
  countdownTargetMs,
}: EventTweetMarketsPanelProps) {
  const [nowMs, setNowMs] = useState(0)

  useEffect(() => {
    if (countdownTargetMs == null || !Number.isFinite(countdownTargetMs)) {
      return
    }

    setNowMs(Date.now())

    const interval = window.setInterval(() => {
      setNowMs(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(interval)
    }
  }, [countdownTargetMs])

  const countdownUnits = useMemo(
    () => buildCountdownUnits(countdownTargetMs, nowMs),
    [countdownTargetMs, nowMs],
  )
  const tweetCountLabel = typeof tweetCount === 'number' && Number.isFinite(tweetCount)
    ? formatCompactCount(tweetCount)
    : '--'

  return (
    <div className={`
      w-full rounded-xl border border-border bg-background px-4 py-3 transition-transform duration-200
      hover:scale-[1.01]
      sm:px-5 sm:py-4
    `}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid gap-2">
          <a
            href="https://xtracker.polymarket.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex w-fit items-center gap-2 text-red-500"
          >
            <span className="relative inline-flex size-2.5 items-center justify-center">
              <span className="absolute inset-0 m-auto inline-flex size-2.5 animate-ping rounded-full bg-red-500/45" />
              <span className="relative inline-flex size-2 rounded-full bg-red-500" />
            </span>
            <span className={`
              text-xs font-semibold tracking-[0.12em] uppercase
              group-hover:underline group-hover:decoration-red-500 group-hover:underline-offset-3
            `}
            >
              TWEET COUNT
            </span>
          </a>

          <div className="text-2xl leading-none font-semibold text-foreground tabular-nums sm:text-[1.8rem]">
            {tweetCountLabel}
          </div>
        </div>

        <div className="flex items-center gap-4 self-end sm:self-auto">
          <span className="text-sm font-medium text-muted-foreground">Time left</span>
          <div className="grid grid-cols-4 gap-3 text-center sm:gap-4">
            {countdownUnits.map(unit => (
              <div key={unit.label} className="min-w-10">
                <div className="text-lg leading-none font-semibold text-foreground tabular-nums sm:text-xl">
                  {unit.value}
                </div>
                <div className="mt-1 text-2xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                  {unit.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
