import { describe, expect, it } from 'vitest'
import {
  getClosedPositionMetrics,
  isActiveUserPositionsQueryKeyForAddress,
  mapDataApiPosition,
} from '@/app/[locale]/(platform)/profile/_utils/PublicPositionsUtils'

describe('publicPositionsUtils', () => {
  it('matches the current public positions query key shape', () => {
    expect(isActiveUserPositionsQueryKeyForAddress(
      ['user-positions', 'https://data-api.kuest.com', '0xAbC', 'active', 'All', '', 'currentValue', 'desc'],
      '0xabc',
    )).toBe(true)
  })

  it('keeps compatibility with the legacy public positions query key shape', () => {
    expect(isActiveUserPositionsQueryKeyForAddress(
      ['user-positions', '0xAbC', 'active'],
      '0xabc',
    )).toBe(true)
  })

  it('does not match closed positions or another address', () => {
    expect(isActiveUserPositionsQueryKeyForAddress(
      ['user-positions', 'https://data-api.kuest.com', '0xAbC', 'closed'],
      '0xabc',
    )).toBe(false)
    expect(isActiveUserPositionsQueryKeyForAddress(
      ['user-positions', 'https://data-api.kuest.com', '0xDef', 'active'],
      '0xabc',
    )).toBe(false)
  })

  it('maps closed-position trading totals and derives the amount won', () => {
    const position = mapDataApiPosition({
      conditionId: 'condition',
      title: 'Closed market',
      avgPrice: 0.5,
      initialValue: 6,
      totalBought: 12,
      realizedPnl: 2,
    }, 'closed')

    const metrics = getClosedPositionMetrics(position)

    expect(metrics).toMatchObject({
      amountWon: 8,
      isWon: true,
      realizedPnl: 2,
      totalBought: 12,
      totalTraded: 6,
    })
    expect(metrics.pnlPercent).toBeCloseTo(100 / 3)
  })
})
