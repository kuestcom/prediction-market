import { describe, expect, it } from 'vitest'
import {
  DEFAULT_APPROVE_TOKENS_ERROR_MESSAGE,
  DEFAULT_PROXY_WALLET_DEPLOY_ERROR_MESSAGE,
  DEFAULT_TRADING_AUTH_ERROR_MESSAGE,
  getTradingFlowErrorPreview,
  mapApproveTokensError,
  mapProxyWalletDeployError,
  mapTradingAuthError,
} from '@/lib/trading-flow-errors'

describe('trading flow errors', () => {
  it('hides raw HTML error pages from the user', () => {
    const html = '<!DOCTYPE html> <!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US">'

    expect(getTradingFlowErrorPreview(html)).toBe(null)
    expect(mapProxyWalletDeployError(html, {
      status: 502,
      contentType: 'text/html; charset=utf-8',
    })).toBe(DEFAULT_PROXY_WALLET_DEPLOY_ERROR_MESSAGE)
    expect(mapTradingAuthError(html, {
      status: 502,
      contentType: 'text/html; charset=utf-8',
    })).toBe(DEFAULT_TRADING_AUTH_ERROR_MESSAGE)
    expect(mapApproveTokensError(html, {
      status: 502,
      contentType: 'text/html; charset=utf-8',
    })).toBe(DEFAULT_APPROVE_TOKENS_ERROR_MESSAGE)
  })

  it('maps known trading session errors to user-facing messages', () => {
    expect(mapProxyWalletDeployError('owner_address_mismatch', {
      status: 400,
      contentType: 'application/json',
    })).toBe('Your trading session is out of sync. Reconnect and try again.')

    expect(mapApproveTokensError('invalid_l2', {
      status: 401,
      contentType: 'application/json',
    })).toBe('Your trading session expired. Please sign in again.')
  })

  it('maps gas pricing transport errors to retry-later messages', () => {
    const rawError = 'wallet_transport_error: transaction gas price below minimum: gas tip cap 3000000000, minimum needed 25000000000'

    expect(mapProxyWalletDeployError(rawError, {
      status: 502,
      contentType: 'application/json',
    })).toBe(DEFAULT_PROXY_WALLET_DEPLOY_ERROR_MESSAGE)
    expect(mapApproveTokensError(rawError, {
      status: 502,
      contentType: 'application/json',
    })).toBe(DEFAULT_APPROVE_TOKENS_ERROR_MESSAGE)
  })

  it('uses the generic fallback for malformed success responses', () => {
    const rawText = 'unexpected upstream body that should not be shown to users'

    expect(mapApproveTokensError(rawText, {
      status: 200,
      contentType: 'text/plain',
      forceFallback: true,
    })).toBe(DEFAULT_APPROVE_TOKENS_ERROR_MESSAGE)
  })
})
