'use client'

import type { PointerEvent as ReactPointerEvent } from 'react'
import { curveMonotoneX } from '@visx/curve'
import { scaleLinear, scaleTime } from '@visx/scale'
import { AreaClosed, LinePath } from '@visx/shape'
import { useId, useMemo, useState } from 'react'
import { formatCompactCount, formatCompactCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'

interface AdminDashboardSparklinePoint {
  date: string
  value: number
}

interface AdminDashboardSparklineProps {
  ariaLabel: string
  className?: string
  format: 'count' | 'currency'
  points: AdminDashboardSparklinePoint[]
}

const CHART_WIDTH = 720
const CHART_HEIGHT = 92
const LINE_PADDING = 12

export default function AdminDashboardSparkline({
  ariaLabel,
  className,
  format,
  points,
}: AdminDashboardSparklineProps) {
  const gradientId = useId().replaceAll(':', '')
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const data = useMemo(() => points.map(point => ({
    date: new Date(`${point.date}T00:00:00Z`),
    value: point.value,
  })), [points])

  const firstDate = data[0]?.date ?? new Date(0)
  const lastDate = data.at(-1)?.date ?? new Date(firstDate.getTime() + 86_400_000)
  const values = data.map(point => point.value)
  const minValue = values.length > 0 ? Math.min(...values) : 0
  const maxValue = values.length > 0 ? Math.max(...values) : 0
  const valuePadding = minValue === maxValue ? Math.max(1, Math.abs(maxValue) * 0.05) : (maxValue - minValue) * 0.08
  const xScale = scaleTime<number>({
    domain: [firstDate, lastDate],
    range: [0, CHART_WIDTH],
  })
  const yScale = scaleLinear<number>({
    domain: [Math.max(0, minValue - valuePadding), maxValue + valuePadding],
    range: [CHART_HEIGHT - LINE_PADDING, LINE_PADDING],
  })
  const activePoint = activeIndex == null ? null : data[activeIndex]

  function handlePointerMove(event: ReactPointerEvent<SVGRectElement>) {
    if (data.length === 0) {
      return
    }

    const bounds = event.currentTarget.getBoundingClientRect()
    const position = Math.max(0, Math.min(bounds.width, event.clientX - bounds.left))
    const nextIndex = Math.round((position / Math.max(bounds.width, 1)) * (data.length - 1))
    setActiveIndex(nextIndex)
  }

  const formattedActiveValue = activePoint
    ? format === 'currency'
      ? formatCompactCurrency(activePoint.value)
      : formatCompactCount(activePoint.value)
    : null
  const formattedActiveDate = activePoint?.date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })

  return (
    <div className={cn('relative h-18 w-full text-primary', className)}>
      {activePoint && (
        <div
          className="
            pointer-events-none absolute top-0 right-0 z-10 rounded-md bg-popover/95 px-2 py-1 text-[11px]
            text-popover-foreground shadow-sm ring-1 ring-border
          "
        >
          {formattedActiveDate}
          {' · '}
          <span className="font-medium">{formattedActiveValue}</span>
        </div>
      )}
      <svg
        className="opacity-45"
        width="100%"
        height="100%"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={ariaLabel}
      >
        <defs>
          <linearGradient id={`${gradientId}-area`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.2" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        {data.length > 0 && (
          <>
            <AreaClosed
              data={data}
              x={point => xScale(point.date)}
              y={point => yScale(point.value)}
              y0={CHART_HEIGHT}
              yScale={yScale}
              curve={curveMonotoneX}
              fill={`url(#${gradientId}-area)`}
              stroke="none"
            />
            <LinePath
              data={data}
              x={point => xScale(point.date)}
              y={point => yScale(point.value)}
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
              strokeOpacity={0.25}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={xScale(activePoint.date)}
              cy={yScale(activePoint.value)}
              r={4}
              fill="currentColor"
            />
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
    </div>
  )
}
