import { describe, expect, it } from 'vitest'
import { applyCachedChartDeltaToEventMarketRow, resolveChanceMetaForChartDelta } from '@/app/[locale]/(platform)/event/[slug]/_utils/eventMarketChanceMeta'

describe('eventMarketChanceMeta', () => {
  const baseRow = {
    market: {
      condition_id: 'market-1',
    },
    chanceMeta: {
      chanceDisplay: '55%',
      normalizedChance: 55,
      isSubOnePercent: false,
      shouldShowChanceChange: false,
      chanceChangeLabel: '',
      isChanceChangePositive: false,
    },
  } as const

  it('keeps the original row when there is no cached chart delta', () => {
    expect(applyCachedChartDeltaToEventMarketRow(baseRow, {})).toBe(baseRow)
  })

  it('reuses the cached chart delta after the row collapses', () => {
    const resolvedRow = applyCachedChartDeltaToEventMarketRow(baseRow, {
      'market-1': 3.2,
    })

    expect(resolvedRow).not.toBe(baseRow)
    expect(resolvedRow.chanceMeta.shouldShowChanceChange).toBe(true)
    expect(resolvedRow.chanceMeta.chanceChangeLabel).toBe('3%')
    expect(resolvedRow.chanceMeta.isChanceChangePositive).toBe(true)
  })

  it('preserves the direction for negative chart deltas', () => {
    const resolvedMeta = resolveChanceMetaForChartDelta(baseRow.chanceMeta, -4.6)

    expect(resolvedMeta.shouldShowChanceChange).toBe(true)
    expect(resolvedMeta.chanceChangeLabel).toBe('5%')
    expect(resolvedMeta.isChanceChangePositive).toBe(false)
  })
})
