import { describe, expect, it, vi } from 'vitest'
import { combineAvailableDailyFeeSeries, combineDailyFeeSeries } from '@/lib/data-api/fees'

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

  it('keeps an available series when the other request fails', () => {
    const currentDay = Date.UTC(2026, 6, 20) / 1000
    const result = combineAvailableDailyFeeSeries([
      {
        status: 'fulfilled',
        value: {
          address: `0x${'1'.repeat(40)}`,
          feeType: 'BUILDER',
          interval: '1m',
          bucket: 'day',
          items: [{ timestamp: currentDay, amount: '1250000', eventCount: 1 }],
        },
      },
      { status: 'rejected', reason: new Error('Data API unavailable') },
    ], new Date('2026-07-20T12:00:00Z'))

    expect(result.at(-1)).toEqual({ date: '2026-07-20', value: 1.25 })
  })

  it('returns no points when every series request fails', () => {
    const result = combineAvailableDailyFeeSeries([
      { status: 'rejected', reason: new Error('Builder history unavailable') },
      { status: 'rejected', reason: new Error('Affiliate history unavailable') },
    ], new Date('2026-07-20T12:00:00Z'))

    expect(result).toEqual([])
  })

  it('reports malformed fee amounts instead of silently dropping them', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const currentDay = Date.UTC(2026, 6, 20) / 1000

    const result = combineDailyFeeSeries([{
      address: `0x${'1'.repeat(40)}`,
      feeType: 'AFFILIATE',
      interval: '1m',
      bucket: 'day',
      items: [{ timestamp: currentDay, amount: '1250000.5', eventCount: 1 }],
    }], new Date('2026-07-20T12:00:00Z'))

    expect(result.at(-1)).toEqual({ date: '2026-07-20', value: 0 })
    expect(warn).toHaveBeenCalledWith(
      'Ignoring malformed Data API fee history amount.',
      expect.objectContaining({ amount: '1250000.5', feeType: 'AFFILIATE' }),
    )
    warn.mockRestore()
  })
})
