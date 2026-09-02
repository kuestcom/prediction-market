import { describe, expect, it } from 'vitest'

import {
  accumulateLiveTradeVolume,
  resolveLiveTradeEventKey,
  resolveLiveTradeVolume,
} from '@/app/[locale]/(platform)/event/[slug]/_components/EventMarketChannelProvider'

describe('live market trade volume', () => {
  const tokenIdToConditionId = new Map([
    ['yes-token', 'condition-1'],
    ['no-token', 'condition-1'],
  ])

  it('maps a valid last trade to its condition and computes price times size', () => {
    expect(
      resolveLiveTradeVolume(
        { event_type: 'last_trade_price', asset_id: 'yes-token', price: '0.35', size: '10' },
        tokenIdToConditionId,
      ),
    ).toEqual({ conditionId: 'condition-1', volume: 3.5 })
  })

  it('accumulates multiple valid trades by condition and ignores invalid events', () => {
    const first = accumulateLiveTradeVolume(
      {},
      { event_type: 'last_trade_price', asset_id: 'yes-token', price: '0.5', size: '4' },
      tokenIdToConditionId,
    )
    const second = accumulateLiveTradeVolume(
      first,
      { event_type: 'last_trade_price', asset_id: 'no-token', price: 0.25, size: 2 },
      tokenIdToConditionId,
    )
    const unchanged = accumulateLiveTradeVolume(
      second,
      { event_type: 'best_bid_ask', asset_id: 'yes-token', price: '0.9', size: '3' },
      tokenIdToConditionId,
    )

    expect(second).toEqual({ 'condition-1': 2.5 })
    expect(unchanged).toBe(second)
  })

  it('uses the CLOB stream sequence as a stable reconnect deduplication key', () => {
    const payload = {
      event_type: 'last_trade_price',
      asset_id: 'yes-token',
      price: '0.5',
      size: '4',
      side: 'BUY',
      timestamp: '1000',
      sequence: '123-0',
    }

    expect(resolveLiveTradeEventKey(payload, tokenIdToConditionId)).toBe('condition-1:stream:123-0:yes-token')
    expect(resolveLiveTradeEventKey({ ...payload, sequence: '124-0' }, tokenIdToConditionId)).not.toBe(
      resolveLiveTradeEventKey(payload, tokenIdToConditionId),
    )
  })

  it('includes the stream id when deduplicating sequence-based trade events', () => {
    const payload = {
      event_type: 'last_trade_price',
      asset_id: 'yes-token',
      price: '0.5',
      size: '4',
      sequence: '123-0',
      stream_id: 'stream-a',
    }

    expect(resolveLiveTradeEventKey(payload, tokenIdToConditionId)).toBe('condition-1:stream:stream-a:123-0:yes-token')
    expect(resolveLiveTradeEventKey({ ...payload, stream_id: 'stream-b' }, tokenIdToConditionId)).not.toBe(
      resolveLiveTradeEventKey(payload, tokenIdToConditionId),
    )
  })

  it.each([
    null,
    {},
    { event_type: 'last_trade_price', asset_id: 'unknown-token', price: '0.5', size: '2' },
    { event_type: 'last_trade_price', asset_id: 'yes-token', price: '0', size: '2' },
    { event_type: 'last_trade_price', asset_id: 'yes-token', price: 'invalid', size: '2' },
  ])('rejects malformed or unrelated payloads: %j', (payload) => {
    expect(resolveLiveTradeVolume(payload, tokenIdToConditionId)).toBeNull()
  })
})
