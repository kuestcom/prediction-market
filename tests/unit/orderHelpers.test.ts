import { describe, expect, it, vi } from 'vitest'
import { ORDER_SIDE, ORDER_TYPE } from '@/lib/constants'
import { buildOrderPayload, calculateOrderAmounts, submitOrder } from '@/lib/orders'

const storeOrderActionMock = vi.fn()
vi.mock('@/app/[locale]/(platform)/event/[slug]/_actions/store-order', () => ({
  storeOrderAction: (...args: any[]) => storeOrderActionMock(...args),
}))

describe('calculateOrderAmounts', () => {
  it('computes market buy amounts', () => {
    const result = calculateOrderAmounts({
      orderType: ORDER_TYPE.MARKET,
      side: ORDER_SIDE.BUY,
      amount: '12.34',
      limitPrice: '0',
      limitShares: '0',
      marketPriceCents: 40,
    })

    expect(result.makerAmount).toBe(12340000n)
    expect(result.takerAmount).toBe(30850000n)
  })

  it('computes limit sell amounts using percent-based price input', () => {
    const result = calculateOrderAmounts({
      orderType: ORDER_TYPE.LIMIT,
      side: ORDER_SIDE.SELL,
      amount: '0',
      limitPrice: '55.5',
      limitShares: '10',
    })

    expect(result.makerAmount).toBe(10000000n)
    expect(result.takerAmount).toBe(5550000n)
  })

  it('computes limit buy amounts using percent-based price input', () => {
    const result = calculateOrderAmounts({
      orderType: ORDER_TYPE.LIMIT,
      side: ORDER_SIDE.BUY,
      amount: '0',
      limitPrice: '1.3',
      limitShares: '10',
    })

    expect(result.makerAmount).toBe(130000n)
    expect(result.takerAmount).toBe(10000000n)
  })
})

describe('buildOrderPayload', () => {
  it('returns payload with bigint fields', () => {
    const payload = buildOrderPayload({
      userAddress: '0xUser',
      outcome: { token_id: '42' } as any,
      side: ORDER_SIDE.BUY,
      orderType: ORDER_TYPE.MARKET,
      amount: '15.00',
      limitPrice: '0',
      limitShares: '0',
      marketPriceCents: 50,
    })

    expect(payload.maker_amount).toBe(15000000n)
    expect(payload.taker_amount).toBeGreaterThan(0n)
    expect(payload.token_id).toBe(42n)
    expect(payload.fee_rate_bps).toBe(0n)
    expect(payload.timestamp).toBeGreaterThan(0n)
  })

  it('defaults metadata and builder to zero bytes32', () => {
    const payload = buildOrderPayload({
      userAddress: '0xUser',
      outcome: { token_id: '1' } as any,
      side: ORDER_SIDE.SELL,
      orderType: ORDER_TYPE.MARKET,
      amount: '1',
      limitPrice: '0',
      limitShares: '0',
      marketPriceCents: 50,
    })

    expect(payload.fee_rate_bps).toBe(0n)
    expect(payload.metadata).toBe('0x0000000000000000000000000000000000000000000000000000000000000000')
    expect(payload.builder).toBe('0x0000000000000000000000000000000000000000000000000000000000000000')
  })
})

describe('submitOrder', () => {
  it('serializes bigints and forwards to action', async () => {
    storeOrderActionMock.mockResolvedValueOnce({ ok: true })

    const address = '0x0000000000000000000000000000000000000001' as `0x${string}`
    const payload = {
      salt: 1n,
      maker: address,
      signer: address,
      taker: address,
      token_id: 1n,
      maker_amount: 2n,
      taker_amount: 3n,
      expiration: 4n,
      nonce: 5n,
      fee_rate_bps: 6n,
      side: ORDER_SIDE.BUY,
      signature_type: 0,
      timestamp: 7n,
      metadata: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
      builder: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
    }

    await submitOrder({
      order: payload,
      signature: '0xsigned',
      orderType: ORDER_TYPE.MARKET,
      conditionId: 'cond-1',
      slug: 'event',
    })

    expect(storeOrderActionMock).toHaveBeenCalledWith(expect.objectContaining({
      salt: '1',
      token_id: '1',
      maker_amount: '2',
      taker_amount: '3',
      signature: '0xsigned',
      type: ORDER_TYPE.MARKET,
      condition_id: 'cond-1',
      slug: 'event',
    }))
  })
})
