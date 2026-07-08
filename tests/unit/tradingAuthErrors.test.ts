import { describe, expect, it } from 'vitest'
import {
  isTradingAuthRequiredError,
  TRADING_AUTH_REQUIRED_ERROR,
  TRADING_DEPOSIT_WALLET_REQUIRED_ERROR,
} from '@/lib/trading-auth/errors'

describe('trading auth errors', () => {
  it('classifies trading onboarding prerequisite errors', () => {
    expect(isTradingAuthRequiredError(TRADING_AUTH_REQUIRED_ERROR)).toBe(true)
    expect(isTradingAuthRequiredError(TRADING_DEPOSIT_WALLET_REQUIRED_ERROR)).toBe(true)
    expect(isTradingAuthRequiredError('Please set up your Deposit Wallet before trading.')).toBe(true)
  })

  it('does not classify unrelated trading errors', () => {
    expect(isTradingAuthRequiredError('Order not found.')).toBe(false)
    expect(isTradingAuthRequiredError('Your Deposit Wallet is still being created. Try again in a moment.')).toBe(false)
  })
})
