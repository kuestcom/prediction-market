import type { DataPoint, SeriesConfig } from '@/types/PredictionChartTypes'

interface CanvasChartPoint {
  x: number
  y: number
}

interface CanvasChartAnnotation {
  color: string
  radius: number
  x: number
  y: number
}

export interface PredictionChartCanvasFrame {
  width: number
  height: number
  margin: { top: number; right: number; bottom: number; left: number }
  data: DataPoint[]
  series: SeriesConfig[]
  domainStart: number
  domainEnd: number
  yMin: number
  yMax: number
  yTicks: number[]
  xTicks: Date[]
  formatXTick: (date: Date) => string
  formatYTick: (value: number) => string
  showXAxis: boolean
  showYAxis: boolean
  showHorizontalGrid: boolean
  showVerticalGrid: boolean
  showXAxisTopRule: boolean
  showXAxisTopRuleFullWidth: boolean
  hideYAxisMinimumLabel: boolean
  alignYAxisLabelsToChartEdge: boolean
  xAxisTickFontSize: number
  yAxisTickFontSize: number
  centerXAxisTickLabels: boolean
  xAxisLabelsRightInset: number
  gridLineStyle: 'dashed' | 'solid'
  gridLineColor: string
  gridLineOpacity: number
  axisLabelColor: string
  axisLabelOpacity: number
  lineCurve: 'catmullRom' | 'monotoneX' | 'basis'
  lineStrokeWidth: number
  lineEndOffsetX: number
  leadingGapStartMs: number
  showAreaFill: boolean
  areaFillTopOpacity: number
  areaFillBottomOpacity: number
  areaFillBottomOffset: number
  annotations: CanvasChartAnnotation[]
  markerOuterRadius: number
  markerInnerRadius: number
  markerPulseStyle: 'filled' | 'ring'
  markerOffsetX: number
  markerPulseProgress: number
  cursor: {
    x: number
    values: Record<string, number>
    guideTop: number
    guideColor: string
  } | null
  cursorSplit: {
    color: string
    opacity: number
  } | null
}

function resolveCssColor(canvas: HTMLCanvasElement, color: string, fallback: string) {
  if (!color.startsWith('var(')) {
    return color
  }

  const match = color.match(/^var\((--[^,\s)]+)(?:,\s*([^)]+))?\)$/)
  if (!match) {
    return fallback
  }

  const resolved = getComputedStyle(canvas).getPropertyValue(match[1]).trim()
  return resolved || match[2]?.trim() || fallback
}

function withOpacity(color: string, opacity: number) {
  if (color.startsWith('#')) {
    const hex = color.slice(1)
    const normalized =
      hex.length === 3
        ? hex
            .split('')
            .map((value) => `${value}${value}`)
            .join('')
        : hex.slice(0, 6)
    if (/^[0-9a-f]{6}$/i.test(normalized)) {
      const red = Number.parseInt(normalized.slice(0, 2), 16)
      const green = Number.parseInt(normalized.slice(2, 4), 16)
      const blue = Number.parseInt(normalized.slice(4, 6), 16)
      return `rgba(${red}, ${green}, ${blue}, ${opacity})`
    }
  }

  return color
}

function scaleX(frame: PredictionChartCanvasFrame, timestamp: number) {
  const innerWidth = Math.max(1, frame.width - frame.margin.left - frame.margin.right)
  const ratio = (timestamp - frame.domainStart) / Math.max(1, frame.domainEnd - frame.domainStart)
  const baseX = Math.max(0, Math.min(innerWidth, ratio * innerWidth))
  return frame.margin.left + baseX
}

function scaleSeriesX(frame: PredictionChartCanvasFrame, timestamp: number) {
  const innerWidth = Math.max(1, frame.width - frame.margin.left - frame.margin.right)
  const baseX = scaleX(frame, timestamp) - frame.margin.left
  const offsetProgress = innerWidth > 0 ? baseX / innerWidth : 1
  return frame.margin.left + baseX + frame.lineEndOffsetX * offsetProgress
}

