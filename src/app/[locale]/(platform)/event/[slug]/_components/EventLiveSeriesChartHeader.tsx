'use client'

import type { CountdownUnit } from '../_utils/eventLiveSeriesChartUtils'
import { ChevronRightIcon, TriangleIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { AnimatedCounter } from 'react-animated-counter'
import AppLink from '@/components/AppLink'
import SiteLogoIcon from '@/components/SiteLogoIcon'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { countdownLabel, formatUsd } from '../_utils/eventLiveSeriesChartUtils'

interface Watermark {
  iconSvg: string | null
  iconImageUrl: string | null
  label: string
}

function LiveIndicator({ pingOpacity = 0.45 }: { pingOpacity?: number }) {
  return (
    <span
      aria-hidden
      className="relative inline-flex size-2.5 items-center justify-center"
    >
      <span
        className="absolute inset-0 m-auto inline-flex size-2.5 animate-ping rounded-full bg-red-500"
        style={{ opacity: pingOpacity }}
      />
      <span className="relative inline-flex size-2 rounded-full bg-red-500" />
    </span>
  )
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
  liveMarketHref: string | null
  isMobile: boolean
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

function AnimatedScoreValue({
  value,
  decimalPrecision = 0,
  padToTwoDigits = false,
}: {
  value: number
  decimalPrecision?: number
  padToTwoDigits?: boolean
}) {
  const safeValue = Math.max(0, value)
  const shouldPad = padToTwoDigits && safeValue < 10

  return (
    <span className="inline-flex items-baseline leading-none tabular-nums">
      {shouldPad && <span>0</span>}
      <AnimatedCounter
        value={safeValue}
        color="currentColor"
        fontSize="1em"
        includeCommas
        includeDecimals={decimalPrecision > 0}
        decimalPrecision={decimalPrecision}
        incrementColor="currentColor"
        decrementColor="currentColor"
        digitStyles={{
          fontWeight: 600,
          lineHeight: '1',
        }}
        containerStyles={{
          display: 'inline-flex',
          alignItems: 'baseline',
          flexDirection: 'row-reverse',
          lineHeight: '1',
        }}
      />
    </span>
  )
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
  liveMarketHref,
  isMobile,
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
  const t = useExtracted()
  const liveMarketLabel = isMobile ? t('Live') : t('Go to live market')
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
  const priceStatusLabel = isEventClosed ? 'Final price' : 'Current price'

  return (
    <div
      className={cn(
        'flex items-end pr-3 pl-0 sm:pr-6 sm:pl-0',
        liveMarketHref
          ? 'flex-nowrap gap-1 sm:flex-wrap sm:gap-4'
          : shouldShowCountdown
            ? 'flex-nowrap gap-1 min-[360px]:gap-2 sm:flex-wrap sm:gap-4'
            : 'flex-wrap gap-4',
      )}
    >
      <div
        className={cn(
          'flex items-end',
          liveMarketHref
            ? 'min-w-0 flex-nowrap gap-1 min-[360px]:gap-2 sm:gap-5'
            : shouldShowCountdown
              ? 'min-w-0 flex-nowrap gap-1 min-[360px]:gap-3 sm:gap-5'
              : 'flex-wrap gap-5',
        )}
      >
        <div>
          <div
            className="text-xs font-semibold whitespace-nowrap text-muted-foreground"
          >
            Price To Beat
          </div>
          <div
            className={cn(
              `
                mt-1 text-[16px] leading-none font-semibold whitespace-nowrap text-muted-foreground tabular-nums
                sm:text-[22px]
              `,
              liveMarketHref ? 'min-[360px]:text-[20px]' : 'min-[360px]:text-[18px]',
            )}
          >
            {resolvedBaselinePrice != null ? formatUsd(resolvedBaselinePrice, headerPriceDisplayDigits) : '--'}
          </div>
        </div>
        <div className={cn('h-10 w-px bg-border', liveMarketHref ? 'block' : 'hidden sm:block')} />
        <div>
          <div
            className="flex items-center gap-0.5 text-xs font-semibold whitespace-nowrap min-[360px]:gap-1 sm:gap-2"
            style={{ color: liveColor }}
          >
            <span>{priceStatusLabel}</span>
            {delta != null && (
              <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${delta >= 0
                ? 'text-yes'
                : 'text-no'}`}
              >
                <TriangleIcon
                  className={`size-1.5 min-[360px]:size-2 sm:size-2.5 ${delta >= 0 ? '' : 'rotate-180'}`}
                  fill="currentColor"
                  stroke="none"
                />
                {formatUsd(Math.abs(delta), deltaDisplayDigits)}
              </span>
            )}
          </div>
          <div
            className={cn(
              `
                mt-1 inline-flex items-baseline text-[16px] leading-none font-semibold whitespace-nowrap tabular-nums
                sm:text-[22px]
              `,
              liveMarketHref ? 'min-[360px]:text-[20px]' : 'min-[360px]:text-[18px]',
            )}
            style={{ color: liveColor }}
          >
            {currentPrice != null
              ? (
                  <>
                    <span>$</span>
                    <AnimatedScoreValue value={currentPrice} decimalPrecision={headerPriceDisplayDigits} />
                  </>
                )
              : '--'}
          </div>
        </div>
      </div>
      {shouldShowCountdown
        ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="mr-[-4px] ml-auto grid shrink-0 justify-items-end gap-1 text-left sm:mr-[-6px]"
                >
                  <div className="flex items-end gap-0.5 min-[360px]:gap-1 sm:gap-3">
                    {visibleCountdownUnits.map(({ unit, value }) => (
                      <div key={unit} className="min-w-6 text-right min-[360px]:min-w-8 sm:min-w-11">
                        <div
                          className={cn(
                            'text-[16px] leading-none font-semibold tabular-nums min-[360px]:text-[18px] sm:text-[22px]',
                            isTradingWindowActive ? 'text-red-500' : 'text-muted-foreground',
                          )}
                        >
                          <AnimatedScoreValue value={Math.floor(value)} padToTwoDigits />
                        </div>
                        <div
                          className="
                            mt-1 text-[8px] font-semibold tracking-[0.08em] text-muted-foreground uppercase
                            min-[360px]:text-[9px]
                            sm:text-2xs
                          "
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
                      <LiveIndicator />
                      <span className="text-xs font-semibold tracking-[0.08em] uppercase">{t('Live')}</span>
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
        : liveMarketHref
          ? (
              <Button
                asChild
                size={isMobile ? 'sm' : 'default'}
                variant="outline"
                className={cn(
                  'shrink-0 rounded-full font-semibold shadow-none',
                  isMobile
                    ? 'mr-[-4px] ml-auto gap-1 text-xs'
                    : 'ml-auto has-[>svg]:px-3.5',
                )}
              >
                <AppLink intentPrefetch href={liveMarketHref}>
                  <LiveIndicator pingOpacity={0.4} />
                  <span>{liveMarketLabel}</span>
                  <ChevronRightIcon className={isMobile ? 'size-3.5' : 'size-4'} />
                </AppLink>
              </Button>
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
