'use client'

import type { PointerEvent as ReactPointerEvent, ReactElement, SetStateAction } from 'react'

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'

import type { DataPoint, PredictionChartCursorSnapshot, PredictionChartProps } from '@/types/PredictionChartTypes'

import {
  clusterAnnotationMarkers,
  PredictionChartAnnotationTooltip,
  resolveAnnotationMarkers,
} from '@/components/PredictionChartAnnotations'
import { drawPredictionChartCanvas, type PredictionChartCanvasFrame } from '@/components/PredictionChartCanvasRenderer'
import PredictionChartHeader from '@/components/PredictionChartHeader'
import PredictionChartTooltipOverlay from '@/components/PredictionChartTooltipOverlay'
import useDarkMode from '@/hooks/useDarkMode'
import usePredictionChartData from '@/hooks/usePredictionChartData'
import {
  calculateYAxisBounds,
  DEFAULT_X_AXIS_TICKS,
  DEFAULT_Y_AXIS_MAX,
  snapTimestampToInterval,
  TOOLTIP_LABEL_GAP,
  TOOLTIP_LABEL_HEIGHT,
  TOOLTIP_PANEL_LABEL_GAP,
  TOOLTIP_PANEL_LABEL_HEIGHT,
} from '@/lib/prediction-chart'
import { normalizeTicks, toDomainTimestamp } from '@/lib/prediction-chart-helpers'

const defaultMargin = { top: 30, right: 60, bottom: 40, left: 0 }
const GRID_LINE_COLOR_DARK = '#51677A'
const GRID_LINE_COLOR_LIGHT = '#8F9EAD'
const GRID_LINE_OPACITY_DARK = 0.7
const GRID_LINE_OPACITY_LIGHT = 0.35
const MIN_Y_AXIS_TICKS = 3
const PREFERRED_MAX_Y_AXIS_TICKS = 5
const MAX_Y_AXIS_TICKS = 6
const MARKER_PULSE_DURATION = 2600

interface CursorState {
  point: DataPoint
  left: number
}

interface TooltipEntry {
  key: string
  name: string
  color: string
  value: number
  initialTop: number
}

type PositionedTooltipEntry = TooltipEntry & { top: number }

function interpolateCursorPoint(data: DataPoint[], seriesKeys: string[], targetDate: Date) {
  if (!data.length) {
    return null
  }

  const targetTime = targetDate.getTime()
  const firstPoint = data[0]
  const lastPoint = data.at(-1)!
  const firstTime = firstPoint.date.getTime()
  const lastTime = lastPoint.date.getTime()

  if (targetTime <= firstTime) {
    return { ...firstPoint, date: targetDate }
  }

  if (targetTime >= lastTime) {
    return { ...lastPoint, date: targetDate }
  }

  let low = 0
  let high = data.length - 1
  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    if (data[middle].date.getTime() < targetTime) {
      low = middle + 1
    } else {
      high = middle - 1
    }
  }

  const previousPoint = data[Math.max(0, low - 1)]
  const nextPoint = data[Math.min(data.length - 1, low)]
  const previousTime = previousPoint.date.getTime()
  const nextTime = nextPoint.date.getTime()
  const ratio = nextTime > previousTime ? (targetTime - previousTime) / (nextTime - previousTime) : 0
  const point: DataPoint = { date: targetDate }

  seriesKeys.forEach((seriesKey) => {
    const previousValue = previousPoint[seriesKey]
    const nextValue = nextPoint[seriesKey]

    if (typeof previousValue === 'number' && typeof nextValue === 'number') {
      point[seriesKey] = previousValue + (nextValue - previousValue) * ratio
    } else if (typeof previousValue === 'number') {
      point[seriesKey] = previousValue
    } else if (typeof nextValue === 'number') {
      point[seriesKey] = nextValue
    }
  })

  return point
}