function scaleY(frame: PredictionChartCanvasFrame, value: number) {
  const innerHeight = Math.max(1, frame.height - frame.margin.top - frame.margin.bottom)
  const ratio = (value - frame.yMin) / Math.max(Number.EPSILON, frame.yMax - frame.yMin)
  return frame.margin.top + innerHeight - Math.max(0, Math.min(1, ratio)) * innerHeight
}

function buildSeriesSegments(frame: PredictionChartCanvasFrame, seriesKey: string) {
  return frame.data
    .reduce<CanvasChartPoint[][]>((segments, point) => {
      const value = point[seriesKey]
      const timestamp = point.date.getTime()

      if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isFinite(timestamp)) {
        if ((segments.at(-1)?.length ?? 0) > 0) {
          segments.push([])
        }
        return segments
      }

      const current = segments.at(-1) ?? []
      if (current.length === 0) {
        segments.push(current)
      }
      current.push({ x: scaleSeriesX(frame, timestamp), y: scaleY(frame, value) })
      return segments
    }, [])
    .filter((segment) => segment.length > 0)
}

function traceLinearPath(context: CanvasRenderingContext2D, points: CanvasChartPoint[]) {
  context.moveTo(points[0].x, points[0].y)
  for (let index = 1; index < points.length; index += 1) {
    context.lineTo(points[index].x, points[index].y)
  }
}

function traceMonotonePath(context: CanvasRenderingContext2D, points: CanvasChartPoint[]) {
  context.moveTo(points[0].x, points[0].y)

  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index]
    const next = points[index + 1]
    const middleX = (current.x + next.x) / 2
    context.bezierCurveTo(middleX, current.y, middleX, next.y, next.x, next.y)
  }
}

function traceCatmullRomPath(context: CanvasRenderingContext2D, points: CanvasChartPoint[]) {
  context.moveTo(points[0].x, points[0].y)

  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[Math.max(0, index - 1)]
    const current = points[index]
    const next = points[index + 1]
    const following = points[Math.min(points.length - 1, index + 2)]
    const segmentWidth = next.x - current.x
    const controlOneX = current.x + segmentWidth / 3
    const controlOneY = current.y + (next.y - previous.y) / 6
    const controlTwoX = next.x - segmentWidth / 3
    const controlTwoY = next.y - (following.y - current.y) / 6

    context.bezierCurveTo(controlOneX, controlOneY, controlTwoX, controlTwoY, next.x, next.y)
  }
}

function traceSeriesPath(
  context: CanvasRenderingContext2D,
  points: CanvasChartPoint[],
  curve: PredictionChartCanvasFrame['lineCurve'],
) {
  if (points.length < 2) {
    return
  }

  if (curve === 'monotoneX') {
    traceMonotonePath(context, points)
    return
  }

  if (curve === 'catmullRom' || curve === 'basis') {
    traceCatmullRomPath(context, points)
    return
  }

  traceLinearPath(context, points)
}

function drawGrid(context: CanvasRenderingContext2D, frame: PredictionChartCanvasFrame) {
  const innerWidth = Math.max(1, frame.width - frame.margin.left - frame.margin.right)
  const innerHeight = Math.max(1, frame.height - frame.margin.top - frame.margin.bottom)
  context.save()
  context.strokeStyle = resolveCssColor(context.canvas, frame.gridLineColor, '#77808d')
  context.globalAlpha = frame.gridLineOpacity
  context.lineWidth = 1
  context.setLineDash(frame.gridLineStyle === 'dashed' ? [1, 3] : [])
  context.beginPath()

  if (frame.showHorizontalGrid) {
    frame.yTicks.forEach((tick) => {
      const y = Math.round(scaleY(frame, tick)) + 0.5
      context.moveTo(frame.margin.left, y)
      context.lineTo(frame.margin.left + innerWidth, y)
    })
  }

  if (frame.showVerticalGrid) {
    frame.xTicks.forEach((tick) => {
      const x = Math.round(scaleX(frame, tick.getTime())) + 0.5
      context.moveTo(x, frame.margin.top)
      context.lineTo(x, frame.margin.top + innerHeight)
    })
  }

  context.stroke()
  context.restore()
}

