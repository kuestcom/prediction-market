'use client'

import type { CSSProperties, ReactElement } from 'react'

import { LinePath } from '@visx/shape'

import type { DataPoint, SeriesConfig } from '@/types/PredictionChartTypes'

import { sanitizeSvgId } from '@/lib/prediction-chart-helpers'

const SURGE_DASH_RATIO = 0.14

interface PredictionChartSeriesLinesProps {
  series: SeriesConfig[]
  data: DataPoint[]
  coloredPoints: DataPoint[]
  mutedPoints: DataPoint[]
  crossFadeActive: boolean
  crossFadeData: DataPoint[] | null
  crossFadeIn: number
  crossFadeOut: number
  shouldSplitByCursor: boolean
  revealProgress: number
  revealSeriesSet: Set<string>
  dashedSplitTime: number
  surgeActive: boolean
  surgeLengths: Record<string, number>
  surgeDuration: number
  surgeFilter: string
  resolveSurgeColor: (color: string) => string
  resolvedSurgeStrokeWidth: number
  firstFinitePointBySeries: Record<string, DataPoint | null>
  leadingGapStartMs: number
  futureLineColor: string
  futureLineOpacity: number
  resolvedLineStrokeWidth: number
  resolvedLineCurve: any
  showAreaFill: boolean
  resolvedAreaFillTopOpacity: number
  resolvedAreaFillBottomOpacity: number
  areaFillBottomOffset: number
  clipId: string
  leftClipId: string
  rightClipId: string
  innerHeight: number
  lineEndOffsetX: number
  registerSeriesPath: (seriesKey: string) => (node: SVGPathElement | null) => void
  getX: (d: DataPoint) => number
  getSeriesY: (point: DataPoint, seriesKey: string) => number
  hasSeriesValue: (point: DataPoint, seriesKey: string) => boolean
}