function positionTooltipEntries(
  entries: TooltipEntry[],
  marginTop: number,
  innerHeight: number,
  labelHeight: number,
  labelGap: number,
) {
  if (!entries.length) {
    return []
  }

  const minTop = marginTop
  const maxTop = Math.max(minTop, marginTop + innerHeight - labelHeight)
  const step = labelHeight + labelGap
  const positioned = entries
    .slice()
    .sort((left, right) => left.initialTop - right.initialTop)
    .reduce<PositionedTooltipEntry[]>((result, entry) => {
      const desiredTop = Math.max(minTop, Math.min(entry.initialTop, maxTop))
      const previousTop = result.at(-1)?.top
      result.push({
        ...entry,
        top: previousTop == null ? desiredTop : Math.max(desiredTop, previousTop + step),
      })
      return result
    }, [])

  const overflow = positioned.at(-1)!.top - maxTop
  if (overflow > 0) {
    positioned.forEach((entry) => {
      entry.top -= overflow
    })
  }

  const underflow = minTop - positioned[0].top
  if (underflow > 0) {
    positioned.forEach((entry) => {
      entry.top += underflow
    })
  }

  return positioned
}

export default function PredictionChart({
  data: providedData,
  series: providedSeries,
  width = 800,
  height = 400,
  margin = defaultMargin,
  dataSignature,
  dataSyncMode = 'append',
  onCursorDataChange,
  cursorStepMs,
  xAxisTickCount = DEFAULT_X_AXIS_TICKS,
  xAxisTickValues,
  xAxisTickFormatter,
  xDomain,
  xAxisTickFontSize = 11,
  yAxisTickFontSize = 11,
  centerXAxisTickLabels = false,
  xAxisLabelsRightInset = 0,
  alignYAxisLabelsToChartEdge = false,
  fadeYAxisEdges: _fadeYAxisEdges = false,
  neutralAxisColors = false,
  showXAxisTopRule = false,
  showXAxisTopRuleFullWidth = false,
  hideYAxisMinimumLabel = false,
  cursorGuideTop,
  cursorGuideColor = '#2C3F4F',
  autoscale = true,
  showXAxis = true,
  showYAxis = true,
  showHorizontalGrid = true,
  showVerticalGrid = false,
  gridLineStyle = 'dashed',
  gridLineOpacity: gridLineOpacityOverride,
  showAnnotations = true,
  annotationMarkers = [],
  leadingGapStart = null,
  legendContent,
  showLegend = true,
  yAxis,
  disableCursorSplit: _disableCursorSplit = false,
  disableResetAnimation: _disableResetAnimation = false,
  markerOuterRadius = 6,
  markerInnerRadius = 2.8,
  markerPulseStyle = 'filled',
  markerOffsetX = -12,
  lineEndOffsetX = -12,
  lineStrokeWidth = 1.6,
  lineCurve = 'catmullRom',
  plotClipPadding: _plotClipPadding,
  showAreaFill = false,
  areaFillTopOpacity = 0.16,
  areaFillBottomOpacity = 0,
  areaFillBottomOffset = 0,
  tooltipValueFormatter,
  tooltipDateFormatter,
  tooltipHeaderFontSize,
  tooltipDateFontSize,
  showTooltipSeriesLabels = true,
  tooltipLabelVariant = 'filled',
  clampCursorToDataExtent = false,
  tooltipHeader,
  watermark,
}: PredictionChartProps): ReactElement {
  const series = useMemo(() => providedSeries ?? [], [providedSeries])
  const normalizedSignature = dataSignature ?? '__default__'
  const { data, isClient } = usePredictionChartData(providedData, normalizedSignature, dataSyncMode)
  const isDarkMode = useDarkMode()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [cursor, setCursor] = useState<CursorState | null>(null)
  const annotationScopeKey = `${normalizedSignature}:${showAnnotations ? '1' : '0'}`
  const [annotationHoverState, setAnnotationHoverState] = useState<{
    scopeKey: string
    clusterId: string | null
  }>({ scopeKey: annotationScopeKey, clusterId: null })
  const hoveredAnnotationClusterId =
    annotationHoverState.scopeKey === annotationScopeKey ? annotationHoverState.clusterId : null
  const setHoveredAnnotationClusterId = useCallback(
    (nextClusterId: SetStateAction<string | null>) => {
      setAnnotationHoverState((current) => {
        const currentId = current.scopeKey === annotationScopeKey ? current.clusterId : null
        const nextId = typeof nextClusterId === 'function' ? nextClusterId(currentId) : nextClusterId
        if (current.scopeKey === annotationScopeKey && currentId === nextId) {
          return current
        }
        return { scopeKey: annotationScopeKey, clusterId: nextId }
      })
    },
    [annotationScopeKey],
  )

  const resolvedMargin = useMemo(
    () => ({
      top: margin.top,
      left: margin.left,
      right: showYAxis ? margin.right : Math.min(margin.right, 12),
      bottom: showXAxis ? margin.bottom : Math.min(margin.bottom, 12),
    }),
    [margin.bottom, margin.left, margin.right, margin.top, showXAxis, showYAxis],
  )
  const innerWidth = Math.max(1, width - resolvedMargin.left - resolvedMargin.right)
  const innerHeight = Math.max(1, height - resolvedMargin.top - resolvedMargin.bottom)
  const yAxisMinTicks = Math.max(MIN_Y_AXIS_TICKS, Math.min(PREFERRED_MAX_Y_AXIS_TICKS, Math.round(innerHeight / 56)))
  const defaultYAxis = useMemo(() => {
    if (!autoscale) {
      return { min: 0, max: DEFAULT_Y_AXIS_MAX, ticks: [0, 25, 50, 75, 100] }
    }
    return calculateYAxisBounds(data, series, yAxisMinTicks, MAX_Y_AXIS_TICKS)
  }, [autoscale, data, series, yAxisMinTicks])
  const yAxisMin = typeof yAxis?.min === 'number' && Number.isFinite(yAxis.min) ? yAxis.min : defaultYAxis.min
  const yAxisMax = typeof yAxis?.max === 'number' && Number.isFinite(yAxis.max) ? yAxis.max : defaultYAxis.max
  const resolvedYAxisTicks = useMemo(() => {
    if (!Array.isArray(yAxis?.ticks)) {
      return normalizeTicks(defaultYAxis.ticks)
    }
    if (yAxis.ticks.length === 0) {
      return []
    }
    const normalizedTicks = normalizeTicks(yAxis.ticks)
    return normalizedTicks.length > 0 ? normalizedTicks : defaultYAxis.ticks
  }, [defaultYAxis.ticks, yAxis?.ticks])

  const domainBounds = useMemo(() => {
    const explicitStart = toDomainTimestamp(xDomain?.start)
    const explicitEnd = toDomainTimestamp(xDomain?.end)
    const timestamps = data.map((point) => point.date.getTime()).filter(Number.isFinite)
    const dataStart = timestamps.length ? Math.min(...timestamps) : 0
    const dataEnd = timestamps.length ? Math.max(...timestamps) : dataStart + 1
    const leadingStart = leadingGapStart instanceof Date ? leadingGapStart.getTime() : Number.NaN
    const defaultStart = Number.isFinite(leadingStart) ? Math.min(dataStart, leadingStart) : dataStart
    const start = Number.isFinite(explicitStart) ? explicitStart : defaultStart
    const resolvedEnd = Number.isFinite(explicitEnd) ? explicitEnd : dataEnd
    return { start, end: Math.max(start + 1, resolvedEnd) }
  }, [data, leadingGapStart, xDomain?.end, xDomain?.start])

  const dataBounds = useMemo(() => {
    if (!data.length) {
      return null
    }
    return { start: data[0].date.getTime(), end: data.at(-1)!.date.getTime() }
  }, [data])

  const resolvedXAxisTicks = useMemo(() => {
    const explicitTicks = xAxisTickValues
      ?.filter((tick) => {
        const timestamp = tick.getTime()
        return Number.isFinite(timestamp) && timestamp >= domainBounds.start && timestamp <= domainBounds.end
      })
      .sort((left, right) => left.getTime() - right.getTime())

    if (explicitTicks && explicitTicks.length >= 2) {
      return explicitTicks
    }

    const count = Math.max(2, Math.floor(xAxisTickCount))
    return Array.from({ length: count }, (_, index) => {
      const progress = count === 1 ? 0 : index / (count - 1)
      return new Date(domainBounds.start + (domainBounds.end - domainBounds.start) * progress)
    })
  }, [domainBounds.end, domainBounds.start, xAxisTickCount, xAxisTickValues])

  const totalDurationHours = (domainBounds.end - domainBounds.start) / 36e5
  const formatXAxisTick = useCallback(
    (date: Date) => {
      if (xAxisTickFormatter) {
        return xAxisTickFormatter(date)
      }
      if (totalDurationHours <= 48) {
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      }
      if (totalDurationHours <= 24 * 45) {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      }
      return date.toLocaleDateString('en-US', { month: 'short' })
    },
    [totalDurationHours, xAxisTickFormatter],
  )
  const formatYAxisTick = useCallback(
    (value: number) => (yAxis?.tickFormat ? yAxis.tickFormat(value) : `${value}%`),
    [yAxis],
  )

  const xScale = useCallback(
    (date: Date) => ((date.getTime() - domainBounds.start) / (domainBounds.end - domainBounds.start)) * innerWidth,
    [domainBounds.end, domainBounds.start, innerWidth],
  )
  const yScale = useCallback(
    (value: number) => innerHeight - ((value - yAxisMin) / Math.max(Number.EPSILON, yAxisMax - yAxisMin)) * innerHeight,
    [innerHeight, yAxisMax, yAxisMin],
  )
  const resolvedAnnotationClusters = useMemo(
    () =>
      !showAnnotations || !annotationMarkers.length
        ? []
        : clusterAnnotationMarkers(
            resolveAnnotationMarkers(annotationMarkers, xScale, yScale, innerWidth, innerHeight),
          ),
    [annotationMarkers, innerHeight, innerWidth, showAnnotations, xScale, yScale],
  )
  const hoveredAnnotationCluster = hoveredAnnotationClusterId
    ? (resolvedAnnotationClusters.find((cluster) => cluster.id === hoveredAnnotationClusterId) ?? null)
    : null
  const hoveredAnnotationTooltipPosition = hoveredAnnotationCluster
    ? {
        left: Math.max(16, Math.min(width - 16, resolvedMargin.left + hoveredAnnotationCluster.x)),
        top: Math.max(16, resolvedMargin.top + hoveredAnnotationCluster.y - 12),
      }
    : null

  const tooltipEntries = cursor
    ? series.reduce<TooltipEntry[]>((entries, seriesItem) => {
        const value = cursor.point[seriesItem.key]
        if (typeof value === 'number' && Number.isFinite(value)) {
          entries.push({
            key: seriesItem.key,
            name: seriesItem.name,
            color: seriesItem.color,
            value,
            initialTop:
              resolvedMargin.top +
              yScale(value) -
              (tooltipLabelVariant === 'panel' ? TOOLTIP_PANEL_LABEL_HEIGHT : TOOLTIP_LABEL_HEIGHT),
          })
        }
        return entries
      }, [])
    : []
  const positionedTooltipEntries = positionTooltipEntries(
    tooltipEntries,
    resolvedMargin.top,
    innerHeight,
    tooltipLabelVariant === 'panel' ? TOOLTIP_PANEL_LABEL_HEIGHT : TOOLTIP_LABEL_HEIGHT,
    tooltipLabelVariant === 'panel' ? TOOLTIP_PANEL_LABEL_GAP : TOOLTIP_LABEL_GAP,
  )

  const gridLineColor = neutralAxisColors
    ? isDarkMode
      ? '#4a4a4a'
      : '#d4d4d4'
    : isDarkMode
      ? GRID_LINE_COLOR_DARK
      : GRID_LINE_COLOR_LIGHT
  const defaultGridLineOpacity = isDarkMode ? GRID_LINE_OPACITY_DARK : GRID_LINE_OPACITY_LIGHT
  const resolvedGridLineOpacity =
    typeof gridLineOpacityOverride === 'number' && Number.isFinite(gridLineOpacityOverride)
      ? Math.max(0, Math.min(1, gridLineOpacityOverride))
      : defaultGridLineOpacity
  const axisLabelColor = neutralAxisColors ? '#7A8595' : gridLineColor
  const axisLabelOpacity = neutralAxisColors ? 1 : Math.min(1, defaultGridLineOpacity + 0.25)

  const createCanvasFrame = useCallback(
    (markerPulseProgress: number): PredictionChartCanvasFrame => ({
      width,
      height,
      margin: resolvedMargin,
      data,
      series,
      domainStart: domainBounds.start,
      domainEnd: domainBounds.end,
      yMin: yAxisMin,
      yMax: yAxisMax,
      yTicks: resolvedYAxisTicks,
      xTicks: resolvedXAxisTicks,
      formatXTick: formatXAxisTick,
      formatYTick: formatYAxisTick,
      showXAxis,
      showYAxis,
      showHorizontalGrid,
      showVerticalGrid,
      showXAxisTopRule,
      showXAxisTopRuleFullWidth,
      hideYAxisMinimumLabel,
      alignYAxisLabelsToChartEdge,
      xAxisTickFontSize,
      yAxisTickFontSize,
      centerXAxisTickLabels,
      xAxisLabelsRightInset,
      gridLineStyle,
      gridLineColor,
      gridLineOpacity: resolvedGridLineOpacity,
      axisLabelColor,
      axisLabelOpacity,
      lineCurve,
      lineStrokeWidth: Math.max(0.5, lineStrokeWidth),
      lineEndOffsetX: Number.isFinite(lineEndOffsetX) ? lineEndOffsetX : 0,
      leadingGapStartMs: leadingGapStart instanceof Date ? leadingGapStart.getTime() : Number.NaN,
      showAreaFill,
      areaFillTopOpacity: Math.max(0, Math.min(1, areaFillTopOpacity)),
      areaFillBottomOpacity: Math.max(0, Math.min(1, areaFillBottomOpacity)),
      areaFillBottomOffset: Math.max(0, Math.min(innerHeight, areaFillBottomOffset)),
      annotations: resolvedAnnotationClusters,
      markerOuterRadius,
      markerInnerRadius,
      markerPulseStyle,
      markerOffsetX,
      markerPulseProgress,
      cursor: cursor
        ? {
            x: cursor.left,
            values: series.reduce<Record<string, number>>((values, seriesItem) => {
              const value = cursor.point[seriesItem.key]
              if (typeof value === 'number' && Number.isFinite(value)) {
                values[seriesItem.key] = value
              }
              return values
            }, {}),
            guideTop: typeof cursorGuideTop === 'number' ? cursorGuideTop : -resolvedMargin.top,
            guideColor: cursorGuideColor,
          }
        : null,
    }),
    [
      alignYAxisLabelsToChartEdge,
      areaFillBottomOffset,
      areaFillBottomOpacity,
      areaFillTopOpacity,
      axisLabelColor,
      axisLabelOpacity,
      centerXAxisTickLabels,
      cursor,
      cursorGuideColor,
      cursorGuideTop,
      data,
      domainBounds.end,
      domainBounds.start,
      formatXAxisTick,
      formatYAxisTick,
      gridLineColor,
      gridLineStyle,
      height,
      hideYAxisMinimumLabel,
      innerHeight,
      leadingGapStart,
      lineCurve,
      lineEndOffsetX,
      lineStrokeWidth,
      markerInnerRadius,
      markerOffsetX,
      markerOuterRadius,
      markerPulseStyle,
      resolvedAnnotationClusters,
      resolvedGridLineOpacity,
      resolvedMargin,
      resolvedXAxisTicks,
      resolvedYAxisTicks,
      series,
      showAreaFill,
      showHorizontalGrid,
      showVerticalGrid,
      showXAxis,
      showXAxisTopRule,
      showXAxisTopRuleFullWidth,
      showYAxis,
      width,
      xAxisLabelsRightInset,
      xAxisTickFontSize,
      yAxisMax,
      yAxisMin,
      yAxisTickFontSize,
    ],
  )

  useLayoutEffect(
    function renderCanvasChart() {
      const canvas = canvasRef.current
      if (!canvas || !isClient) {
        return
      }

      let frameId: number | null = null
      function draw(timestamp: number) {
        const pulseProgress = (timestamp % MARKER_PULSE_DURATION) / MARKER_PULSE_DURATION
        const didDraw = drawPredictionChartCanvas(canvas!, createCanvasFrame(pulseProgress))
        if (didDraw && data.length > 0 && series.length > 0 && !cursor) {
          frameId = window.requestAnimationFrame(draw)
        }
      }
      draw(window.performance.now())

      return function stopCanvasAnimation() {
        if (frameId != null) {
          window.cancelAnimationFrame(frameId)
        }
      }
    },
    [createCanvasFrame, cursor, data.length, isClient, series.length],
  )

  const emitCursorChange = useCallback(
    (point: DataPoint | null) => {
      if (!onCursorDataChange) {
        return
      }
      if (!point) {
        onCursorDataChange(null)
        return
      }

      const values = series.reduce<Record<string, number>>((result, seriesItem) => {
        const value = point[seriesItem.key]
        if (typeof value === 'number' && Number.isFinite(value)) {
          result[seriesItem.key] = value
        }
        return result
      }, {})
      onCursorDataChange({ date: point.date, values } satisfies PredictionChartCursorSnapshot)
    },
    [onCursorDataChange, series],
  )

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!data.length || !series.length) {
        return
      }

      const rect = event.currentTarget.getBoundingClientRect()
      const renderedX = rect.width > 0 ? ((event.clientX - rect.left) / rect.width) * width : 0
      const renderedY = rect.height > 0 ? ((event.clientY - rect.top) / rect.height) * height : 0
      const localX = Math.max(0, Math.min(innerWidth, renderedX - resolvedMargin.left))
      const localY = renderedY - resolvedMargin.top
      const rawTimestamp = domainBounds.start + (localX / innerWidth) * (domainBounds.end - domainBounds.start)
      let targetTimestamp = rawTimestamp

      if (cursorStepMs && cursorStepMs > 0) {
        targetTimestamp = snapTimestampToInterval(rawTimestamp, cursorStepMs, domainBounds.start)
      }
      targetTimestamp = Math.max(domainBounds.start, Math.min(domainBounds.end, targetTimestamp))
      if (clampCursorToDataExtent && dataBounds) {
        targetTimestamp = Math.max(dataBounds.start, Math.min(dataBounds.end, targetTimestamp))
      }

      const targetDate = new Date(targetTimestamp)
      const point = interpolateCursorPoint(
        data,
        series.map((seriesItem) => seriesItem.key),
        targetDate,
      )
      if (!point) {
        return
      }

      const cursorLeft = ((targetTimestamp - domainBounds.start) / (domainBounds.end - domainBounds.start)) * innerWidth
      setCursor({ point, left: cursorLeft })
      emitCursorChange(point)

      const nearestAnnotation = resolvedAnnotationClusters.find((cluster) => {
        const distance = Math.hypot(cluster.x - localX, cluster.y - localY)
        return distance <= Math.max(8, cluster.radius + 4)
      })
      setHoveredAnnotationClusterId(nearestAnnotation?.id ?? null)
    },
    [
      clampCursorToDataExtent,
      cursorStepMs,
      data,
      dataBounds,
      domainBounds.end,
      domainBounds.start,
      emitCursorChange,
      height,
      innerWidth,
      resolvedAnnotationClusters,
      resolvedMargin.left,
      resolvedMargin.top,
      series,
      setHoveredAnnotationClusterId,
      width,
    ],
  )

  const handlePointerEnd = useCallback(() => {
    setCursor(null)
    setHoveredAnnotationClusterId(null)
    emitCursorChange(null)
  }, [emitCursorChange, setHoveredAnnotationClusterId])

  const shouldRenderLegend = showLegend && Boolean(legendContent)
  const shouldRenderWatermark = Boolean(watermark && (watermark.iconSvg || watermark.iconImageUrl || watermark.label))

  return (
    <div className="flex w-full flex-col gap-3">
      <PredictionChartHeader
        shouldRenderLegend={shouldRenderLegend}
        legendContent={legendContent}
        shouldRenderWatermark={shouldRenderWatermark}
        watermark={watermark}
      />

      <div className="relative w-full">
        <canvas
          ref={canvasRef}
          className="block w-full touch-pan-y"
          style={{ height }}
          role="img"
          aria-label="Interactive prediction chart"
          data-chart-renderer="canvas"
          onPointerDown={handlePointerMove}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onPointerLeave={handlePointerEnd}
        />

        <PredictionChartTooltipOverlay
          tooltipActive={Boolean(cursor)}
          tooltipData={cursor?.point ?? null}
          positionedTooltipEntries={positionedTooltipEntries}
          margin={resolvedMargin}
          innerWidth={innerWidth}
          clampedTooltipX={cursor?.left ?? innerWidth}
          valueFormatter={tooltipValueFormatter}
          dateFormatter={tooltipDateFormatter}
          headerFontSize={tooltipHeaderFontSize}
          dateFontSize={tooltipDateFontSize}
          showSeriesLabels={showTooltipSeriesLabels}
          labelVariant={tooltipLabelVariant}
          header={tooltipHeader}
        />

        {hoveredAnnotationCluster && hoveredAnnotationTooltipPosition && (
          <PredictionChartAnnotationTooltip
            cluster={hoveredAnnotationCluster}
            position={hoveredAnnotationTooltipPosition}
          />
        )}
      </div>
    </div>
  )
}