function drawArea(
  context: CanvasRenderingContext2D,
  frame: PredictionChartCanvasFrame,
  points: CanvasChartPoint[],
  color: string,
) {
  if (!frame.showAreaFill || points.length < 2) {
    return
  }

  const bottom = frame.height - frame.margin.bottom - frame.areaFillBottomOffset
  context.save()
  context.beginPath()
  traceSeriesPath(context, points, frame.lineCurve)
  context.lineTo(points.at(-1)!.x, bottom)
  context.lineTo(points[0].x, bottom)
  context.closePath()

  const gradient = context.createLinearGradient(0, frame.margin.top, 0, bottom)
  gradient.addColorStop(0, withOpacity(color, frame.areaFillTopOpacity))
  gradient.addColorStop(1, withOpacity(color, frame.areaFillBottomOpacity))
  context.fillStyle = gradient
  context.fill()
  context.restore()
}

function drawSeries(context: CanvasRenderingContext2D, frame: PredictionChartCanvasFrame) {
  const plotLeft = frame.margin.left
  const plotTop = frame.margin.top
  const plotWidth = Math.max(1, frame.width - frame.margin.left - frame.margin.right)
  const plotHeight = Math.max(1, frame.height - frame.margin.top - frame.margin.bottom)

  context.save()
  context.beginPath()
  context.rect(plotLeft - 4, plotTop - 4, plotWidth + 8, plotHeight + 8)
  context.clip()

  frame.series.forEach((seriesItem) => {
    const color = resolveCssColor(context.canvas, seriesItem.color, '#1452f0')
    const segments = buildSeriesSegments(frame, seriesItem.key)
    const splitX = frame.cursor && frame.cursorSplit ? frame.margin.left + frame.cursor.x : null

    segments.forEach((points) => {
      if (points.length < 2) {
        return
      }

      function drawStroke(
        strokeColor: string,
        strokeWidth: number,
        opacity: number,
        clipLeft: number,
        clipWidth: number,
      ) {
        if (clipWidth <= 0) {
          return
        }

        context.save()
        context.beginPath()
        context.rect(clipLeft, plotTop - 4, clipWidth, plotHeight + 8)
        context.clip()
        context.beginPath()
        traceSeriesPath(context, points, frame.lineCurve)
        context.strokeStyle = strokeColor
        context.globalAlpha = opacity
        context.lineWidth = strokeWidth
        context.lineCap = 'round'
        context.lineJoin = 'round'
        context.stroke()
        context.restore()
      }

      if (splitX != null && frame.cursorSplit) {
        const clampedSplitX = Math.max(plotLeft, Math.min(plotLeft + plotWidth, splitX))
        const mutedColor = resolveCssColor(context.canvas, frame.cursorSplit.color, '#99A6B5')
        drawStroke(mutedColor, 1.4, frame.cursorSplit.opacity, clampedSplitX, plotLeft + plotWidth - clampedSplitX)
        drawStroke(color, frame.lineStrokeWidth, 1, plotLeft - 4, clampedSplitX - plotLeft + 4)
        return
      }

      drawArea(context, frame, points, color)
      drawStroke(color, frame.lineStrokeWidth, 1, plotLeft - 4, plotWidth + 8)
    })

    const firstPoint = frame.data.find((point) => {
      const value = point[seriesItem.key]
      return typeof value === 'number' && Number.isFinite(value)
    })
    const firstValue = firstPoint?.[seriesItem.key]
    const firstTimestamp = firstPoint?.date.getTime()

    if (
      firstPoint &&
      typeof firstValue === 'number' &&
      typeof firstTimestamp === 'number' &&
      Number.isFinite(frame.leadingGapStartMs) &&
      frame.leadingGapStartMs < firstTimestamp
    ) {
      context.save()
      context.beginPath()
      context.setLineDash([2, 4])
      context.moveTo(scaleSeriesX(frame, frame.leadingGapStartMs), scaleY(frame, firstValue))
      context.lineTo(scaleSeriesX(frame, firstTimestamp), scaleY(frame, firstValue))
      context.strokeStyle = color
      context.globalAlpha = 0.9
      context.lineWidth = 1.4
      context.stroke()
      context.restore()
    }
  })

  context.restore()
}

