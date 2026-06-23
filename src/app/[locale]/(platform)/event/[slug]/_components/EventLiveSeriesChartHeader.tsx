'use client'

import type { CountdownUnit } from '../_utils/eventLiveSeriesChartUtils'
import { TriangleIcon } from 'lucide-react'
import SiteLogoIcon from '@/components/SiteLogoIcon'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { countdownLabel, formatUsd } from '../_utils/eventLiveSeriesChartUtils'
import AnimatedCountdownValue from './AnimatedCountdownValue'

interface Watermark {
  iconSvg: string | null
  iconImageUrl: string | null
  label: string
}

interface EventLiveSeriesChartHeaderProps {
  resolvedBaselinePrice: number | null
  headerPriceDisplayDigits: number
  currentPrice: number | null
  delta: number | null
  deltaDisplayDigits: number
  liveColor: string
  shouldShowCountdown: boolean
  isEventClosed: boolean
  isTradingWindowActive: boolean
  visibleCountdownUnits: Array<{ unit: CountdownUnit, value: number }>
  countdownLeftLabel: string
  etDateLabel: string
  etTimeLabel: string
  utcDateLabel: string
  utcTimeLabel: string
  status: 'connecting' | 'live' | 'offline'
  watermark: Watermark
}

export default function EventLiveSeriesChartHeader({
  resolvedBaselinePrice,
  headerPriceDisplayDigits,
  currentPrice,
  delta,
  deltaDisplayDigits,
  liveColor,
  shouldShowCountdown,
  isEventClosed,
  isTradingWindowActive,
  visibleCountdownUnits,
  countdownLeftLabel,
  etDateLabel,
  etTimeLabel,
  utcDateLabel,
  utcTimeLabel,
  status,
  watermark,
}: EventLiveSeriesChartHeaderProps) {
  const countdownEndedLogo = (watermark.iconSvg || watermark.iconImageUrl || watermark.label)
    ? (
        <div
          className="pointer-events-none flex items-center gap-1 text-xl text-muted-foreground opacity-50 select-none"
          aria-hidden
        >
          {(watermark.iconSvg || watermark.iconImageUrl)
            ? (
                <SiteLogoIcon
                  logoSvg={watermark.iconSvg ?? ''}
                  logoImageUrl={watermark.iconImageUrl}
                  alt={`${watermark.label} logo`}
                  className="size-[1em] **:fill-current **:stroke-current"
                  imageClassName="size-[1em] object-contain"
                  size={20}
                />
              )
            : null}
          {watermark.label
            ? (
                <span className="font-semibold">
                  {watermark.label}
                </span>
              )
            : null}
        </div>
      )
    : null
  const priceStatusLabel = isEventClosed ? 'Final Price' : 'Current Price'

  return (
    <div className="flex flex-wrap items-end gap-4 pr-4 pl-0 sm:pr-6 sm:pl-0">
      <div className="flex flex-wrap items-end gap-5">
        <div>
          <div className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            Price To Beat
          </div>
          <div className="mt-1 text-[22px] leading-none font-semibold text-muted-foreground tabular-nums">
            {resolvedBaselinePrice != null ? formatUsd(resolvedBaselinePrice, headerPriceDisplayDigits) : '--'}
          </div>
        </div>
        <div className="hidden h-10 w-px bg-border sm:block" />
        <div>
          <div
            className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] uppercase"
            style={{ color: liveColor }}
          >
            <span>{priceStatusLabel}</span>
            {delta != null && (
              <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${delta >= 0
                ? 'text-yes'
                : 'text-no'}`}
              >
                <TriangleIcon
                  className={`size-2.5 ${delta >= 0 ? '' : 'rotate-180'}`}
                  fill="currentColor"
                  stroke="none"
                />
                {formatUsd(Math.abs(delta), deltaDisplayDigits)}
              </span>
            )}
          </div>
          <div
            className="mt-1 text-[22px] leading-none font-semibold tabular-nums"
            style={{ color: liveColor }}
          >
            {currentPrice != null ? formatUsd(currentPrice, headerPriceDisplayDigits) : '--'}
          </div>
        </div>
      </div>
      {shouldShowCountdown
        ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="mr-[-4px] ml-auto grid justify-items-end gap-1 text-left sm:mr-[-6px]"
                >
                  <div className="flex items-end gap-3">
                    {visibleCountdownUnits.map(({ unit, value }) => (
                      <div key={unit} className="min-w-11 text-right">
                        <div
                          className={cn(
                            'text-[22px] leading-none font-semibold tabular-nums',
                            isTradingWindowActive ? 'text-red-500' : 'text-muted-foreground',
                          )}
                        >
                          <AnimatedCountdownValue value={value} />
                        </div>
                        <div
                          className="mt-1 text-2xs font-semibold tracking-[0.08em] text-muted-foreground uppercase"
                        >
                          {countdownLabel(unit, value)}
                        </div>
                      </div>
                    ))}
                  </div>
                  <span className="sr-only">{status}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent align="end" className="w-72 rounded-xl p-3 text-left">
                <div className="grid gap-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="inline-flex items-center gap-2 text-red-500">
                      <span className="relative inline-flex size-2.5 items-center justify-center">
                        <span
                          className={cn(`
                            absolute inset-0 m-auto inline-flex size-2.5 animate-ping rounded-full bg-red-500/45
                          `)}
                        />
                        <span
                          className="relative inline-flex size-2 rounded-full bg-red-500"
                        />
                      </span>
                      <span className="text-xs font-semibold tracking-[0.08em] uppercase">Live</span>
                    </div>
                    <div className="text-sm">
                      <span className="font-semibold text-foreground">{countdownLeftLabel}</span>
                      <span className="ml-1 text-muted-foreground">left</span>
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground">Resolution time</div>

                  <div className="grid gap-2 text-sm text-foreground">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(`
                          inline-flex h-6 min-w-9 items-center justify-center rounded-md bg-muted px-2 text-xs
                          font-semibold
                        `)}
                      >
                        ET
                      </span>
                      <span className="tabular-nums">{etDateLabel}</span>
                      <span className="ml-auto tabular-nums">{etTimeLabel}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(`
                          inline-flex h-6 min-w-9 items-center justify-center rounded-md bg-muted px-2 text-xs
                          font-semibold
                        `)}
                      >
                        UTC
                      </span>
                      <span className="tabular-nums">{utcDateLabel}</span>
                      <span className="ml-auto tabular-nums">{utcTimeLabel}</span>
                    </div>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          )
        : isEventClosed
          ? (
              <div className="mr-[-4px] ml-auto sm:mr-[-6px]">
                {countdownEndedLogo}
              </div>
            )
          : null}
    </div>
  )
}
