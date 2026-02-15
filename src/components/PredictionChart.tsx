'use client'

import type { CSSProperties, ReactElement } from 'react'
import type { DataPoint, PredictionChartCursorSnapshot, PredictionChartProps, SeriesConfig } from '@/types/PredictionChartTypes'
import { AxisBottom, AxisRight } from '@visx/axis'
import { curveCatmullRom, curveMonotoneX } from '@visx/curve'
import { localPoint } from '@visx/event'
import { Group } from '@visx/group'
import { scaleLinear, scaleTime } from '@visx/scale'
import { LinePath } from '@visx/shape'
import { useTooltip } from '@visx/tooltip'
import { bisector } from 'd3-array'
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import PredictionChartHeader from '@/components/PredictionChartHeader'
import PredictionChartTooltipOverlay from '@/components/PredictionChartTooltipOverlay'
import {
  arePointsEqual,
  calculateYAxisBounds,
  clamp01,
  DEFAULT_X_AXIS_TICKS,
  DEFAULT_Y_AXIS_MAX,
  INITIAL_REVEAL_DURATION,
  INTERACTION_BASE_REVEAL_DURATION,
  runRevealAnimation,
  snapTimestampToInterval,
  stopRevealAnimation,
  TOOLTIP_LABEL_GAP,
  TOOLTIP_LABEL_HEIGHT,
} from '@/lib/prediction-chart'

export type { PredictionChartCursorSnapshot, SeriesConfig }

const bisectDate = bisector<DataPoint, Date>(d => d.date).left

const defaultMargin = { top: 30, right: 60, bottom: 40, left: 0 }
const FUTURE_LINE_COLOR_DARK = '#2C3F4F'
const FUTURE_LINE_COLOR_LIGHT = '#99A6B5'
const FUTURE_LINE_OPACITY_DARK = 0.55
const FUTURE_LINE_OPACITY_LIGHT = 0.35
const GRID_LINE_COLOR_DARK = '#51677A'
const GRID_LINE_COLOR_LIGHT = '#8F9EAD'
const GRID_LINE_OPACITY_DARK = 0.7
const GRID_LINE_OPACITY_LIGHT = 0.35
const CROSS_FADE_DURATION = 320
const SURGE_DURATION = 760
const SURGE_DASH_RATIO = 0.14
const PATH_SEARCH_STEPS = 22
const PATH_X_EPSILON = 0.35
const MIN_Y_AXIS_TICKS = 3
const PREFERRED_MAX_Y_AXIS_TICKS = 5
const MAX_Y_AXIS_TICKS = 6

function resolvePathPointAtX(path: SVGPathElement, targetX: number) {
  const totalLength = path.getTotalLength()
  if (!Number.isFinite(totalLength) || totalLength <= 0) {
    return null
  }

  const startPoint = path.getPointAtLength(0)
  const endPoint = path.getPointAtLength(totalLength)
  const minX = Math.min(startPoint.x, endPoint.x)
  const maxX = Math.max(startPoint.x, endPoint.x)
  const clampedX = Math.min(Math.max(targetX, minX), maxX)

  let start = 0
  let end = totalLength
  let point = startPoint

  for (let step = 0; step < PATH_SEARCH_STEPS; step += 1) {
    const mid = (start + end) / 2
    point = path.getPointAtLength(mid)
    const delta = point.x - clampedX

    if (Math.abs(delta) <= PATH_X_EPSILON) {
      break
    }

    if (delta < 0) {
      start = mid
    }
    else {
      end = mid
    }
  }

  return point
}

function resolvePointFromPaths(params: {
  basePoint: DataPoint
  series: SeriesConfig[]
  seriesPaths: Record<string, SVGPathElement | null>
  targetX: number
  yScale: { invert: (value: number) => number }
}) {
  const { basePoint, series, seriesPaths, targetX, yScale } = params
  let resolvedPoint = basePoint
  let updated = false

  for (const seriesItem of series) {
    const path = seriesPaths[seriesItem.key]
    if (!path) {
      continue
    }

    const point = resolvePathPointAtX(path, targetX)
    if (!point) {
      continue
    }

    const value = yScale.invert(point.y)
    if (!Number.isFinite(value)) {
      continue
    }

    if (!updated) {
      resolvedPoint = { ...basePoint }
      updated = true
    }

    resolvedPoint[seriesItem.key] = value
  }

  return resolvedPoint
}