function drawAxes(context: CanvasRenderingContext2D, frame: PredictionChartCanvasFrame) {
  const innerWidth = Math.max(1, frame.width - frame.margin.left - frame.margin.right)
  const innerHeight = Math.max(1, frame.height - frame.margin.top - frame.margin.bottom)
  const color = resolveCssColor(context.canvas, frame.axisLabelColor, '#77808d')
  const plotBottom = frame.margin.top + innerHeight

  context.save()
  context.fillStyle = color
  context.strokeStyle = color
  context.globalAlpha = frame.axisLabelOpacity
  context.textBaseline = 'middle'
  context.font = `${frame.yAxisTickFontSize}px Arial, sans-serif`

  if (frame.showYAxis) {
    frame.yTicks.forEach((tick) => {
      if (frame.hideYAxisMinimumLabel && Math.abs(tick - frame.yMin) <= Number.EPSILON) {
        return
      }

      const x = frame.alignYAxisLabelsToChartEdge ? frame.width - 2 : frame.margin.left + innerWidth + 8
      context.textAlign = frame.alignYAxisLabelsToChartEdge ? 'right' : 'left'
      context.fillText(frame.formatYTick(tick), x, scaleY(frame, tick))
    })
  }

  if (frame.showXAxis) {
    if (frame.showXAxisTopRule) {
      context.beginPath()
      context.lineWidth = 1
      context.moveTo(frame.margin.left, Math.round(plotBottom) + 0.5)
      context.lineTo(
        frame.showXAxisTopRuleFullWidth ? frame.width - 0.5 : frame.margin.left + innerWidth,
        Math.round(plotBottom) + 0.5,
      )
      context.stroke()
    }

    context.font = `${frame.xAxisTickFontSize}px Arial, sans-serif`
    context.textBaseline = 'top'
    const labelWidth = Math.max(1, innerWidth - frame.xAxisLabelsRightInset)
    frame.xTicks.forEach((tick, index) => {
      const ratio = (tick.getTime() - frame.domainStart) / Math.max(1, frame.domainEnd - frame.domainStart)
      const x = frame.margin.left + Math.max(0, Math.min(1, ratio)) * labelWidth
      const isFirst = index === 0
      const isLast = index === frame.xTicks.length - 1
      context.textAlign = frame.centerXAxisTickLabels ? 'center' : isFirst ? 'left' : isLast ? 'right' : 'center'
      context.fillText(frame.formatXTick(tick), x, plotBottom + (frame.showXAxisTopRuleFullWidth ? 9 : 7))
    })
  }

  context.restore()
}

function drawAnnotations(context: CanvasRenderingContext2D, frame: PredictionChartCanvasFrame) {
  frame.annotations.forEach((annotation) => {
    context.save()
    context.beginPath()
    context.arc(frame.margin.left + annotation.x, frame.margin.top + annotation.y, annotation.radius, 0, Math.PI * 2)
    context.fillStyle = resolveCssColor(context.canvas, annotation.color, '#94a3b8')
    context.fill()
    context.lineWidth = 1.2
    context.strokeStyle = resolveCssColor(context.canvas, 'var(--background)', '#ffffff')
    context.stroke()
    context.restore()
  })
}

