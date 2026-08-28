export interface LiveChartAxis {
  min: number
  max: number
  ticks: number[]
  step: number
  fractionDigits: number
  tickIntervals: number
}

const LIVE_AXIS_EXTRA_PADDING_RATIO = 0.16
const LIVE_AXIS_PRICE_FOLLOW_RATIO = 0.18

function resolveNiceLiveAxisStep(rawStep: number, minimumStep: number) {
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(rawStep, minimumStep)))
  const normalized = rawStep / magnitude
  const multiplier = normalized <= 1.5 ? 1 : normalized <= 3.5 ? 2 : normalized <= 7.5 ? 5 : 10
  return Math.max(minimumStep, multiplier * magnitude)
}

function buildLiveAxisTicks(min: number, max: number, step: number, fractionDigits: number) {
  const firstTick = Math.ceil(min / step) * step
  const ticks: number[] = []

  for (let value = firstTick; value <= max + step * 1e-6; value += step) {
    ticks.push(Number(value.toFixed(Math.max(0, fractionDigits))))
  }

  return ticks
}

function buildTicksForBounds(min: number, max: number, fractionDigits: number, tickIntervals: number) {
  const minimumStep = 1 / 10 ** Math.max(0, Math.min(6, Math.floor(fractionDigits)))
  const step = resolveNiceLiveAxisStep((max - min) / Math.max(1, tickIntervals), minimumStep)

  return {
    step,
    ticks: buildLiveAxisTicks(min, max, step, fractionDigits),
  }
}

export function buildLiveChartRecoveryValues(currentPrice: number | null, recoverySpan: number | null) {
  if (
    currentPrice == null ||
    recoverySpan == null ||
    !Number.isFinite(currentPrice) ||
    !Number.isFinite(recoverySpan) ||
    currentPrice <= 0 ||
    recoverySpan <= 0
  ) {
    return []
  }

  const boundedSpan = Math.min(recoverySpan, currentPrice)
  return [currentPrice - boundedSpan, currentPrice + boundedSpan]
}

export function buildContinuousLiveAxis(
  values: number[],
  currentPrice: number | null,
  fractionDigits: number,
  targetTickIntervals: number,
  minimumSpanRatio: number,
): LiveChartAxis {
  const resolvedFractionDigits = Math.max(0, Math.floor(fractionDigits))
  const resolvedTickIntervals = Math.max(1, Math.floor(targetTickIntervals))
  const minimumStep = 1 / 10 ** Math.min(6, resolvedFractionDigits)
  const finiteValues = values.filter((value) => Number.isFinite(value))

  if (!finiteValues.length) {
    return {
      min: 0,
      max: 1,
      ticks: [0, 1],
      step: 1,
      fractionDigits: resolvedFractionDigits,
      tickIntervals: resolvedTickIntervals,
    }
  }

  const visibleMin = Math.min(...finiteValues)
  const visibleMax = Math.max(...finiteValues)
  const visibleMidpoint = (visibleMin + visibleMax) / 2
  const minimumSpan = Math.max(Math.abs(visibleMidpoint) * minimumSpanRatio, minimumStep * 6)
  const visibleSpan = Math.max(minimumSpan, visibleMax - visibleMin)
  const resolvedCurrentPrice = currentPrice != null && Number.isFinite(currentPrice) ? currentPrice : visibleMidpoint
  const followedCenter = visibleMidpoint + (resolvedCurrentPrice - visibleMidpoint) * LIVE_AXIS_PRICE_FOLLOW_RATIO
  const minimumHalfSpan = visibleSpan * (0.5 + LIVE_AXIS_EXTRA_PADDING_RATIO)
  const halfSpan = Math.max(
    minimumHalfSpan,
    Math.abs(visibleMin - followedCenter) * 1.12,
    Math.abs(visibleMax - followedCenter) * 1.12,
  )
  const min = followedCenter - halfSpan
  const max = followedCenter + halfSpan
  const { step, ticks } = buildTicksForBounds(min, max, resolvedFractionDigits, resolvedTickIntervals)

  return {
    min,
    max,
    ticks,
    step,
    fractionDigits: resolvedFractionDigits,
    tickIntervals: resolvedTickIntervals,
  }
}

export function interpolateLiveChartAxis(current: LiveChartAxis, target: LiveChartAxis, progress: number) {
  const resolvedProgress = Math.max(0, Math.min(1, progress))
  const min = current.min + (target.min - current.min) * resolvedProgress
  const max = current.max + (target.max - current.max) * resolvedProgress
  // The bounds animate, so the ticks must be regenerated for those same bounds.
  // Reusing target.ticks here makes a newly narrow scale render its grid lines
  // clustered inside the still-wide scale during the transition.
  const { step, ticks } = buildTicksForBounds(min, max, target.fractionDigits, target.tickIntervals)

  return {
    ...target,
    min,
    max,
    step,
    ticks,
  }
}
