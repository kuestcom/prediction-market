import type { Market } from '@/types'
import { describe, expect, it } from 'vitest'
import {
  getMarketEndTimestamp,
  getMirrorOracleAddress,
  getMirrorResolutionType,
  isChainlinkMarketEnded,
} from '@/lib/mirror-resolution'

function market(
  metadata: Record<string, unknown>,
  endTime: string | null = '2026-07-27T12:00:00Z',
) {
  return {
    metadata,
    end_time: endTime,
  } as Market
}

describe('mirror resolution metadata', () => {
  it('reads the validated mirror source fields', () => {
    const value = market({
      mirror_resolution_type: 'chainlink',
      mirror_oracle_address: '0x58e1745bEdda7312C4CDdb72618923da1B90EfDE',
    })

    expect(getMirrorResolutionType(value)).toBe('chainlink')
    expect(getMirrorOracleAddress(value)).toBe('0x58e1745bEdda7312C4CDdb72618923da1B90EfDE')
    expect(getMarketEndTimestamp(value)).toBe(Date.parse('2026-07-27T12:00:00Z'))
  })

  it('closes Chainlink trading exactly at end_time', () => {
    const value = market({ mirror_resolution_type: 'chainlink' })
    expect(isChainlinkMarketEnded(value, Date.parse('2026-07-27T11:59:59.999Z'))).toBe(false)
    expect(isChainlinkMarketEnded(value, Date.parse('2026-07-27T12:00:00Z'))).toBe(true)
  })

  it('normalizes numeric metadata end_time in Unix seconds or milliseconds', () => {
    const expected = Date.parse('2026-07-27T12:00:00Z')
    const seconds = market({
      mirror_resolution_type: 'chainlink',
      end_time: expected / 1000,
    }, null)
    const milliseconds = market({
      mirror_resolution_type: 'chainlink',
      end_time: expected,
    }, null)

    expect(getMarketEndTimestamp(seconds)).toBe(expected)
    expect(getMarketEndTimestamp(milliseconds)).toBe(expected)
    expect(isChainlinkMarketEnded(seconds, expected)).toBe(true)
    expect(isChainlinkMarketEnded(milliseconds, expected)).toBe(true)
  })

  it('falls back to metadata when the market end_time is invalid', () => {
    const expected = Date.parse('2026-07-27T12:00:00Z')
    const value = market({
      mirror_resolution_type: 'chainlink',
      end_time: expected / 1000,
    }, 'invalid')

    expect(getMarketEndTimestamp(value)).toBe(expected)
  })

  it('does not infer the source oracle from the interval', () => {
    const value = market({ mirror_resolution_type: 'uma' })
    expect(isChainlinkMarketEnded(value, Date.parse('2026-07-27T12:00:01Z'))).toBe(false)
  })
})
