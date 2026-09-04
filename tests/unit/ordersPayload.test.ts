import { afterEach, describe, expect, it, mock } from 'bun:test'

import { ORDER_SIDE, ORDER_TYPE } from '@/lib/constants'
import { buildOrderPayload } from '@/lib/orders'

import { unstubAllEnvs } from '../bun-test-helpers'

void mock.module('@/app/(platform)/event/[slug]/_actions/store-order', () => ({
  storeOrderAction: mock(),
}))

describe('buildOrderPayload money-safety defaults', () => {
  const makerAddress = '0x0000000000000000000000000000000000000001' as const

  afterEach(() => {
    unstubAllEnvs()
  })

  it('keeps fee fields unsigned and normalizes expiration defensively', () => {
    const payload = buildOrderPayload({
      makerAddress,
      outcome: { token_id: '1' } as any,
      side: ORDER_SIDE.BUY,
      orderType: ORDER_TYPE.MARKET,
      amount: '1',
      limitPrice: '0',
      limitShares: '0',
      expirationTimestamp: -50,
    })

    expect(payload.fee_rate_bps).toBe(0n)
    expect(payload.expiration).toBe(0n)

    const payloadDefault = buildOrderPayload({
      makerAddress,
      outcome: { token_id: '1' } as any,
      side: ORDER_SIDE.BUY,
      orderType: ORDER_TYPE.MARKET,
      amount: '1',
      limitPrice: '0',
      limitShares: '0',
    })
    expect(payloadDefault.fee_rate_bps).toBe(0n)

    const payloadTrunc = buildOrderPayload({
      makerAddress,
      outcome: { token_id: '1' } as any,
      side: ORDER_SIDE.BUY,
      orderType: ORDER_TYPE.MARKET,
      amount: '1',
      limitPrice: '0',
      limitShares: '0',
      expirationTimestamp: 123.9,
    })

    expect(payloadTrunc.fee_rate_bps).toBe(0n)
    expect(payloadTrunc.expiration).toBe(123n)
  })
})
