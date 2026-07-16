import { describe, expect, it, vi } from 'vitest'
import { ORDER_SIDE } from '@/lib/constants'
import {
  calculateBuyOrderFundingRequirement,
  MIN_LIMIT_ORDER_SHARES,
  MIN_MARKET_BUY_AMOUNT,
  validateOrder,
} from '@/lib/orders/validation'

function baseArgs(overrides: Partial<Parameters<typeof validateOrder>[0]> = {}) {
  return {
    isLoading: false,
    isConnected: true,
    user: { id: 'user-1' } as any,
    market: { id: 'market-1' } as any,
    outcome: { id: 'outcome-1' } as any,
    amountNumber: 10,
    side: ORDER_SIDE.BUY,
    isLimitOrder: false,
    limitPrice: '50',
    limitShares: '10',
    availableBalance: 100,
    availableShares: 0,
    limitExpirationOption: 'never' as const,
    limitExpirationTimestamp: null,
    ...overrides,
  }
}

describe('validateOrder', () => {
  it('calculates buy funding requirements with the trading fee buffer', () => {
    expect(calculateBuyOrderFundingRequirement(9.98)).toBeCloseTo(10.1796)
  })

  it('rejects when loading or disconnected', () => {
    expect(validateOrder(baseArgs({ isLoading: true }))).toEqual({ ok: false, reason: 'IS_LOADING' })
    expect(validateOrder(baseArgs({ isConnected: false }))).toEqual({ ok: false, reason: 'NOT_CONNECTED' })
  })

  it('rejects missing entities', () => {
    expect(validateOrder(baseArgs({ user: null }))).toEqual({ ok: false, reason: 'MISSING_USER' })
    expect(validateOrder(baseArgs({ market: null }))).toEqual({ ok: false, reason: 'MISSING_MARKET' })
    expect(validateOrder(baseArgs({ outcome: null }))).toEqual({ ok: false, reason: 'MISSING_OUTCOME' })
  })

  it('validates market orders for amount and balance/shares', () => {
    expect(validateOrder(baseArgs({ amountNumber: 0 }))).toEqual({ ok: false, reason: 'INVALID_AMOUNT' })
    expect(validateOrder(baseArgs({
      amountNumber: MIN_MARKET_BUY_AMOUNT - 0.01,
    }))).toEqual({ ok: false, reason: 'MARKET_MIN_AMOUNT' })

    expect(validateOrder(baseArgs({
      side: ORDER_SIDE.BUY,
      amountNumber: 100.01,
      availableBalance: 100,
    }))).toEqual({ ok: false, reason: 'INSUFFICIENT_BALANCE' })

    expect(validateOrder(baseArgs({
      side: ORDER_SIDE.BUY,
      amountNumber: 100,
      availableBalance: 100,
    }))).toEqual({ ok: true })

    expect(validateOrder(baseArgs({
      side: ORDER_SIDE.SELL,
      amountNumber: 5,
      availableShares: 3,
    }))).toEqual({ ok: false, reason: 'INSUFFICIENT_SHARES' })

    expect(validateOrder(baseArgs({
      side: ORDER_SIDE.SELL,
      amountNumber: 5,
      availableShares: Number.NaN,
    }))).toEqual({ ok: false, reason: 'INSUFFICIENT_SHARES' })
  })

  it('validates limit order price/shares and min shares', () => {
    expect(validateOrder(baseArgs({ isLimitOrder: true, limitPrice: '0', limitShares: '10' }))).toEqual({ ok: false, reason: 'INVALID_LIMIT_PRICE' })
    expect(validateOrder(baseArgs({ isLimitOrder: true, limitPrice: '50', limitShares: '0' }))).toEqual({ ok: false, reason: 'INVALID_LIMIT_SHARES' })

    const sharesBelowMinimum = MIN_LIMIT_ORDER_SHARES / 2
    expect(validateOrder(baseArgs({
      isLimitOrder: true,
      limitPrice: '50',
      limitShares: String(sharesBelowMinimum),
    }))).toEqual({ ok: false, reason: 'LIMIT_SHARES_TOO_LOW' })
  })

  it('validates limit buy cost and limit sell shares', () => {
    expect(validateOrder(baseArgs({
      isLimitOrder: true,
      side: ORDER_SIDE.BUY,
      limitPrice: '80', // cents
      limitShares: '125',
      availableBalance: 100, // estimated cost = 100, plus fee buffer
    }))).toEqual({ ok: false, reason: 'INSUFFICIENT_BALANCE' })

    expect(validateOrder(baseArgs({
      isLimitOrder: true,
      side: ORDER_SIDE.SELL,
      limitPrice: '10',
      limitShares: '20',
      availableShares: 10,
    }))).toEqual({ ok: false, reason: 'INSUFFICIENT_SHARES' })
  })

  it('requires a valid custom expiration timestamp when enabled', () => {
    expect(validateOrder(baseArgs({
      isLimitOrder: true,
      limitExpirationOption: 'custom',
      limitExpirationTimestamp: null,
    }))).toEqual({ ok: false, reason: 'INVALID_LIMIT_EXPIRATION' })

    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
    try {
      const nowSeconds = Math.floor(Date.now() / 1000)
      expect(validateOrder(baseArgs({
        isLimitOrder: true,
        limitExpirationOption: 'custom',
        limitExpirationTimestamp: nowSeconds - 1,
      }))).toEqual({ ok: false, reason: 'INVALID_LIMIT_EXPIRATION' })

      expect(validateOrder(baseArgs({
        isLimitOrder: true,
        limitExpirationOption: 'custom',
        limitExpirationTimestamp: nowSeconds + 60,
      }))).toEqual({ ok: true })
    }
    finally {
      nowSpy.mockRestore()
    }
  })
})