function PredictionChartSeriesLines({
  series,
  data,
  coloredPoints,
  mutedPoints,
  crossFadeActive,
  crossFadeData,
  crossFadeIn,
  crossFadeOut,
  shouldSplitByCursor,
  revealProgress,
  revealSeriesSet,
  dashedSplitTime,
  surgeActive,
  surgeLengths,
  surgeDuration,
  surgeFilter,
  resolveSurgeColor,
  resolvedSurgeStrokeWidth,
  firstFinitePointBySeries,
  leadingGapStartMs,
  futureLineColor,
  futureLineOpacity,
  resolvedLineStrokeWidth,
  resolvedLineCurve,
  showAreaFill,
  resolvedAreaFillTopOpacity: _resolvedAreaFillTopOpacity,
  resolvedAreaFillBottomOpacity: _resolvedAreaFillBottomOpacity,
  areaFillBottomOffset,
  clipId,
  leftClipId,
  rightClipId,
  innerHeight,
  lineEndOffsetX: _lineEndOffsetX,
  registerSeriesPath,
  getX,
  getSeriesY,
  hasSeriesValue,
}: PredictionChartSeriesLinesProps): ReactElement {
  return (
    <>
      {series.map((seriesItem) => {
        const seriesColor = seriesItem.color
        const isSeriesRevealing = revealProgress < 0.999 || revealSeriesSet.has(seriesItem.key)
        const seriesColoredPoints = isSeriesRevealing ? coloredPoints : data
        const seriesMutedPoints = isSeriesRevealing ? mutedPoints : []
        const surgeLength = surgeLengths[seriesItem.key]
        const surgeDashLength =
          typeof surgeLength === 'number' && Number.isFinite(surgeLength)
            ? Math.max(18, surgeLength * SURGE_DASH_RATIO)
            : 0
        const surgeDashGap =
          typeof surgeLength === 'number' && Number.isFinite(surgeLength) ? surgeLength + surgeDashLength : 0
        const shouldRenderSurge = Boolean(
          surgeActive &&
          isSeriesRevealing &&
          !crossFadeActive &&
          !shouldSplitByCursor &&
          seriesMutedPoints.length === 0 &&
          seriesColoredPoints.length > 1 &&
          surgeLength &&
          surgeDashLength > 0,
        )
        const firstPoint = firstFinitePointBySeries[seriesItem.key] ?? null
        const firstPointTime = firstPoint?.date.getTime()
        const hasLeadingGap =
          Number.isFinite(leadingGapStartMs) &&
          typeof firstPointTime === 'number' &&
          Number.isFinite(firstPointTime) &&
          leadingGapStartMs < firstPointTime
        const ghostOpacity = crossFadeOut
        const seriesSplitTime = isSeriesRevealing ? dashedSplitTime : Number.POSITIVE_INFINITY
        const areaGradientId = `${clipId}-area-${sanitizeSvgId(seriesItem.key)}`
        let dashedColoredPoints: DataPoint[] | null = null
        let dashedMutedPoints: DataPoint[] | null = null

        if (hasLeadingGap && firstPoint) {
          const firstValue = firstPoint[seriesItem.key] as number
          const startPoint: DataPoint = { date: new Date(leadingGapStartMs), [seriesItem.key]: firstValue }
          const endPoint: DataPoint = { date: firstPoint.date, [seriesItem.key]: firstValue }

          if (seriesSplitTime <= leadingGapStartMs) {
            dashedMutedPoints = [startPoint, endPoint]
          } else if (seriesSplitTime >= firstPointTime!) {
            dashedColoredPoints = [startPoint, endPoint]
          } else {
            const splitPoint: DataPoint = { date: new Date(seriesSplitTime), [seriesItem.key]: firstValue }
            dashedColoredPoints = [startPoint, splitPoint]
            dashedMutedPoints = [splitPoint, endPoint]
          }
        }

        return (
          <g key={seriesItem.key}>
            {crossFadeActive && crossFadeData && crossFadeData.length > 1 && (
              <LinePath<DataPoint>
                data={crossFadeData}
                x={(d) => getX(d)}
                y={(d) => getSeriesY(d, seriesItem.key)}
                defined={(d) => hasSeriesValue(d, seriesItem.key)}
                stroke={seriesColor}
                strokeWidth={resolvedLineStrokeWidth}
                strokeOpacity={ghostOpacity}
                strokeLinecap="round"
                strokeLinejoin="round"
                curve={resolvedLineCurve}
                fill="transparent"
              />
            )}

            {dashedMutedPoints && (
              <LinePath<DataPoint>
                data={dashedMutedPoints}
                x={(d) => getX(d)}
                y={(d) => getSeriesY(d, seriesItem.key)}
                defined={(d) => hasSeriesValue(d, seriesItem.key)}
                stroke={futureLineColor}
                strokeWidth={1.3}
                strokeDasharray="2 4"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeOpacity={futureLineOpacity}
                curve={resolvedLineCurve}
                fill="transparent"
              />
            )}

            {dashedColoredPoints && (
              <LinePath<DataPoint>
                data={dashedColoredPoints}
                x={(d) => getX(d)}
                y={(d) => getSeriesY(d, seriesItem.key)}
                defined={(d) => hasSeriesValue(d, seriesItem.key)}
                stroke={seriesColor}
                strokeWidth={1.4}
                strokeDasharray="2 4"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeOpacity={0.9}
                curve={resolvedLineCurve}
                fill="transparent"
              />
            )}

            {shouldSplitByCursor ? (
              <>
                <LinePath<DataPoint>
                  data={data}
                  x={(d) => getX(d)}
                  y={(d) => getSeriesY(d, seriesItem.key)}
                  defined={(d) => hasSeriesValue(d, seriesItem.key)}
                  stroke={futureLineColor}
                  strokeWidth={1.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeOpacity={futureLineOpacity * crossFadeIn}
                  curve={resolvedLineCurve}
                  fill="transparent"
                  clipPath={`url(#${rightClipId})`}
                />
                <LinePath<DataPoint>
                  data={data}
                  x={(d) => getX(d)}
                  y={(d) => getSeriesY(d, seriesItem.key)}
                  defined={(d) => hasSeriesValue(d, seriesItem.key)}
                  stroke={seriesColor}
                  strokeWidth={resolvedLineStrokeWidth}
                  strokeOpacity={crossFadeIn}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  curve={resolvedLineCurve}
                  fill="transparent"
                  clipPath={`url(#${leftClipId})`}
                  innerRef={registerSeriesPath(seriesItem.key)}
                />
              </>
            ) : (
              <>
                {seriesMutedPoints.length > 1 && (
                  <LinePath<DataPoint>
                    data={seriesMutedPoints}
                    x={(d) => getX(d)}
                    y={(d) => getSeriesY(d, seriesItem.key)}
                    defined={(d) => hasSeriesValue(d, seriesItem.key)}
                    stroke={futureLineColor}
                    strokeWidth={1.6}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeOpacity={futureLineOpacity * crossFadeIn}
                    curve={resolvedLineCurve}
                    fill="transparent"
                  />
                )}
              </>
            )}

            {!shouldSplitByCursor && seriesColoredPoints.length > 1 && (
              <LinePath<DataPoint>
                data={seriesColoredPoints}
                x={(d) => getX(d)}
                y={(d) => getSeriesY(d, seriesItem.key)}
                defined={(d) => hasSeriesValue(d, seriesItem.key)}
                curve={resolvedLineCurve}
              >
                {({ path }) => {
                  const pathDefinition = path(seriesColoredPoints)
                  if (!pathDefinition) {
                    return null
                  }

                  const finiteColoredPoints = seriesColoredPoints.filter((point) =>
                    hasSeriesValue(point, seriesItem.key),
                  )
                  const firstColoredPoint = finiteColoredPoints[0]
                  const lastColoredPoint = finiteColoredPoints.at(-1)
                  const canRenderAreaFill =
                    showAreaFill &&
                    finiteColoredPoints.length > 1 &&
                    finiteColoredPoints.length === seriesColoredPoints.length
                  const areaPathDefinition =
                    canRenderAreaFill && firstColoredPoint && lastColoredPoint
                      ? `${pathDefinition} L ${getX(lastColoredPoint)} ${innerHeight - areaFillBottomOffset} L ${getX(firstColoredPoint)} ${innerHeight - areaFillBottomOffset} Z`
                      : null

                  return (
                    <>
                      {areaPathDefinition && (
                        <path
                          d={areaPathDefinition}
                          fill={`url(#${areaGradientId})`}
                          fillOpacity={crossFadeIn}
                          stroke="none"
                          pointerEvents="none"
                        />
                      )}
                      <path
                        d={pathDefinition}
                        stroke={seriesColor}
                        strokeWidth={resolvedLineStrokeWidth}
                        strokeOpacity={crossFadeIn}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="transparent"
                        ref={registerSeriesPath(seriesItem.key)}
                      />
                      {shouldRenderSurge && (
                        <path
                          d={pathDefinition}
                          stroke={resolveSurgeColor(seriesColor)}
                          strokeWidth={resolvedSurgeStrokeWidth}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          fill="transparent"
                          strokeDasharray={`${surgeDashLength} ${surgeDashGap}`}
                          strokeDashoffset={0}
                          opacity={1}
                          style={
                            {
                              animation: `prediction-chart-surge ${surgeDuration}ms ease-out`,
                              '--surge-offset-start': '0',
                              '--surge-offset-end': `${-(surgeLength + surgeDashLength)}`,
                              filter: surgeFilter,
                            } as CSSProperties
                          }
                        />
                      )}
                    </>
                  )
                }}
              </LinePath>
            )}
          </g>
        )
      })}
    </>
  )
}

export default PredictionChartSeriesLines
