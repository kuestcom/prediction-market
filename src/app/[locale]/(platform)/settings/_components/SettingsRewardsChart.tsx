'use client'

import type { PointerEvent as ReactPointerEvent } from 'react'

import { curveMonotoneX } from '@visx/curve'
import { scaleLinear, scaleTime } from '@visx/scale'
import { AreaClosed, LinePath } from '@visx/shape'
import { useExtracted, useLocale } from 'next-intl'
import { useId, useMemo, useState } from 'react'

import { Tabs, TabsIndicator, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'

interface ChartPoint {
  date: string
  value: number
}

interface SettingsRewardsChartProps {
  affiliateSeries: ChartPoint[]
  resolutionSeries: ChartPoint[]
}

type ChartType = 'affiliate' | 'resolution'

const CHART_WIDTH = 900
const CHART_HEIGHT = 190
const X_PADDING = 8
const Y_PADDING = 18

export default function SettingsRewardsChart({ affiliateSeries, resolutionSeries }: SettingsRewardsChartProps) {
  const t = useExtracted()
  const locale = useLocale()
  const gradientId = useId().replaceAll(':', '')
  const [activeType, setActiveType] = useState<ChartType>('resolution')
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const points = activeType === 'affiliate' ? affiliateSeries : resolutionSeries
  const data = useMemo(
    () =>
      points.map((point) => ({
        date: new Date(`${point.date}T00:00:00Z`),
        value: point.value,
      })),
    [points],
  )
  const total = data.reduce((sum, point) => sum + point.value, 0)
  const values = data.map((point) => point.value)
  const maximum = Math.max(...values, 0)
  const firstDate = data[0]?.date ?? new Date(0)
  const lastDate = data.at(-1)?.date ?? new Date(firstDate.getTime() + 86_400_000)
  const xScale = scaleTime<number>({
    domain: [firstDate, lastDate],
    range: [X_PADDING, CHART_WIDTH - X_PADDING],
  })
  const yScale = scaleLinear<number>({
    domain: [0, Math.max(maximum * 1.12, 1)],
    range: [CHART_HEIGHT - Y_PADDING, Y_PADDING],
  })
  const activePoint = activeIndex == null ? null : data[activeIndex]

  function handlePointerMove(event: ReactPointerEvent<SVGRectElement>) {
    if (!data.length) {
      return
    }
    const bounds = event.currentTarget.getBoundingClientRect()
    const relativeX = Math.max(0, Math.min(bounds.width, event.clientX - bounds.left))
    setActiveIndex(Math.round((relativeX / Math.max(bounds.width, 1)) * (data.length - 1)))
  }

  const activeDate = activePoint?.date.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })

  return (
    <div className="overflow-hidden rounded-xl border bg-background">
      <div className="flex flex-col gap-4 border-b p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t('Last 30 days')}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight">{formatCurrency(total)}</p>
        </div>
        <Tabs value={activeType} onValueChange={(value) => setActiveType(value as ChartType)}>
          <TabsList className="relative h-9 rounded-lg">
            <TabsTrigger value="affiliate">{t('Affiliate')}</TabsTrigger>
            <TabsTrigger value="resolution">{t('Resolution')}</TabsTrigger>
            <TabsIndicator className="hidden" />
          </TabsList>
        </Tabs>
      </div>

      <div className="relative px-3 pt-4 pb-3 sm:px-5">
        {activePoint && (
          <div className="pointer-events-none absolute top-3 right-4 z-10 rounded-md border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-sm sm:right-7">
            <span className="text-muted-foreground">{activeDate}</span>
            <span className="mx-1.5 text-border">·</span>
            <span className="font-semibold">{formatCurrency(activePoint.value)}</span>
          </div>
        )}
        <svg
          className={cn('h-44 w-full', activeType === 'affiliate' ? 'text-yes' : 'text-violet-500')}
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={
            activeType === 'affiliate'
              ? t('Affiliate earnings over the last 30 days')
              : t('Resolution rewards earned over the last 30 days')
          }
        >
          <defs>
            <linearGradient id={`${gradientId}-area`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75, 1].map((ratio) => (
            <line
              key={ratio}
              x1={0}
              x2={CHART_WIDTH}
              y1={CHART_HEIGHT * ratio - 4}
              y2={CHART_HEIGHT * ratio - 4}
              stroke="currentColor"
              strokeOpacity="0.08"
              strokeDasharray="3 5"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {data.length > 0 && (
            <>
              <AreaClosed
                data={data}
                x={(point) => xScale(point.date)}
                y={(point) => yScale(point.value)}
                y0={CHART_HEIGHT - Y_PADDING}
                yScale={yScale}
                curve={curveMonotoneX}
                fill={`url(#${gradientId}-area)`}
                stroke="none"
              />
              <LinePath
                data={data}
                x={(point) => xScale(point.date)}
                y={(point) => yScale(point.value)}
                curve={curveMonotoneX}
                stroke="currentColor"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
              />
            </>
          )}
          {activePoint && (
            <>
              <line
                x1={xScale(activePoint.date)}
                x2={xScale(activePoint.date)}
                y1={0}
                y2={CHART_HEIGHT}
                stroke="currentColor"
                strokeOpacity="0.2"
                vectorEffect="non-scaling-stroke"
              />
              <circle cx={xScale(activePoint.date)} cy={yScale(activePoint.value)} r={5} fill="currentColor" />
            </>
          )}
          <rect
            width={CHART_WIDTH}
            height={CHART_HEIGHT}
            fill="transparent"
            onPointerMove={handlePointerMove}
            onPointerLeave={() => setActiveIndex(null)}
          />
        </svg>
        <div className="flex justify-between px-1 text-xs text-muted-foreground">
          {[data[0], data[Math.floor(data.length / 2)], data.at(-1)].map((point, index) => (
            <span key={`${point?.date.toISOString() ?? 'empty'}-${index}`}>
              {point?.date.toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' })}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
