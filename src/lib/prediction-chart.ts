import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { DataPoint, SeriesConfig } from '@/types/PredictionChartTypes'

export const DEFAULT_X_AXIS_TICKS = 6
export const DEFAULT_Y_AXIS_MAX = 100
export const TOOLTIP_LABEL_HEIGHT = 20
export const TOOLTIP_LABEL_GAP = 6
export const TOOLTIP_LABEL_MAX_WIDTH = 160
export const INITIAL_REVEAL_DURATION = 1400
export const INTERACTION_BASE_REVEAL_DURATION = 1100

const DATA_POINT_EPSILON = 0.0001

export function clamp01(value: number) {
  if (value < 0) {
    return 0
  }

  if (value > 1) {
    return 1
  }

  return value
}

export function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3
}

export function snapTimestampToInterval(valueMs: number, stepMs?: number, offsetMs = 0) {
  if (!stepMs || !Number.isFinite(stepMs) || stepMs <= 0) {
    return valueMs
  }

  const relative = valueMs - offsetMs
  const snappedRelative = Math.round(relative / stepMs) * stepMs
  return offsetMs + snappedRelative
}

export function arePointsEqual(a: DataPoint, b: DataPoint) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  keys.delete('date')

  for (const key of keys) {
    const aValue = a[key]
    const bValue = b[key]

    if (typeof aValue === 'number' || typeof bValue === 'number') {
      const numericA = typeof aValue === 'number' ? aValue : 0
      const numericB = typeof bValue === 'number' ? bValue : 0
      if (Math.abs(numericA - numericB) > DATA_POINT_EPSILON) {
        return false
      }
      continue
    }

    if (aValue !== bValue) {
      return false
    }
  }

  return true
}

interface RevealAnimationOptions {
  from: number
  to: number
  duration?: number
  frameRef: MutableRefObject<number | null>
  setProgress: Dispatch<SetStateAction<number>>
}

export function stopRevealAnimation(frameRef: MutableRefObject<number | null>) {
  if (frameRef.current !== null) {
    cancelAnimationFrame(frameRef.current)
    frameRef.current = null
  }
}

export function runRevealAnimation({
  from,
  to,
  duration = INTERACTION_BASE_REVEAL_DURATION,
  frameRef,
  setProgress,
}: RevealAnimationOptions) {
  const clampedFrom = clamp01(from)
  const clampedTo = clamp01(to)

  stopRevealAnimation(frameRef)

  if (clampedFrom === clampedTo) {
    setProgress(clampedTo)
    return
  }

  let startTimestamp: number | null = null

  function step(timestamp: number) {
    if (startTimestamp === null) {
      startTimestamp = timestamp
    }

    const elapsed = timestamp - startTimestamp
    const progress = clamp01(duration === 0 ? 1 : elapsed / duration)
    const nextValue = clampedFrom + (clampedTo - clampedFrom) * easeOutCubic(progress)

    setProgress(nextValue)

    if (progress < 1) {
      frameRef.current = requestAnimationFrame(step)
    }
    else {
      frameRef.current = null
    }
  }

  setProgress(clampedFrom)
  frameRef.current = requestAnimationFrame(step)
}

export function interpolateSeriesPoint(
  targetDate: Date,
  previousPoint: DataPoint | null,
  nextPoint: DataPoint | null,
  series: SeriesConfig[],
): DataPoint | null {
  if (!previousPoint && !nextPoint) {
    return null
  }

  const targetTime = targetDate.getTime()

  if (nextPoint && targetTime === nextPoint.date.getTime()) {
    return nextPoint
  }

  if (previousPoint && targetTime === previousPoint.date.getTime()) {
    return previousPoint
  }

  if (!previousPoint || !nextPoint) {
    return previousPoint ?? nextPoint ?? null
  }

  const prevTime = previousPoint.date.getTime()
  const nextTime = nextPoint.date.getTime()
  const denominator = nextTime - prevTime

  if (denominator === 0) {
    return previousPoint
  }

  const ratio = (targetTime - prevTime) / denominator
  const interpolated: DataPoint = { date: targetDate }

  series.forEach((seriesItem) => {
    const prevValue = previousPoint[seriesItem.key]
    const nextValue = nextPoint[seriesItem.key]

    if (typeof prevValue === 'number' && typeof nextValue === 'number') {
      interpolated[seriesItem.key] = prevValue + (nextValue - prevValue) * ratio
    }
    else if (typeof prevValue === 'number') {
      interpolated[seriesItem.key] = prevValue
    }
    else if (typeof nextValue === 'number') {
      interpolated[seriesItem.key] = nextValue
    }
  })

  return interpolated
}

function collectSeriesValues(data: DataPoint[], series: SeriesConfig[]) {
  const values: number[] = []
  data.forEach((point) => {
    series.forEach((seriesItem) => {
      const value = point[seriesItem.key]
      if (typeof value === 'number' && Number.isFinite(value)) {
        values.push(value)
      }
    })
  })
  return values
}

export function calculateYAxisBounds(
  data: DataPoint[],
  series: SeriesConfig[],
  minTicks = 3,
) {
  const values = collectSeriesValues(data, series)

  if (!values.length) {
    return {
      min: 0,
      max: DEFAULT_Y_AXIS_MAX,
      ticks: [0, 25, 50, 75, 100],
    }
  }

  let dataMin = Math.max(0, Math.min(100, Math.min(...values)))
  let dataMax = Math.max(0, Math.min(100, Math.max(...values)))

  if (dataMax - dataMin < 1) {
    dataMax = Math.min(100, dataMax + 2.5)
    dataMin = Math.max(0, dataMin - 2.5)
  }

  const rawSpan = Math.max(5, dataMax - dataMin)
  const intervalCount = Math.max(1, minTicks - 1)
  const rawStep = rawSpan / intervalCount
  let step = Math.min(
    50,
    Math.max(5, Math.ceil(rawStep / 5) * 5),
  )
  let axisMin = Math.max(0, Math.floor(dataMin / step) * step)
  let axisMax = Math.min(100, Math.ceil(dataMax / step) * step)

  function tickCount() {
    return Math.floor((axisMax - axisMin) / step) + 1
  }

  if (tickCount() < minTicks && step > 5) {
    step = 5
    axisMin = Math.max(0, Math.floor(dataMin / step) * step)
    axisMax = Math.min(100, Math.ceil(dataMax / step) * step)
  }

  while (tickCount() < minTicks) {
    if (axisMin > 0) {
      axisMin = Math.max(0, axisMin - step)
    }
    else if (axisMax < 100) {
      axisMax = Math.min(100, axisMax + step)
    }
    else {
      break
    }
  }

  const ticks: number[] = []
  for (let value = axisMin; value <= axisMax + 1e-6; value += step) {
    ticks.push(Number(value.toFixed(2)))
  }

  return {
    min: axisMin,
    max: axisMax,
    ticks,
  }
}
