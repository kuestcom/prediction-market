'use client'

import type { ReactElement } from 'react'

import type { DataPoint, SeriesConfig } from '@/types/PredictionChartTypes'

interface PredictionChartMarkersProps {
  series: SeriesConfig[]
  lastDataPoint: DataPoint
  revealSeriesSet: Set<string>
  mutedPoints: DataPoint[]
  shouldSplitByCursor: boolean
  surgeActive: boolean
  preserveMarkersDuringSurge: boolean
  markerOuterRadius: number
  markerInnerRadius: number
  markerPulseStyle: 'filled' | 'ring'
  markerOffsetX: number
  xScale: (value: Date) => number
  yScale: (value: number) => number
}

function PredictionChartMarkers({
  series,
  lastDataPoint,
  revealSeriesSet,
  mutedPoints,
  shouldSplitByCursor,
  surgeActive,
  preserveMarkersDuringSurge,
  markerOuterRadius,
  markerInnerRadius,
  markerPulseStyle,
  markerOffsetX,
  xScale,
  yScale,
}: PredictionChartMarkersProps): ReactElement {
  const resolvedMarkerOffsetX = Number.isFinite(markerOffsetX) ? markerOffsetX : 0

  return (
    <>
      {series.map((seriesItem) => {
        const isSeriesRevealing = revealSeriesSet.has(seriesItem.key)
        const seriesMutedPoints = isSeriesRevealing ? mutedPoints : []
        const shouldShowMarker =
          (seriesMutedPoints.length === 0 || shouldSplitByCursor) &&
          !(surgeActive && isSeriesRevealing && !preserveMarkersDuringSurge)

        if (!shouldShowMarker) {
          return null
        }

        const value = lastDataPoint[seriesItem.key]
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          return null
        }
        const cx = xScale(lastDataPoint.date) + resolvedMarkerOffsetX
        const cy = yScale(value)

        return (
          <g key={`${seriesItem.key}-marker`} transform={`translate(${cx}, ${cy})`}>
            {markerPulseStyle === 'ring' ? (
              <circle
                r={markerOuterRadius}
                fill="none"
                stroke={seriesItem.color}
                strokeWidth={1.6}
                strokeOpacity={0.85}
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
                style={{
                  transformOrigin: 'center',
                  transformBox: 'fill-box',
                  animation: 'prediction-chart-radar 2.6s ease-out infinite',
                }}
              />
            ) : (
              <circle
                r={markerOuterRadius}
                fill={seriesItem.color}
                fillOpacity={0.4}
                pointerEvents="none"
                style={{
                  transformOrigin: 'center',
                  transformBox: 'fill-box',
                  animation: 'prediction-chart-radar 2.6s ease-out infinite',
                }}
              />
            )}
            <circle
              r={markerInnerRadius}
              fill={seriesItem.color}
              stroke={seriesItem.color}
              strokeWidth={1.5}
              pointerEvents="none"
            />
          </g>
        )
      })}
    </>
  )
}

export default PredictionChartMarkers
