import { describe, expect, it } from 'bun:test'

import {
  buildContinuousLiveAxis,
  buildLiveChartRecoveryValues,
  interpolateLiveChartAxis,
} from '@/app/[locale]/(platform)/event/[slug]/_utils/liveSeriesChartAxis'

describe('live series chart axis', () => {
  it('keeps the candidate ticks inside the candidate bounds', () => {
    const axis = buildContinuousLiveAxis([100, 110], 110, 2, 4, 0.00005)

    expect(axis.ticks.length).toBeGreaterThan(0)
    expect(axis.ticks.every((tick) => tick >= axis.min && tick <= axis.max)).toBe(true)
  })

  it('keeps ticks aligned while the axis bounds animate', () => {
    const current = buildContinuousLiveAxis([90, 110], 110, 2, 4, 0.00005)
    const target = buildContinuousLiveAxis([100, 100], 100, 2, 4, 0.00005)
    const interpolated = interpolateLiveChartAxis(current, target, 0.1)

    expect(interpolated.ticks.every((tick) => tick >= interpolated.min && tick <= interpolated.max)).toBe(true)
    expect(interpolated.ticks).not.toEqual(target.ticks)
  })

  it('keeps a large downward recovery range symmetric and nonnegative', () => {
    expect(buildLiveChartRecoveryValues(40, 60)).toEqual([0, 80])
    expect(buildLiveChartRecoveryValues(100, 20)).toEqual([80, 120])
  })
})
