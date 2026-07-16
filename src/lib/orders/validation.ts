import type { LimitExpirationOption } from '@/lib/orders/expiration'
import type { Market, OrderSide, Outcome, User } from '@/types'
import { ORDER_SIDE } from '@/lib/constants'

export type OrderValidationError
  = | 'IS_LOADING'
    | 'NOT_CONNECTED'
    | 'MISSING_USER'
    | 'MISSING_MARKET'
    | 'MISSING_OUTCOME'
    | 'INVALID_AMOUNT'
    | 'MARKET_MIN_AMOUNT'
    | 'INVALID_LIMIT_PRICE'
    | 'INVALID_LIMIT_SHARES'
    | 'LIMIT_SHARES_TOO_LOW'
    | 'INVALID_LIMIT_EXPIRATION'
    | 'INSUFFICIENT_BALANCE'
    | 'INSUFFICIENT_SHARES'

export const MIN_LIMIT_ORDER_SHARES = 0.01
export const MIN_MARKET_BUY_AMOUNT = 1
const BUY_ORDER_FUNDING_BUFFER_BPS = 200

const BPS_DENOMINATOR = 10_000

function normalizeFundingValue(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

export function calculateBuyOrderFundingRequirement(amount: number) {
  const normalizedAmount = normalizeFundingValue(amount)
  return normalizedAmount * (BPS_DENOMINATOR + BUY_ORDER_FUNDING_BUFFER_BPS) / BPS_DENOMINATOR
}

interface ValidateOrderArgs {
  isLoading: boolean
  isConnected: boolean
  user: User | null
  market: Market | null
  outcome: Outcome | null
  amountNumber: number
  side: OrderSide
  isLimitOrder: boolean
  limitPrice: string
  limitShares: string
  availableBalance: number
  availableShares?: number
  limitExpirationOption?: LimitExpirationOption
  limitExpirationTimestamp?: number | null
}

export type OrderValidationResult
  = | { ok: true }
    | { ok: false, reason: OrderValidationError }

export function validateOrder({
  isLoading,
  isConnected,
  user,
  market,
  outcome,
  amountNumber,
  side,
  isLimitOrder,
  limitPrice,
  limitShares,
  availableBalance,
  availableShares = 0,
  limitExpirationOption = 'never',
  limitExpirationTimestamp = null,
}: ValidateOrderArgs): OrderValidationResult {
  const normalizedAvailableShares = Number.isFinite(availableShares) ? Math.max(0, availableShares) : 0

  if (isLoading) {
    return { ok: false, reason: 'IS_LOADING' }
  }

  if (!isConnected) {
    return { ok: false, reason: 'NOT_CONNECTED' }
  }

  if (!user) {
    return { ok: false, reason: 'MISSING_USER' }
  }

  if (!market) {
    return { ok: false, reason: 'MISSING_MARKET' }
  }

  if (!outcome) {
    return { ok: false, reason: 'MISSING_OUTCOME' }
  }

  if (isLimitOrder) {
    const limitPriceValue = Number.parseFloat(limitPrice)
    if (!Number.isFinite(limitPriceValue) || limitPriceValue <= 0) {
      return { ok: false, reason: 'INVALID_LIMIT_PRICE' }
    }

    const limitSharesValue = Number.parseFloat(limitShares)
    if (!Number.isFinite(limitSharesValue) || limitSharesValue <= 0) {
      return { ok: false, reason: 'INVALID_LIMIT_SHARES' }
    }

    if (limitSharesValue < MIN_LIMIT_ORDER_SHARES) {
      return { ok: false, reason: 'LIMIT_SHARES_TOO_LOW' }
    }

    const hasCustomExpiration = limitExpirationOption === 'custom'
    const customExpirationIsValid = typeof limitExpirationTimestamp === 'number'
      && Number.isFinite(limitExpirationTimestamp)
      && limitExpirationTimestamp > 0

    if (hasCustomExpiration) {
      if (!customExpirationIsValid) {
        return { ok: false, reason: 'INVALID_LIMIT_EXPIRATION' }
      }

      const nowSeconds = Math.floor(Date.now() / 1000)
      if (limitExpirationTimestamp <= nowSeconds) {
        return { ok: false, reason: 'INVALID_LIMIT_EXPIRATION' }
      }
    }

    if (side === ORDER_SIDE.BUY) {
      const estimatedCost = (limitPriceValue / 100) * limitSharesValue
      const fundingRequired = calculateBuyOrderFundingRequirement(estimatedCost)
      if (!Number.isFinite(estimatedCost) || fundingRequired > availableBalance) {
        return { ok: false, reason: 'INSUFFICIENT_BALANCE' }
      }
    }
    else if (limitSharesValue > normalizedAvailableShares) {
      return { ok: false, reason: 'INSUFFICIENT_SHARES' }
    }

    return { ok: true }
  }

  if (amountNumber <= 0) {
    return { ok: false, reason: 'INVALID_AMOUNT' }
  }

  if (!isLimitOrder && side === ORDER_SIDE.BUY && amountNumber < MIN_MARKET_BUY_AMOUNT) {
    return { ok: false, reason: 'MARKET_MIN_AMOUNT' }
  }

  if (side === ORDER_SIDE.BUY && amountNumber > availableBalance) {
    return { ok: false, reason: 'INSUFFICIENT_BALANCE' }
  }

  if (side === ORDER_SIDE.SELL && amountNumber > normalizedAvailableShares) {
    return { ok: false, reason: 'INSUFFICIENT_SHARES' }
  }

  return { ok: true }
}
