'use client'

import type { ReactElement } from 'react'

interface PredictionChartGridProps {
  showVerticalGrid: boolean
  showHorizontalGrid: boolean
  verticalGridTicks: Date[]
  horizontalGridTicks: number[]
  xScale: (value: Date) => number
  yScale: (value: number) => number
  innerWidth: number
  innerHeight: number
  gridLineColor: string
  gridLineDasharray: string | undefined
  gridLineOpacity: number
}

function PredictionChartGrid({
  showVerticalGrid,
  showHorizontalGrid,
  verticalGridTicks,
  horizontalGridTicks,
  xScale,
  yScale,
  innerWidth,
  innerHeight,
  gridLineColor,
  gridLineDasharray,
  gridLineOpacity,
}: PredictionChartGridProps): ReactElement {
  return (
    <>
      {showVerticalGrid &&
        verticalGridTicks.map((tick) => {
          const tickTime = tick.getTime()
          const xValue = xScale(tick)
          return (
            <line
              key={`grid-x-${tickTime}`}
              x1={xValue}
              x2={xValue}
              y1={0}
              y2={innerHeight}
              stroke={gridLineColor}
              strokeWidth={1}
              strokeDasharray={gridLineDasharray}
              opacity={gridLineOpacity}
            />
          )
        })}

      {showHorizontalGrid &&
        horizontalGridTicks.map((value) => (
          <line
            key={`grid-${value}`}
            x1={0}
            x2={innerWidth}
            y1={yScale(value)}
            y2={yScale(value)}
            stroke={gridLineColor}
            strokeWidth={1}
            strokeDasharray={gridLineDasharray}
            opacity={gridLineOpacity}
          />
        ))}
    </>
  )
}

export default PredictionChartGrid