function drawMarkers(context: CanvasRenderingContext2D, frame: PredictionChartCanvasFrame) {
  const lastPoint = frame.data.at(-1)
  if (!lastPoint || frame.cursor) {
    return
  }

  frame.series.forEach((seriesItem) => {
    const value = lastPoint[seriesItem.key]
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return
    }

    const x = scaleX(frame, lastPoint.date.getTime()) + frame.markerOffsetX
    const y = scaleY(frame, value)
    const color = resolveCssColor(context.canvas, seriesItem.color, '#1452f0')
    const keyframeProgress =
      frame.markerPulseProgress <= 0.5 ? frame.markerPulseProgress * 2 : (frame.markerPulseProgress - 0.5) * 2
    const easedProgress = 1 - (1 - keyframeProgress) ** 3
    const pulseScale =
      frame.markerPulseProgress <= 0.5 ? 0.4 + (1.6 - 0.4) * easedProgress : 1.6 + (1.8 - 1.6) * easedProgress
    const pulseOpacity =
      frame.markerPulseProgress <= 0.5 ? 0.9 + (0.25 - 0.9) * easedProgress : 0.25 * (1 - easedProgress)
    const pulseRadius = frame.markerOuterRadius * pulseScale

    context.save()
    context.beginPath()
    context.arc(x, y, pulseRadius, 0, Math.PI * 2)
    if (frame.markerPulseStyle === 'ring') {
      context.globalAlpha = pulseOpacity
      context.strokeStyle = color
      context.lineWidth = 1.6
      context.stroke()
    } else {
      context.globalAlpha = pulseOpacity * 0.55
      context.fillStyle = color
      context.fill()
    }

    context.globalAlpha = 1
    context.beginPath()
    context.arc(x, y, frame.markerInnerRadius, 0, Math.PI * 2)
    context.fillStyle = color
    context.fill()
    context.strokeStyle = color
    context.lineWidth = 1.5
    context.stroke()
    context.restore()
  })
}

function drawCursor(context: CanvasRenderingContext2D, frame: PredictionChartCanvasFrame) {
  if (!frame.cursor) {
    return
  }

  const plotBottom = frame.height - frame.margin.bottom
  const x = frame.margin.left + frame.cursor.x

  context.save()
  context.beginPath()
  context.moveTo(x, frame.margin.top + frame.cursor.guideTop)
  context.lineTo(x, plotBottom)
  context.strokeStyle = resolveCssColor(context.canvas, frame.cursor.guideColor, '#aeb4bc')
  context.globalAlpha = 0.9
  context.lineWidth = 1.5
  context.stroke()

  frame.series.forEach((seriesItem) => {
    const value = frame.cursor?.values[seriesItem.key]
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return
    }

    context.beginPath()
    context.arc(x, scaleY(frame, value), 4, 0, Math.PI * 2)
    context.fillStyle = resolveCssColor(context.canvas, seriesItem.color, '#1452f0')
    context.fill()
  })
  context.restore()
}

export function drawPredictionChartCanvas(canvas: HTMLCanvasElement, frame: PredictionChartCanvasFrame) {
  let context: CanvasRenderingContext2D | null = null
  try {
    context = canvas.getContext('2d')
  } catch {
    return false
  }

  if (!context) {
    return false
  }

  const pixelRatio = Math.max(1, window.devicePixelRatio || 1)
  const bitmapWidth = Math.max(1, Math.round(frame.width * pixelRatio))
  const bitmapHeight = Math.max(1, Math.round(frame.height * pixelRatio))

  if (canvas.width !== bitmapWidth || canvas.height !== bitmapHeight) {
    canvas.width = bitmapWidth
    canvas.height = bitmapHeight
  }

  canvas.style.height = `${frame.height}px`
  canvas.style.width = '100%'
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  context.clearRect(0, 0, frame.width, frame.height)

  drawGrid(context, frame)
  drawSeries(context, frame)
  drawAxes(context, frame)
  drawAnnotations(context, frame)
  drawMarkers(context, frame)
  drawCursor(context, frame)
  return true
}
