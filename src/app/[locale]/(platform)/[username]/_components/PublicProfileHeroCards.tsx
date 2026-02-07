'use client'

import type { MouseEvent as ReactMouseEvent, ReactNode, TouchEvent as ReactTouchEvent } from 'react'
import type { ProfileForCards } from '@/app/[locale]/(platform)/_components/ProfileOverviewCard'
import type { PortfolioSnapshot } from '@/lib/portfolio'
import { curveMonotoneX } from '@visx/curve'
import { localPoint } from '@visx/event'
import { Group } from '@visx/group'
import { scaleLinear, scaleTime } from '@visx/scale'
import { AreaClosed, LinePath } from '@visx/shape'
import { CircleHelpIcon, MinusIcon, TriangleIcon } from 'lucide-react'
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import ProfileOverviewCard from '@/app/[locale]/(platform)/_components/ProfileOverviewCard'
import SiteLogoIcon from '@/components/SiteLogoIcon'
import { Card, CardContent } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useSiteIdentity } from '@/hooks/useSiteIdentity'
import { formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'

interface PnlPoint {
  date: Date
  value: number
}

const PNL_TIMEFRAMES = ['1D', '1W', '1M', 'ALL'] as const

interface PublicProfileHeroCardsProps {
  profile: ProfileForCards
  snapshot: PortfolioSnapshot
  actions?: ReactNode
  variant?: 'public' | 'portfolio'
}

function ProfitLossCard({
  snapshot: _snapshot,
  portfolioAddress,
}: {
  snapshot: PortfolioSnapshot
  portfolioAddress?: string | null
}) {
  const site = useSiteIdentity()
  const platformName = site.name ?? ''
  const [activeTimeframe, setActiveTimeframe] = useState<(typeof PNL_TIMEFRAMES)[number]>('ALL')
  const [cursorX, setCursorX] = useState<number | null>(null)
  const [pnlSeries, setPnlSeries] = useState<PnlPoint[]>([])
  const timeRangeContainerRef = useRef<HTMLDivElement | null>(null)
  const timeRangeRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [timeRangeIndicator, setTimeRangeIndicator] = useState({ width: 0, left: 0 })
  const [timeRangeIndicatorReady, setTimeRangeIndicatorReady] = useState(false)
  const chartId = useId().replace(/:/g, '')
  const lineGradientId = `${chartId}-line`
  const areaGradientId = `${chartId}-area`
  const areaFadeId = `${chartId}-fade`
  const areaMaskId = `${chartId}-mask`
  const logoSvg = site.logoSvg
    .replace(/fill="url\([^"]+\)"/gi, 'fill="currentColor"')
  const pnlAddress = portfolioAddress
  const pnlBaseUrl = process.env.USER_PNL_URL!

  useEffect(() => {
    if (!pnlAddress || !pnlBaseUrl) {
      setPnlSeries([])
      return
    }

    const controller = new AbortController()
    const timeframeConfig = {
      '1D': { interval: '1d', fidelity: '1h' },
      '1W': { interval: '1w', fidelity: '3h' },
      '1M': { interval: '1m', fidelity: '18h' },
      'ALL': { interval: 'all', fidelity: '12h' },
    } as const
    const { interval, fidelity } = timeframeConfig[activeTimeframe] ?? timeframeConfig.ALL
    const params = new URLSearchParams({
      user_address: pnlAddress,
      interval,
      fidelity,
    })
    const endpoint = new URL('/user-pnl', pnlBaseUrl)

    fetch(`${endpoint.toString()}?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`PNL request failed: ${response.status}`)
        }
        return await response.json()
      })
      .then((data) => {
        if (!Array.isArray(data)) {
          setPnlSeries([])
          return
        }

        const normalized = data
          .map((point: { t?: number, p?: number }) => ({
            date: typeof point.t === 'number' ? new Date(point.t * 1000) : null,
            value: typeof point.p === 'number' ? point.p : null,
          }))
          .filter(point => point.date && Number.isFinite(point.value))
          .map(point => ({ date: point.date as Date, value: point.value as number }))
          .sort((a, b) => a.date.getTime() - b.date.getTime())

        if (normalized.length === 0) {
          setPnlSeries([])
          return
        }

        const base = normalized[0].value
        const rebased = normalized.map(point => ({
          ...point,
          value: point.value - base,
        }))

        setPnlSeries(rebased)
      })
      .catch((error) => {
        if (error?.name !== 'AbortError') {
          setPnlSeries([])
        }
      })

    return () => controller.abort()
  }, [activeTimeframe, pnlAddress, pnlBaseUrl])

  const updateIndicator = useCallback(() => {
    const activeIndex = PNL_TIMEFRAMES.findIndex(range => range === activeTimeframe)
    const activeButton = timeRangeRefs.current[activeIndex]
    const container = timeRangeContainerRef.current
    if (!activeButton || !container) {
      return
    }

    const { offsetLeft, offsetWidth } = activeButton
    queueMicrotask(() => {
      setTimeRangeIndicator({ left: offsetLeft, width: offsetWidth })
      setTimeRangeIndicatorReady(true)
    })
  }, [activeTimeframe])

  useLayoutEffect(() => {
    updateIndicator()
  }, [updateIndicator])

  useEffect(() => {
    updateIndicator()
    window.addEventListener('resize', updateIndicator)
    return () => window.removeEventListener('resize', updateIndicator)
  }, [updateIndicator])

  const fallbackRange = useMemo(() => ({ startValue: 0, endValue: 0 }), [])
  const fallbackDurationMs = useMemo(() => {
    const ranges = {
      '1D': 1000 * 60 * 60 * 24,
      '1W': 1000 * 60 * 60 * 24 * 7,
      '1M': 1000 * 60 * 60 * 24 * 30,
      'ALL': 1000 * 60 * 60 * 24 * 365,
    }
    return ranges[activeTimeframe] ?? ranges.ALL
  }, [activeTimeframe])
  const fallbackEndDate = useMemo(() => new Date(), [])
  const fallbackStartDate = useMemo(
    () => new Date(fallbackEndDate.getTime() - fallbackDurationMs),
    [fallbackDurationMs, fallbackEndDate],
  )
  const fallbackData = useMemo(() => {
    const points = 24
    return Array.from({ length: points }, (_, index) => {
      const t = points <= 1 ? 0 : index / (points - 1)
      return {
        date: new Date(fallbackStartDate.getTime() + (fallbackEndDate.getTime() - fallbackStartDate.getTime()) * t),
        value: fallbackRange.startValue + (fallbackRange.endValue - fallbackRange.startValue) * t,
      }
    })
  }, [fallbackEndDate, fallbackRange, fallbackStartDate])

  const hasPnlSeries = pnlSeries.length > 0
  const chartData = hasPnlSeries ? pnlSeries : fallbackData
  const startDate = chartData[0]?.date ?? fallbackStartDate
  const endDate = chartData[chartData.length - 1]?.date ?? fallbackEndDate
  const startValue = chartData[0]?.value ?? fallbackRange.startValue
  const endValue = chartData[chartData.length - 1]?.value ?? fallbackRange.endValue

  const chartWidth = 360
  const chartHeight = 80
  const margin = { top: 0, right: 0, bottom: 0, left: 0 }
  const innerWidth = chartWidth - margin.left - margin.right
  const innerHeight = chartHeight - margin.top - margin.bottom
  const linePadding = Math.round(innerHeight * 0.22)
  const lineTop = linePadding
  const lineBottom = innerHeight - linePadding
  const [minValue, maxValue] = useMemo(() => {
    if (!chartData.length) {
      return [0, 0]
    }
    let min = chartData[0].value
    let max = chartData[0].value
    for (const point of chartData) {
      if (point.value < min) {
        min = point.value
      }
      if (point.value > max) {
        max = point.value
      }
    }
    return [min, max]
  }, [chartData])
  const domainPadding = minValue === maxValue ? Math.max(1, Math.abs(minValue || 1)) : 0
  const paddedMin = minValue - domainPadding
  const paddedMax = maxValue + domainPadding

  const xScale = useMemo(
    () => scaleTime<number>({
      range: [0, innerWidth],
      domain: [startDate, endDate],
    }),
    [endDate, innerWidth, startDate],
  )
  const yScale = useMemo(
    () => scaleLinear<number>({
      range: [lineBottom, lineTop],
      domain: [paddedMin, paddedMax],
      nice: false,
    }),
    [lineBottom, lineTop, paddedMax, paddedMin],
  )

  const clampedCursorX = cursorX == null ? null : Math.max(0, Math.min(cursorX, innerWidth))
  const cursorDate = useMemo(
    () => (clampedCursorX == null ? null : xScale.invert(clampedCursorX)),
    [clampedCursorX, xScale],
  )
  const cursorValue = useMemo(() => {
    if (clampedCursorX == null || !chartData.length) {
      return endValue
    }
    if (chartData.length === 1) {
      return chartData[0].value
    }

    const targetTime = cursorDate ? cursorDate.getTime() : endDate.getTime()
    let left = chartData[0]
    let right = chartData[chartData.length - 1]

    for (const point of chartData) {
      if (point.date.getTime() <= targetTime) {
        left = point
      }
      else {
        right = point
        break
      }
    }

    if (left === right) {
      return left.value
    }

    const span = right.date.getTime() - left.date.getTime()
    const ratio = span === 0 ? 0 : (targetTime - left.date.getTime()) / span
    return left.value + (right.value - left.value) * ratio
  }, [chartData, clampedCursorX, cursorDate, endDate, endValue])
  const cursorY = clampedCursorX == null ? null : yScale(cursorValue)
  const cursorDotPosition = useMemo(() => {
    if (clampedCursorX == null || cursorY == null || innerWidth === 0 || innerHeight === 0) {
      return null
    }

    return {
      left: `${(clampedCursorX / innerWidth) * 100}%`,
      top: `${(cursorY / innerHeight) * 100}%`,
    }
  }, [clampedCursorX, cursorY, innerHeight, innerWidth])
  const displayValue = clampedCursorX == null ? endValue : cursorValue
  const deltaValue = displayValue - startValue
  const isDeltaPositive = deltaValue > 0
  const isDeltaNegative = deltaValue < 0
  const [gainTotal, lossTotal] = useMemo(() => {
    if (!chartData.length) {
      return [0, 0]
    }

    const targetTime = (cursorDate ?? endDate).getTime()
    const firstPoint = chartData[0]
    const firstTime = firstPoint.date.getTime()

    if (targetTime < firstTime) {
      return [0, 0]
    }

    let gain = 0
    let loss = 0
    let prevValue = 0
    let prevTime = firstTime

    const initialDelta = firstPoint.value - prevValue
    if (initialDelta >= 0) {
      gain += initialDelta
    }
    else {
      loss += Math.abs(initialDelta)
    }
    prevValue = firstPoint.value

    for (let index = 1; index < chartData.length; index += 1) {
      const point = chartData[index]
      const pointTime = point.date.getTime()

      if (pointTime <= targetTime) {
        const delta = point.value - prevValue
        if (delta >= 0) {
          gain += delta
        }
        else {
          loss += Math.abs(delta)
        }
        prevValue = point.value
        prevTime = pointTime
        continue
      }

      if (targetTime > prevTime) {
        const span = pointTime - prevTime
        const ratio = span === 0 ? 0 : (targetTime - prevTime) / span
        const interpolatedValue = prevValue + (point.value - prevValue) * ratio
        const delta = interpolatedValue - prevValue
        if (delta >= 0) {
          gain += delta
        }
        else {
          loss += Math.abs(delta)
        }
      }
      break
    }

    return [gain, loss]
  }, [chartData, cursorDate, endDate])
  const timeframeLabel = ({
    'ALL': 'All-Time',
    '1D': 'Past Day',
    '1W': 'Past Week',
    '1M': 'Past Month',
  } as const)[activeTimeframe] || 'All-Time'
  const hoverDateLabel = cursorDate
    ? `${cursorDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ${
      cursorDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    }`
    : null

  const handlePointerMove = useCallback((event: ReactTouchEvent<SVGRectElement> | ReactMouseEvent<SVGRectElement>) => {
    const point = localPoint(event)
    if (!point) {
      return
    }
    setCursorX(point.x)
  }, [])

  const handlePointerLeave = useCallback(() => {
    setCursorX(null)
  }, [])

  return (
    <Card className="relative h-full overflow-hidden rounded-lg bg-background">
      <CardContent className="relative flex h-full flex-col gap-2.5 p-3 sm:p-4">
        <div className="flex items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2">
            {isDeltaPositive && <TriangleIcon className="size-4 -translate-y-px fill-yes text-yes" />}
            {isDeltaNegative && <TriangleIcon className="size-4 translate-y-px rotate-180 fill-no text-no" />}
            {!isDeltaPositive && !isDeltaNegative && <MinusIcon className="size-4 text-muted-foreground" />}
            <span className="text-base font-semibold text-foreground">
              Profit/Loss
            </span>
          </div>

          <div
            ref={timeRangeContainerRef}
            className="relative flex items-center justify-start gap-2 text-xs font-semibold"
          >
            <div
              className={cn(
                'absolute inset-y-0 rounded-md bg-muted',
                timeRangeIndicatorReady ? 'opacity-100 transition-all duration-300' : 'opacity-0 transition-none',
              )}
              style={{
                width: `${timeRangeIndicator.width}px`,
                left: `${timeRangeIndicator.left}px`,
              }}
              aria-hidden={!timeRangeIndicatorReady}
            />
            {PNL_TIMEFRAMES.map((timeframe, index) => (
              <button
                key={timeframe}
                ref={(el) => {
                  timeRangeRefs.current[index] = el
                }}
                type="button"
                className={cn(
                  'relative rounded-md px-3 py-2 transition-colors',
                  activeTimeframe === timeframe
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
                )}
                onClick={() => setActiveTimeframe(timeframe)}
              >
                {timeframe}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-start justify-between gap-3 sm:gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <p className="flex items-center gap-2 text-2xl leading-none font-bold tracking-tight sm:text-3xl">
                <span>
                  {displayValue < 0 ? '-' : '+'}
                  {formatCurrency(Math.abs(displayValue))}
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex translate-y-px text-muted-foreground hover:text-foreground"
                    >
                      <CircleHelpIcon className="size-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="bottom"
                    align="center"
                    className="w-56 p-3 text-left"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span>Gain</span>
                        <span>
                          +
                          {formatCurrency(Math.abs(gainTotal))}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Loss</span>
                        <span>
                          -
                          {formatCurrency(Math.abs(lossTotal))}
                        </span>
                      </div>
                      <div className="h-px w-full bg-border/60" />
                      <div className="flex items-center justify-between">
                        <span>Net total</span>
                        <span>
                          {displayValue < 0 ? '-' : '+'}
                          {formatCurrency(Math.abs(displayValue))}
                        </span>
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              {hoverDateLabel ?? timeframeLabel}
            </p>
          </div>

          <div className="flex items-center gap-2 text-xl text-muted-foreground/70">
            <SiteLogoIcon
              logoSvg={logoSvg}
              logoImageUrl={site.logoImageUrl}
              alt={`${platformName} logo`}
              className="size-[1em] text-current [&_svg]:size-[1em] [&_svg_*]:fill-current [&_svg_*]:stroke-current"
              imageClassName="size-[1em] object-contain"
              size={20}
            />
            <span className="font-semibold">{platformName}</span>
          </div>
        </div>

        <div className="relative mt-auto h-12 w-full overflow-hidden sm:h-18">
          <svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient
                id={lineGradientId}
                x1="0"
                y1={lineTop}
                x2="0"
                y2={lineBottom}
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0%" stopColor="#7dd3fc" />
                <stop offset="100%" stopColor="#a855f7" />
              </linearGradient>
              <linearGradient
                id={areaGradientId}
                x1="0"
                y1={lineTop}
                x2="0"
                y2={lineBottom}
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0%" stopColor="#7dd3fc" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#a855f7" stopOpacity={0.25} />
              </linearGradient>
              <linearGradient id={areaFadeId} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity={0.6} />
                <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
              </linearGradient>
              <mask id={areaMaskId} maskUnits="userSpaceOnUse">
                <rect
                  x="0"
                  y="0"
                  width={innerWidth}
                  height={innerHeight}
                  fill={`url(#${areaFadeId})`}
                />
              </mask>
            </defs>

            <Group left={margin.left} top={margin.top}>
              <AreaClosed
                data={chartData}
                x={d => xScale(d.date)}
                y={d => yScale(d.value)}
                y0={innerHeight}
                yScale={yScale}
                stroke="none"
                fill={`url(#${areaGradientId})`}
                mask={`url(#${areaMaskId})`}
                curve={curveMonotoneX}
              />

              <LinePath
                data={chartData}
                x={d => xScale(d.date)}
                y={d => yScale(d.value)}
                stroke={`url(#${lineGradientId})`}
                strokeWidth={2}
                curve={curveMonotoneX}
              />

              {clampedCursorX != null && (
                <line
                  x1={clampedCursorX}
                  x2={clampedCursorX}
                  y1={0}
                  y2={innerHeight}
                  stroke="white"
                  strokeWidth={1}
                  strokeOpacity={0.7}
                />
              )}

              <rect
                x={0}
                y={0}
                width={innerWidth}
                height={innerHeight}
                fill="transparent"
                onMouseMove={handlePointerMove}
                onMouseLeave={handlePointerLeave}
                onTouchStart={handlePointerMove}
                onTouchMove={handlePointerMove}
                onTouchEnd={handlePointerLeave}
              />
            </Group>
          </svg>
          {cursorDotPosition && (
            <div
              className="pointer-events-none absolute rounded-full"
              style={{
                ...cursorDotPosition,
                width: 6,
                height: 6,
                transform: 'translate(-50%, -50%)',
                background: 'radial-gradient(circle at 30% 30%, #7dd3fc 0%, #a855f7 70%)',
              }}
            />
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default function PublicProfileHeroCards({
  profile,
  snapshot,
  actions,
  variant = 'public',
}: PublicProfileHeroCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ProfileOverviewCard profile={profile} snapshot={snapshot} actions={actions} variant={variant} />
      <ProfitLossCard
        snapshot={snapshot}
        portfolioAddress={profile.portfolioAddress}
      />
    </div>
  )
}
