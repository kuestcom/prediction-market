import type { DataPoint, SeriesConfig } from '@/types/PredictionChartTypes'

const PATH_SEARCH_STEPS = 22
const PATH_X_EPSILON = 0.35

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

export function resolvePointFromPaths(params: {
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

export function sanitizeSvgId(value: string) {
  return value.replace(/[^\w-]/g, '-')
}

export function toDomainTimestamp(value: Date | number | undefined) {
  if (value instanceof Date) {
    const timestamp = value.getTime()
    return Number.isFinite(timestamp) ? timestamp : Number.NaN
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : Number.NaN
  }

  return Number.NaN
}

export function areSeriesKeyListsEqual(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false
    }
  }

  return true
}

export function normalizeTicks(sourceTicks: number[]) {
  const seen = new Set<number>()

  return sourceTicks.filter((value) => {
    if (!Number.isFinite(value) || seen.has(value)) {
      return false
    }

    seen.add(value)
    return true
  })
}
