import { describe, expect, it } from 'vitest'
import {
  getClosedPositionMetrics,
  isActiveUserPositionsQueryKeyForAddress,
  mapDataApiPosition,
  sortPositions,
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

  it('maps closed-position trading totals and derives amount won and missing P&L percentage', () => {
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

  it('derives total traded when initial value is missing without double-normalizing price', () => {
    const position = mapDataApiPosition({
      conditionId: 'condition',
      title: 'Closed market',
      avgPrice: 50,
      totalBought: 12,
      realizedPnl: 2,
    }, 'closed')

    expect(getClosedPositionMetrics(position)).toMatchObject({
      amountWon: 8,
      totalTraded: 6,
    })
  })

  it('falls back to current value when realized P&L is missing', () => {
    const position = mapDataApiPosition({
      conditionId: 'condition',
      title: 'Closed market',
      currentValue: 2,
      initialValue: 6,
    }, 'closed')

    expect(getClosedPositionMetrics(position)).toMatchObject({
      amountWon: 8,
      isWon: true,
      realizedPnl: 2,
    })
  })

  it('returns zero amount won and derives negative P&L percentage for a loss', () => {
    const position = mapDataApiPosition({
      conditionId: 'condition',
      title: 'Closed market',
      initialValue: 6,
      realizedPnl: -6,
    }, 'closed')

    expect(getClosedPositionMetrics(position)).toMatchObject({
      amountWon: 0,
      isWon: false,
      pnlPercent: -100,
      realizedPnl: -6,
    })
  })

  it('sorts closed positions by the displayed amount won', () => {
    const highAmountLowProfit = mapDataApiPosition({
      conditionId: 'high-amount',
      title: 'High amount, low profit',
      initialValue: 100,
      realizedPnl: 1,
    }, 'closed')
    const lowAmountHighProfit = mapDataApiPosition({
      conditionId: 'low-amount',
      title: 'Low amount, high profit',
      initialValue: 1,
      realizedPnl: 10,
    }, 'closed')
    const loss = mapDataApiPosition({
      conditionId: 'loss',
      title: 'Loss',
      initialValue: 200,
      realizedPnl: -1,
    }, 'closed')

    expect(sortPositions([
      lowAmountHighProfit,
      loss,
      highAmountLowProfit,
    ], 'currentValue', 'desc').map(position => position.id)).toEqual([
      highAmountLowProfit.id,
      lowAmountHighProfit.id,
      loss.id,
    ])
  })
})
