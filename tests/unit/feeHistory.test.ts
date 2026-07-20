import { describe, expect, it } from 'vitest'
import { combineDailyFeeSeries } from '@/lib/data-api/fees'

describe('fee history series', () => {
  it('combines builder and affiliate raw amounts into a zero-filled 30 day series', () => {
    const currentDay = Date.UTC(2026, 6, 20) / 1000
    const result = combineDailyFeeSeries([
      {
        address: `0x${'1'.repeat(40)}`,
        feeType: 'BUILDER',
        interval: '1m',
        bucket: 'day',
        items: [{ timestamp: currentDay, amount: '1250000', eventCount: 1 }],
      },
      {
        address: `0x${'1'.repeat(40)}`,
        feeType: 'AFFILIATE',
        interval: '1m',
        bucket: 'day',
        items: [{ timestamp: currentDay, amount: '750000', eventCount: 1 }],
      },
    ], new Date('2026-07-20T12:00:00Z'))

    expect(result).toHaveLength(30)
    expect(result[0]).toEqual({ date: '2026-06-21', value: 0 })
    expect(result.at(-1)).toEqual({ date: '2026-07-20', value: 2 })
  })
})