export function PredictionChart({
  data: providedData,
  series: providedSeries,
  width = 800,
  height = 400,
  margin = defaultMargin,
  dataSignature,
  onCursorDataChange,
  cursorStepMs,
  xAxisTickCount = DEFAULT_X_AXIS_TICKS,
  xAxisTickValues,
  xAxisTickFormatter,
  xAxisTickFontSize = 11,
  yAxisTickFontSize = 11,
  showXAxisTopRule = false,
  cursorGuideTop,
  autoscale = true,
  showXAxis = true,
  showYAxis = true,
  showHorizontalGrid = true,
  showVerticalGrid = false,
  showAnnotations: _showAnnotations = true,
  leadingGapStart = null,
  legendContent,
  showLegend = true,
  yAxis,
  disableCursorSplit = false,
  disableResetAnimation = false,
  markerOuterRadius = 6,
  markerInnerRadius = 2.8,
  lineStrokeWidth = 1.6,
  lineCurve = 'catmullRom',
  tooltipValueFormatter,
  tooltipDateFormatter,
  showTooltipSeriesLabels = true,
  tooltipHeader,
  watermark,
}: PredictionChartProps): ReactElement {
  const [data, setData] = useState<DataPoint[]>([])
  const [series, setSeries] = useState<SeriesConfig[]>([])
  const [isClient, setIsClient] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(
    () => typeof document !== 'undefined'
      && document.documentElement.classList.contains('dark'),
  )
  const [revealProgress, setRevealProgress] = useState(0)
  const [crossFadeProgress, setCrossFadeProgress] = useState(1)
  const [crossFadeData, setCrossFadeData] = useState<DataPoint[] | null>(null)
  const [surgeActive, setSurgeActive] = useState(false)
  const [revealSeriesKeys, setRevealSeriesKeys] = useState<string[]>([])
  const revealAnimationFrameRef = useRef<number | null>(null)
  const crossFadeFrameRef = useRef<number | null>(null)
  const surgeTimeoutRef = useRef<number | null>(null)
  const surgePendingRef = useRef(false)
  const surgeLengthsRef = useRef<Record<string, number>>({})
  const seriesPathRef = useRef<Record<string, SVGPathElement | null>>({})
  const previousSeriesKeysRef = useRef<string[]>([])
  const dataSignatureRef = useRef<string | number | null>(null)
  const lastDataUpdateTypeRef = useRef<'reset' | 'append' | 'none'>('reset')
  const hasPointerInteractionRef = useRef(false)
  const lastCursorProgressRef = useRef(0)
  const previousDataRef = useRef<DataPoint[] | null>(null)
  const normalizedSignature = dataSignature ?? '__default__'
  const clipId = useId().replace(/:/g, '')
  const leftClipId = `${clipId}-left`
  const rightClipId = `${clipId}-right`
  const shouldRenderLegend = showLegend && Boolean(legendContent)
  const shouldRenderWatermark = Boolean(
    watermark && (watermark.iconSvg || watermark.label),
  )
  const resolvedLineStrokeWidth = Number.isFinite(lineStrokeWidth) && lineStrokeWidth > 0
    ? lineStrokeWidth
    : 1.6
  const resolvedSurgeStrokeWidth = Math.max(resolvedLineStrokeWidth + 1.2, 2.8)
  const emitCursorDataChange = useCallback(
    (point: DataPoint | null) => {
      if (!onCursorDataChange) {
        return
      }

      if (!point) {
        onCursorDataChange(null)
        return
      }

      const values: Record<string, number> = {}

      series.forEach((seriesItem) => {
        const value = point[seriesItem.key]
        if (typeof value === 'number' && Number.isFinite(value)) {
          values[seriesItem.key] = value
        }
      })

      onCursorDataChange({
        date: point.date,
        values,
      })
    },
    [onCursorDataChange, series],
  )
  const resolvedLineCurve = lineCurve === 'monotoneX' ? curveMonotoneX : curveCatmullRom

  const {
    tooltipData,
    tooltipLeft,
    tooltipOpen,
    showTooltip,
    hideTooltip,
  } = useTooltip<DataPoint>()
  const tooltipActive = Boolean(tooltipOpen && tooltipData && tooltipLeft !== undefined)
  const resolvedMargin = useMemo(() => {
    const axisPadding = 12
    return {
      top: margin.top,
      left: margin.left,
      right: showYAxis ? margin.right : Math.min(margin.right, axisPadding),
      bottom: showXAxis ? margin.bottom : Math.min(margin.bottom, axisPadding),
    }
  }, [margin.top, margin.left, margin.right, margin.bottom, showXAxis, showYAxis])
  const plotHeight = Math.max(1, height - resolvedMargin.top - resolvedMargin.bottom)
  const yAxisMinTicks = Math.max(
    MIN_Y_AXIS_TICKS,
    Math.min(PREFERRED_MAX_Y_AXIS_TICKS, Math.round(plotHeight / 56)),
  )
  const { min: defaultYAxisMin, max: defaultYAxisMax, ticks: defaultYAxisTicks } = useMemo(() => {
    if (!autoscale) {
      return {
        min: 0,
        max: DEFAULT_Y_AXIS_MAX,
        ticks: [0, 25, 50, 75, 100],
      }
    }
    return calculateYAxisBounds(data, series, yAxisMinTicks, MAX_Y_AXIS_TICKS)
  }, [autoscale, data, series, yAxisMinTicks])
  const yAxisMin = typeof yAxis?.min === 'number' && Number.isFinite(yAxis.min)
    ? yAxis.min
    : defaultYAxisMin
  const yAxisMax = typeof yAxis?.max === 'number' && Number.isFinite(yAxis.max)
    ? yAxis.max
    : defaultYAxisMax
  const resolvedYAxisTicks = useMemo(() => {
    if (Array.isArray(yAxis?.ticks)) {
      return yAxis.ticks
    }
    return defaultYAxisTicks
  }, [defaultYAxisTicks, yAxis?.ticks])
  const domainBounds = useMemo(() => {
    if (!data.length) {
      return { start: 0, end: 0 }
    }

    let dataStart = data[0].date.getTime()
    let dataEnd = dataStart

    for (let index = 1; index < data.length; index += 1) {
      const value = data[index].date.getTime()
      if (value < dataStart) {
        dataStart = value
      }
      if (value > dataEnd) {
        dataEnd = value
      }
    }
    const leadingStart = leadingGapStart instanceof Date ? leadingGapStart.getTime() : Number.NaN
    const start = Number.isFinite(leadingStart) ? Math.min(dataStart, leadingStart) : dataStart

    return { start, end: dataEnd }
  }, [data, leadingGapStart])

  const getClampedCursorPoint = useCallback(
    (targetDate: Date) => {
      if (!data.length) {
        return null
      }

      const firstPoint = data[0]
      const lastPoint = data[data.length - 1]
      const targetTime = targetDate.getTime()
      const firstTime = firstPoint.date.getTime()
      const lastTime = lastPoint.date.getTime()

      if (!Number.isFinite(targetTime) || !Number.isFinite(firstTime) || !Number.isFinite(lastTime)) {
        return null
      }

      if (targetTime <= firstTime) {
        return { ...firstPoint, date: targetDate }
      }

      if (targetTime >= lastTime) {
        return { ...lastPoint, date: targetDate }
      }

      const index = bisectDate(data, targetDate)
      const previousPoint = data[index - 1] ?? null
      const nextPoint = data[index] ?? null

      if (!previousPoint && !nextPoint) {
        return null
      }

      if (!previousPoint) {
        return { ...nextPoint, date: targetDate }
      }

      if (!nextPoint) {
        return { ...previousPoint, date: targetDate }
      }

      const previousTime = previousPoint.date.getTime()
      const nextTime = nextPoint.date.getTime()
      const span = nextTime - previousTime
      const ratio = span > 0 ? (targetTime - previousTime) / span : 0
      const clampedRatio = Math.max(0, Math.min(1, ratio))
      const interpolated: DataPoint = { date: targetDate }

      series.forEach((seriesItem) => {
        const previousValue = previousPoint[seriesItem.key]
        const nextValue = nextPoint[seriesItem.key]

        if (typeof previousValue === 'number' && typeof nextValue === 'number') {
          interpolated[seriesItem.key] = previousValue + (nextValue - previousValue) * clampedRatio
        }
        else if (typeof previousValue === 'number') {
          interpolated[seriesItem.key] = previousValue
        }
        else if (typeof nextValue === 'number') {
          interpolated[seriesItem.key] = nextValue
        }
      })

      return interpolated
    },
    [data, series],
  )

  const handleTooltip = useCallback(
    (
      event: React.TouchEvent<SVGRectElement> | React.MouseEvent<SVGRectElement>,
    ) => {
      if (!data.length || !series.length) {
        return
      }

      const { x } = localPoint(event) || { x: 0 }
      const innerWidth = width - resolvedMargin.left - resolvedMargin.right
      const innerHeight = height - resolvedMargin.top - resolvedMargin.bottom
      const domainStart = domainBounds.start
      const domainEnd = domainBounds.end

      const xScale = scaleTime<number>({
        range: [0, innerWidth],
        domain: [domainStart, domainEnd],
      })

      const yScale = scaleLinear<number>({
        range: [innerHeight, 0],
        domain: [yAxisMin, yAxisMax],
        nice: true,
      })

      const rawDate = xScale.invert(x - resolvedMargin.left)
      const clampedTime = Math.max(domainStart, Math.min(domainEnd, rawDate.getTime()))
      const localX = x - resolvedMargin.left
      let targetTime = clampedTime
      if (localX >= innerWidth - 1) {
        targetTime = domainEnd
      }
      else if (localX <= 1) {
        targetTime = domainStart
      }
      else if (cursorStepMs && cursorStepMs > 0) {
        const snappedTime = snapTimestampToInterval(clampedTime, cursorStepMs, domainStart)
        const snapThreshold = Math.max(1, cursorStepMs / 2)

        if (domainEnd - clampedTime <= snapThreshold) {
          targetTime = domainEnd
        }
        else if (clampedTime - domainStart <= snapThreshold) {
          targetTime = domainStart
        }
        else {
          targetTime = snappedTime
        }
      }
      const targetDate = new Date(targetTime)
      if (!disableCursorSplit) {
        const domainSpan = Math.max(1, domainEnd - domainStart)
        lastCursorProgressRef.current = clamp01((targetTime - domainStart) / domainSpan)
        hasPointerInteractionRef.current = true
        stopRevealAnimation(revealAnimationFrameRef)
      }
      const tooltipLeftPosition = xScale(targetDate)
      const cursorPoint = getClampedCursorPoint(targetDate)
      const resolvedPoint = cursorPoint
        ? resolvePointFromPaths({
            basePoint: cursorPoint,
            series,
            seriesPaths: seriesPathRef.current,
            targetX: tooltipLeftPosition,
            yScale,
          })
        : null
      const tooltipPoint = resolvedPoint ?? cursorPoint ?? data[0]

      showTooltip({
        tooltipData: tooltipPoint,
        tooltipLeft: tooltipLeftPosition,
        tooltipTop: yScale((tooltipPoint[series[0].key] as number) || 0),
      })

      emitCursorDataChange(resolvedPoint ?? cursorPoint ?? tooltipPoint ?? null)
    },
    [
      showTooltip,
      data,
      width,
      height,
      resolvedMargin.left,
      resolvedMargin.right,
      resolvedMargin.top,
      resolvedMargin.bottom,
      cursorStepMs,
      domainBounds,
      revealAnimationFrameRef,
      getClampedCursorPoint,
      emitCursorDataChange,
      series,
      yAxisMin,
      yAxisMax,
      disableCursorSplit,
    ],
  )

  const dataLength = data.length

  const handleInteractionEnd = useCallback(() => {
    hideTooltip()
    emitCursorDataChange(null)

    if (!dataLength) {
      return
    }

    if (disableCursorSplit) {
      return
    }

    if (!hasPointerInteractionRef.current) {
      return
    }

    hasPointerInteractionRef.current = false

    const startProgress = clamp01(lastCursorProgressRef.current)
    const distance = Math.abs(1 - startProgress)
    const duration = Math.max(400, distance * INTERACTION_BASE_REVEAL_DURATION)

    runRevealAnimation({
      from: startProgress,
      to: 1,
      duration,
      frameRef: revealAnimationFrameRef,
      setProgress: setRevealProgress,
    })
  }, [hideTooltip, emitCursorDataChange, dataLength, revealAnimationFrameRef, disableCursorSplit])

  const registerSeriesPath = useCallback((seriesKey: string) => {
    return (node: SVGPathElement | null) => {
      seriesPathRef.current[seriesKey] = node
    }
  }, [])

  useLayoutEffect(() => {
    queueMicrotask(() => {
      setIsClient(true)
    })
  }, [])

  useEffect(() => {
    if (!isClient) {
      return
    }

    if (providedSeries) {
      setSeries(providedSeries)
    }
    else {
      setSeries([])
    }
  }, [providedSeries, isClient])

  useEffect(() => {
    if (!isClient) {
      return
    }

    if (!providedData || providedData.length === 0) {
      dataSignatureRef.current = normalizedSignature
      setData([])
      lastDataUpdateTypeRef.current = 'reset'
      return
    }

    setData((previousData) => {
      const signatureChanged = dataSignatureRef.current !== normalizedSignature
      if (signatureChanged) {
        dataSignatureRef.current = normalizedSignature
        lastDataUpdateTypeRef.current = 'reset'
        return providedData
      }

      if (previousData.length === 0) {
        lastDataUpdateTypeRef.current = 'reset'
        return providedData
      }

      const previousFirst = previousData[0]?.date?.getTime?.()
      const previousLast = previousData[previousData.length - 1]?.date?.getTime?.()
      const incomingFirst = providedData[0]?.date?.getTime?.()
      const incomingLast = providedData[providedData.length - 1]?.date?.getTime?.()

      const timelineValues = [previousFirst, previousLast, incomingFirst, incomingLast]
      const hasInvalidTimeline = timelineValues.some(
        value => typeof value !== 'number' || !Number.isFinite(value),
      )

      if (hasInvalidTimeline) {
        lastDataUpdateTypeRef.current = 'reset'
        return providedData
      }

      if (
        typeof incomingLast === 'number'
        && typeof previousLast === 'number'
        && incomingLast < previousLast
      ) {
        lastDataUpdateTypeRef.current = 'reset'
        return providedData
      }

      if (
        typeof incomingFirst === 'number'
        && typeof previousFirst === 'number'
        && incomingFirst < previousFirst
      ) {
        lastDataUpdateTypeRef.current = 'reset'
        return providedData
      }

      let nextData = previousData
      let didTrim = false

      if (
        typeof incomingFirst === 'number'
        && typeof previousFirst === 'number'
        && incomingFirst > previousFirst
      ) {
        const firstIndexToKeep = previousData.findIndex(point => point.date.getTime() >= incomingFirst)
        if (firstIndexToKeep === -1) {
          nextData = []
          didTrim = previousData.length > 0
        }
        else if (firstIndexToKeep > 0) {
          nextData = previousData.slice(firstIndexToKeep)
          didTrim = true
        }
      }

      const lastTimestamp = nextData.length
        ? nextData[nextData.length - 1].date.getTime()
        : null

      const appendedPoints = providedData.filter((point) => {
        const timestamp = point.date.getTime()
        if (!Number.isFinite(timestamp)) {
          return false
        }

        if (lastTimestamp === null) {
          return true
        }

        return timestamp > lastTimestamp
      })

      if (appendedPoints.length > 0) {
        lastDataUpdateTypeRef.current = 'append'
        return [...nextData, ...appendedPoints]
      }

      if (didTrim) {
        lastDataUpdateTypeRef.current = 'append'
        return nextData
      }

      if (lastTimestamp !== null && nextData.length > 0) {
        const latestPoint = nextData[nextData.length - 1]
        const incomingLatestPoint = providedData[providedData.length - 1]
        if (
          incomingLatestPoint
          && incomingLatestPoint.date.getTime() === lastTimestamp
          && !arePointsEqual(latestPoint, incomingLatestPoint)
        ) {
          lastDataUpdateTypeRef.current = 'append'
          return [...nextData.slice(0, -1), incomingLatestPoint]
        }
      }

      lastDataUpdateTypeRef.current = 'none'
      return previousData
    })
  }, [providedData, normalizedSignature, isClient])

  useEffect(
    () => () => stopRevealAnimation(revealAnimationFrameRef),
    [revealAnimationFrameRef],
  )

  useEffect(
    () => () => stopRevealAnimation(crossFadeFrameRef),
    [crossFadeFrameRef],
  )

  useEffect(() => {
    return () => {
      if (surgeTimeoutRef.current) {
        window.clearTimeout(surgeTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (data.length === 0) {
      stopRevealAnimation(revealAnimationFrameRef)
      stopRevealAnimation(crossFadeFrameRef)
      setRevealProgress(0)
      setCrossFadeProgress(1)
      setCrossFadeData(null)
      surgePendingRef.current = false
      setSurgeActive(false)
      setRevealSeriesKeys([])
      previousSeriesKeysRef.current = series.map(item => item.key)
      lastDataUpdateTypeRef.current = 'reset'
      previousDataRef.current = data
      return
    }

    const updateType = lastDataUpdateTypeRef.current
    const previousData = previousDataRef.current
    const currentSeriesKeys = series.map(item => item.key)
    const previousSeriesKeys = previousSeriesKeysRef.current
    const addedSeries = currentSeriesKeys.filter(key => !previousSeriesKeys.includes(key))
    const removedSeries = previousSeriesKeys.filter(key => !currentSeriesKeys.includes(key))
    const seriesChanged = addedSeries.length > 0 || removedSeries.length > 0
    const hasPreviousSeries = previousSeriesKeys.length > 0
    const shouldPartialReveal = seriesChanged && addedSeries.length > 0 && hasPreviousSeries
    const nextRevealSeries = currentSeriesKeys

    setRevealSeriesKeys(nextRevealSeries)
    previousSeriesKeysRef.current = currentSeriesKeys
    const shouldRunSurge = updateType === 'reset' && !disableResetAnimation
    surgePendingRef.current = shouldRunSurge

    const canUseCrossFade = updateType === 'reset'
      && !disableResetAnimation
      && previousData
      && previousData.length > 0
      && !shouldPartialReveal
      && currentSeriesKeys.length <= 1

    if (canUseCrossFade) {
      hasPointerInteractionRef.current = false
      lastCursorProgressRef.current = 0
      stopRevealAnimation(revealAnimationFrameRef)
      setRevealProgress(1)
      setCrossFadeData(previousData)
      runRevealAnimation({
        from: 0,
        to: 1,
        duration: CROSS_FADE_DURATION,
        frameRef: crossFadeFrameRef,
        setProgress: setCrossFadeProgress,
      })
    }
    else {
      stopRevealAnimation(crossFadeFrameRef)
      setCrossFadeProgress(1)
      setCrossFadeData(null)

      if (updateType === 'reset' && !disableResetAnimation) {
        hasPointerInteractionRef.current = false
        lastCursorProgressRef.current = 0
        runRevealAnimation({
          from: 0,
          to: 1,
          duration: INITIAL_REVEAL_DURATION,
          frameRef: revealAnimationFrameRef,
          setProgress: setRevealProgress,
        })
      }
      else {
        stopRevealAnimation(revealAnimationFrameRef)
        setRevealProgress(1)
      }
    }

    lastDataUpdateTypeRef.current = 'none'
    previousDataRef.current = data
  }, [data, series, revealAnimationFrameRef, crossFadeFrameRef, disableResetAnimation])

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    const root = document.documentElement

    function updateTheme() {
      setIsDarkMode(root.classList.contains('dark'))
    }

    updateTheme()

    const observer = new MutationObserver(updateTheme)
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (crossFadeData && crossFadeProgress >= 0.999) {
      setCrossFadeData(null)
    }
  }, [crossFadeData, crossFadeProgress])

  const crossFadeAnimating = Boolean(crossFadeData && crossFadeProgress < 0.999)
  const revealSeriesSet = useMemo(() => new Set(revealSeriesKeys), [revealSeriesKeys])
  const surgeFilter = isDarkMode
    ? 'drop-shadow(0 0 2px rgba(255, 255, 255, 0.75))'
    : 'drop-shadow(0 0 1.5px rgba(15, 23, 42, 0.45))'

  const resolveSurgeColor = useCallback((_color: string) => {
    if (isDarkMode) {
      return 'rgba(255, 255, 255, 0.82)'
    }
    return 'rgba(15, 23, 42, 0.55)'
  }, [isDarkMode])

  useEffect(() => {
    if (!surgePendingRef.current) {
      return
    }

    if (revealProgress < 0.999) {
      return
    }

    if (crossFadeAnimating || tooltipActive || data.length < 2 || series.length === 0 || revealSeriesKeys.length === 0) {
      return
    }

    surgePendingRef.current = false

    const nextLengths: Record<string, number> = {}
    revealSeriesKeys.forEach((seriesKey) => {
      const node = seriesPathRef.current[seriesKey]
      if (node) {
        nextLengths[seriesKey] = node.getTotalLength()
      }
    })

    if (Object.keys(nextLengths).length === 0) {
      return
    }

    surgeLengthsRef.current = nextLengths

    setSurgeActive(true)

    if (surgeTimeoutRef.current) {
      window.clearTimeout(surgeTimeoutRef.current)
    }

    surgeTimeoutRef.current = window.setTimeout(() => {
      setSurgeActive(false)
    }, SURGE_DURATION)
  }, [revealProgress, crossFadeAnimating, tooltipActive, data.length, series, revealSeriesKeys])

  const firstFinitePointBySeries = useMemo(() => {
    const result: Record<string, DataPoint | null> = {}

    if (!data.length || !series.length) {
      return result
    }

    series.forEach((seriesItem) => {
      result[seriesItem.key] = null
    })

    let remaining = series.length

    for (const point of data) {
      if (remaining === 0) {
        break
      }

      for (const seriesItem of series) {
        if (result[seriesItem.key]) {
          continue
        }

        const value = point[seriesItem.key]
        if (typeof value === 'number' && Number.isFinite(value)) {
          result[seriesItem.key] = point
          remaining -= 1
          if (remaining === 0) {
            break
          }
        }
      }
    }

    return result
  }, [data, series])
  const resolvedXAxisTickValues = useMemo(() => {
    if (!Array.isArray(xAxisTickValues) || xAxisTickValues.length === 0) {
      return null
    }

    const filtered = xAxisTickValues
      .filter((tick) => {
        const timestamp = tick.getTime()
        return Number.isFinite(timestamp)
          && timestamp >= domainBounds.start
          && timestamp <= domainBounds.end
      })
      .sort((a, b) => a.getTime() - b.getTime())

    return filtered.length >= 2 ? filtered : null
  }, [domainBounds.end, domainBounds.start, xAxisTickValues])

  if (!isClient || data.length === 0 || series.length === 0) {
    return (
      <div className="relative size-full">
        <svg width="100%" height={height}>
          <rect width="100%" height={height} fill="transparent" />
        </svg>
      </div>
    )
  }

  const innerWidth = width - resolvedMargin.left - resolvedMargin.right
  const innerHeight = height - resolvedMargin.top - resolvedMargin.bottom

  const xScale = scaleTime<number>({
    range: [0, innerWidth],
    domain: [domainBounds.start, domainBounds.end],
  })

  const yScale = scaleLinear<number>({
    range: [innerHeight, 0],
    domain: [yAxisMin, yAxisMax],
    nice: true,
  })

  const clampedTooltipX = tooltipActive
    ? Math.max(0, Math.min(tooltipLeft as number, innerWidth))
    : innerWidth
  const cursorDate = tooltipActive
    ? xScale.invert(clampedTooltipX)
    : null
  const shouldSplitByCursor = !disableCursorSplit && Boolean(tooltipActive && cursorDate)
  const leftClipWidth = shouldSplitByCursor ? clampedTooltipX : innerWidth
  const rightClipWidth = shouldSplitByCursor ? Math.max(0, innerWidth - clampedTooltipX) : 0
  const domainSpan = Math.max(1, domainBounds.end - domainBounds.start)
  const revealTime = domainBounds.start + domainSpan * clamp01(revealProgress)
  const dashedSplitTime = tooltipActive && cursorDate
    ? cursorDate.getTime()
    : revealTime
  const cursorPoint = shouldSplitByCursor && cursorDate
    ? getClampedCursorPoint(cursorDate)
    : null
  const effectiveTooltipData = tooltipData ?? cursorPoint ?? null

  let coloredPoints: DataPoint[] = data
  let mutedPoints: DataPoint[] = []

  if (disableCursorSplit) {
    coloredPoints = data
    mutedPoints = []
  }
  else if (shouldSplitByCursor) {
    coloredPoints = data
    mutedPoints = data
  }
  else if (data.length > 0) {
    const totalSegments = Math.max(1, data.length - 1)
    const revealIndex = Math.round(totalSegments * clamp01(revealProgress))
    const clampedIndex = Math.min(revealIndex, data.length - 1)

    coloredPoints = data.slice(0, clampedIndex + 1)
    mutedPoints = data.slice(clampedIndex + 1)

    if (coloredPoints.length === 0) {
      coloredPoints = [data[0]]
    }
  }

  const lastDataPoint = data.length > 0 ? data[data.length - 1] : null
  const isTooltipAtLastPoint = tooltipActive
    && lastDataPoint !== null
    && effectiveTooltipData !== null
    && effectiveTooltipData.date.getTime() === lastDataPoint.date.getTime()
  const canShowMarkers = Boolean(lastDataPoint)
    && (disableCursorSplit || !tooltipActive || isTooltipAtLastPoint)
  const crossFadeActive = Boolean(crossFadeData && crossFadeProgress < 0.999 && !shouldSplitByCursor)
  const crossFadeIn = crossFadeActive ? crossFadeProgress : 1
  const crossFadeOut = crossFadeActive ? 1 - crossFadeProgress : 0
  const totalDurationHours = data.length > 1
    ? (data[data.length - 1].date.valueOf() - data[0].date.valueOf()) / 36e5
    : 0
  const isMonthOnlyLabels = totalDurationHours > 24 * 45
  const verticalGridTicks = showVerticalGrid
    ? (
        resolvedXAxisTickValues
        ?? xScale.ticks(Math.max(2, xAxisTickCount * 2))
      )
    : []

  function formatAxisTick(value: number | { valueOf: () => number }) {
    const numericValue = typeof value === 'number' ? value : value.valueOf()
    const date = new Date(numericValue)

    if (xAxisTickFormatter) {
      return xAxisTickFormatter(date)
    }

    if (totalDurationHours <= 48) {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      })
    }

    if (totalDurationHours <= 24 * 45) {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    }

    return date.toLocaleDateString('en-US', {
      month: 'short',
    })
  }

  interface TooltipEntry {
    key: string
    name: string
    color: string
    value: number
    initialTop: number
  }
  type PositionedTooltipEntry = TooltipEntry & { top: number }

  const tooltipEntries: TooltipEntry[] = tooltipActive && effectiveTooltipData
    ? series
        .map((seriesItem) => {
          const value = effectiveTooltipData[seriesItem.key]
          if (typeof value !== 'number') {
            return null
          }

          return {
            key: seriesItem.key,
            name: seriesItem.name,
            color: seriesItem.color,
            value,
            initialTop: resolvedMargin.top
              + yScale(value)
              - TOOLTIP_LABEL_HEIGHT,
          }
        })
        .filter((entry): entry is TooltipEntry => entry !== null)
    : []

  let positionedTooltipEntries: PositionedTooltipEntry[] = []
  if (tooltipEntries.length > 0) {
    const sorted = [...tooltipEntries].sort(
      (a, b) => a.initialTop - b.initialTop,
    )

    const minTop = resolvedMargin.top
    const rawMaxTop = resolvedMargin.top + innerHeight - TOOLTIP_LABEL_HEIGHT
    const maxTop = rawMaxTop < minTop ? minTop : rawMaxTop
    const step = TOOLTIP_LABEL_HEIGHT + TOOLTIP_LABEL_GAP

    const positioned: PositionedTooltipEntry[] = []
    sorted.forEach((entry, index) => {
      const clampedDesired = Math.max(
        minTop,
        Math.min(entry.initialTop, maxTop),
      )
      const previousTop = index > 0 ? positioned[index - 1].top : null
      const top = previousTop === null
        ? clampedDesired
        : Math.max(clampedDesired, previousTop + step)

      positioned.push({
        ...entry,
        top,
      })
    })

    if (positioned.length > 0) {
      const lastIndex = positioned.length - 1
      const overflow = positioned[lastIndex].top - maxTop
      if (overflow > 0) {
        for (let i = 0; i < positioned.length; i += 1) {
          positioned[i].top -= overflow
        }
      }

      const underflow = minTop - positioned[0].top
      if (underflow > 0) {
        for (let i = 0; i < positioned.length; i += 1) {
          positioned[i].top += underflow
        }
      }
    }

    positionedTooltipEntries = positioned
  }

  function getDate(d: DataPoint) {
    return d.date
  }

  function getX(d: DataPoint) {
    return xScale(getDate(d))
  }

  const futureLineColor = isDarkMode
    ? FUTURE_LINE_COLOR_DARK
    : FUTURE_LINE_COLOR_LIGHT
  const futureLineOpacity = isDarkMode
    ? FUTURE_LINE_OPACITY_DARK
    : FUTURE_LINE_OPACITY_LIGHT
  const gridLineColor = isDarkMode
    ? GRID_LINE_COLOR_DARK
    : GRID_LINE_COLOR_LIGHT
  const gridLineOpacity = isDarkMode
    ? GRID_LINE_OPACITY_DARK
    : GRID_LINE_OPACITY_LIGHT
  const axisLabelColor = gridLineColor
  const axisLabelOpacity = Math.min(1, gridLineOpacity + 0.25)
  const leadingGapStartMs = leadingGapStart instanceof Date ? leadingGapStart.getTime() : Number.NaN
  const clipPadding = 2
  const resolvedCursorGuideTop = typeof cursorGuideTop === 'number'
    ? cursorGuideTop
    : -resolvedMargin.top

  return (
    <div className="flex w-full flex-col gap-3">
      <PredictionChartHeader
        shouldRenderLegend={shouldRenderLegend}
        legendContent={legendContent}
        shouldRenderWatermark={shouldRenderWatermark}
        watermark={watermark}
      />

      <div className="relative w-full">
        <svg
          width="100%"
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          style={{ overflow: 'visible' }}
        >
          <defs>
            <clipPath id={leftClipId} clipPathUnits="userSpaceOnUse">
              <rect
                x={0}
                y={-clipPadding}
                width={leftClipWidth}
                height={innerHeight + clipPadding * 2}
              />
            </clipPath>
            <clipPath id={rightClipId} clipPathUnits="userSpaceOnUse">
              <rect
                x={leftClipWidth}
                y={-clipPadding}
                width={rightClipWidth}
                height={innerHeight + clipPadding * 2}
              />
            </clipPath>
          </defs>
          <Group left={resolvedMargin.left} top={resolvedMargin.top}>
            {showVerticalGrid && verticalGridTicks.map((tick) => {
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
                  strokeDasharray="1,3"
                  opacity={gridLineOpacity}
                />
              )
            })}

            {showHorizontalGrid && resolvedYAxisTicks.map(value => (
              <line
                key={`grid-${value}`}
                x1={0}
                x2={innerWidth}
                y1={yScale(value)}
                y2={yScale(value)}
                stroke={gridLineColor}
                strokeWidth={1}
                strokeDasharray="1,3"
                opacity={gridLineOpacity}
              />
            ))}

            {series.map((seriesItem) => {
              const seriesColor = seriesItem.color
              const isSeriesRevealing = revealProgress < 0.999 || revealSeriesSet.has(seriesItem.key)
              const seriesColoredPoints = isSeriesRevealing ? coloredPoints : data
              const seriesMutedPoints = isSeriesRevealing ? mutedPoints : []
              const surgeLength = surgeLengthsRef.current[seriesItem.key]
              const surgeDashLength = typeof surgeLength === 'number' && Number.isFinite(surgeLength)
                ? Math.max(18, surgeLength * SURGE_DASH_RATIO)
                : 0
              const surgeDashGap = surgeLength ?? 0
              const shouldRenderSurge = Boolean(
                surgeActive
                && isSeriesRevealing
                && !crossFadeActive
                && !shouldSplitByCursor
                && seriesMutedPoints.length === 0
                && seriesColoredPoints.length > 1
                && surgeLength
                && surgeDashLength > 0,
              )
              const firstPoint = firstFinitePointBySeries[seriesItem.key] ?? null
              const firstPointTime = firstPoint?.date.getTime()
              const hasLeadingGap = Number.isFinite(leadingGapStartMs)
                && typeof firstPointTime === 'number'
                && Number.isFinite(firstPointTime)
                && leadingGapStartMs < firstPointTime
              const ghostOpacity = crossFadeOut
              const seriesSplitTime = isSeriesRevealing ? dashedSplitTime : Number.POSITIVE_INFINITY
              let dashedColoredPoints: DataPoint[] | null = null
              let dashedMutedPoints: DataPoint[] | null = null

              if (hasLeadingGap && firstPoint) {
                const firstValue = firstPoint[seriesItem.key] as number
                const startPoint: DataPoint = { date: new Date(leadingGapStartMs), [seriesItem.key]: firstValue }
                const endPoint: DataPoint = { date: firstPoint.date, [seriesItem.key]: firstValue }

                if (seriesSplitTime <= leadingGapStartMs) {
                  dashedMutedPoints = [startPoint, endPoint]
                }
                else if (seriesSplitTime >= firstPointTime) {
                  dashedColoredPoints = [startPoint, endPoint]
                }
                else {
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
                      x={d => xScale(getDate(d))}
                      y={d => yScale((d[seriesItem.key] as number) || 0)}
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
                      x={d => xScale(getDate(d))}
                      y={d => yScale(d[seriesItem.key] as number)}
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
                      x={d => xScale(getDate(d))}
                      y={d => yScale(d[seriesItem.key] as number)}
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

                  {shouldSplitByCursor
                    ? (
                        <>
                          <LinePath<DataPoint>
                            data={data}
                            x={d => xScale(getDate(d))}
                            y={d => yScale((d[seriesItem.key] as number) || 0)}
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
                            x={d => xScale(getDate(d))}
                            y={d => yScale((d[seriesItem.key] as number) || 0)}
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
                      )
                    : (
                        <>
                          {seriesMutedPoints.length > 1 && (
                            <LinePath<DataPoint>
                              data={seriesMutedPoints}
                              x={d => xScale(getDate(d))}
                              y={d => yScale((d[seriesItem.key] as number) || 0)}
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
                      x={d => xScale(getDate(d))}
                      y={d => yScale((d[seriesItem.key] as number) || 0)}
                      curve={resolvedLineCurve}
                    >
                      {({ path }) => {
                        const pathDefinition = path(seriesColoredPoints)
                        if (!pathDefinition) {
                          return null
                        }

                        return (
                          <>
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
                                style={{
                                  'animation': `prediction-chart-surge ${SURGE_DURATION}ms ease-out`,
                                  '--surge-offset-start': '0',
                                  '--surge-offset-end': `${-(surgeLength + surgeDashLength)}`,
                                  'filter': surgeFilter,
                                } as CSSProperties}
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

            {canShowMarkers
              && lastDataPoint
              && series.map((seriesItem) => {
                const isSeriesRevealing = revealSeriesSet.has(seriesItem.key)
                const seriesMutedPoints = isSeriesRevealing ? mutedPoints : []
                const shouldShowMarker = (seriesMutedPoints.length === 0 || shouldSplitByCursor)
                  && !(surgeActive && isSeriesRevealing)

                if (!shouldShowMarker) {
                  return null
                }

                const value = (lastDataPoint[seriesItem.key] as number) || 0
                const cx = getX(lastDataPoint)
                const cy = yScale(value)

                return (
                  <g key={`${seriesItem.key}-marker`} transform={`translate(${cx}, ${cy})`}>
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

            {showYAxis && (
              <AxisRight
                left={innerWidth}
                scale={yScale}
                tickFormat={(value) => {
                  const numericValue = typeof value === 'number' ? value : value.valueOf()
                  const formatter = yAxis?.tickFormat ?? (v => `${v}%`)
                  return formatter(numericValue)
                }}
                tickValues={resolvedYAxisTicks}
                stroke="transparent"
                tickStroke="transparent"
                tickLabelProps={{
                  fill: axisLabelColor,
                  fontSize: yAxisTickFontSize,
                  fontFamily: 'Arial, sans-serif',
                  textAnchor: 'start',
                  dy: '0.33em',
                  dx: '0.5em',
                  opacity: axisLabelOpacity,
                }}
                tickLength={0}
              />
            )}

            {showXAxis && (
              <>
                {showXAxisTopRule && (
                  <line
                    x1={0}
                    x2={innerWidth}
                    y1={innerHeight}
                    y2={innerHeight}
                    stroke={gridLineColor}
                    strokeWidth={1}
                    opacity={Math.min(1, gridLineOpacity + 0.2)}
                  />
                )}
                <AxisBottom
                  top={innerHeight}
                  scale={xScale}
                  tickFormat={formatAxisTick}
                  tickValues={resolvedXAxisTickValues ?? undefined}
                  stroke="transparent"
                  tickStroke="transparent"
                  tickLabelProps={(_value, index, values) => {
                    const lastIndex = Array.isArray(values) ? values.length - 1 : -1
                    const textAnchor = index === 0
                      ? 'start'
                      : index === lastIndex
                        ? 'end'
                        : 'middle'

                    const hideFirstMonthLabel = isMonthOnlyLabels && index === 0
                    return {
                      fill: axisLabelColor,
                      fontSize: xAxisTickFontSize,
                      fontFamily: 'Arial, sans-serif',
                      textAnchor,
                      dy: showXAxisTopRule ? '1.05em' : '0.6em',
                      opacity: hideFirstMonthLabel ? 0 : axisLabelOpacity,
                    }
                  }}
                  numTicks={xAxisTickCount}
                  tickLength={0}
                />
              </>
            )}

            <rect
              x={-4}
              y={0}
              width={innerWidth + 8}
              height={innerHeight}
              fill="transparent"
              onTouchStart={handleTooltip}
              onTouchMove={handleTooltip}
              onMouseMove={handleTooltip}
              onMouseLeave={handleInteractionEnd}
              onTouchEnd={handleInteractionEnd}
              onTouchCancel={handleInteractionEnd}
            />

            {tooltipActive && (
              <line
                x1={clampedTooltipX}
                x2={clampedTooltipX}
                y1={resolvedCursorGuideTop}
                y2={innerHeight}
                stroke="#2C3F4F"
                strokeWidth={1.5}
                opacity={0.9}
                pointerEvents="none"
              />
            )}

            {tooltipActive
              && positionedTooltipEntries.map(entry => (
                <circle
                  key={`${entry.key}-tooltip-circle`}
                  cx={clampedTooltipX}
                  cy={yScale(entry.value)}
                  r={4}
                  fill={entry.color}
                  stroke={entry.color}
                  strokeOpacity={0.1}
                  strokeWidth={2}
                  pointerEvents="none"
                />
              ))}

          </Group>
        </svg>

        <PredictionChartTooltipOverlay
          tooltipActive={tooltipActive}
          tooltipData={effectiveTooltipData}
          positionedTooltipEntries={positionedTooltipEntries}
          margin={resolvedMargin}
          innerWidth={innerWidth}
          clampedTooltipX={clampedTooltipX}
          valueFormatter={tooltipValueFormatter}
          dateFormatter={tooltipDateFormatter}
          showSeriesLabels={showTooltipSeriesLabels}
          header={tooltipHeader}
        />
      </div>
    </div>
  )
}

export default PredictionChart
