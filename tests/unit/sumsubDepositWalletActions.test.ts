import { beforeEach, describe, expect, it, mock, jest } from 'bun:test'

import { hoisted, spyOn } from '../bun-test-helpers'

const mocks = hoisted(() => ({
  getCurrentUser: mock(),
  requireApproval: mock(),
  getDepositWalletAddress: mock(),
  getUserTradingAuthSecrets: mock(),
}))

void mock.module('@/lib/db/queries/user', () => ({ UserRepository: { getCurrentUser: mocks.getCurrentUser } }))
void mock.module('@/lib/sumsub/enforcement', () => ({
  requireSumsubTradingApproval: mocks.requireApproval,
  SUMSUB_APPROVAL_REQUIRED_MESSAGE: 'Complete identity verification to continue.',
}))
void mock.module('@/lib/deposit-wallet', () => ({
  getDepositWalletAddress: mocks.getDepositWalletAddress,
  isDepositWalletDeployed: mock(),
}))
void mock.module('@/lib/trading-auth/server', () => ({
  getUserTradingAuthSecrets: mocks.getUserTradingAuthSecrets,
  markAutoRedeemApprovalCompleted: mock(),
  saveUserTradingAuthCredentials: mock(),
}))
void mock.module('@/lib/drizzle', () => ({ db: {} }))
void mock.module('next/headers', () => ({ cookies: mock() }))

const { createDepositWalletAction, enableTradingAuthAction } =
  await import('@/app/[locale]/(platform)/_actions/deposit-wallet')

describe('sumsub deposit wallet enforcement', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mocks.getCurrentUser.mockResolvedValue({
      id: 'user-1',
      address: '0x0000000000000000000000000000000000000001',
      deposit_wallet_address: null,
    })
    mocks.requireApproval.mockResolvedValue({ allowed: false })
  })

  it('blocks wallet creation before deriving or submitting a wallet', async () => {
    await expect(createDepositWalletAction()).resolves.toEqual({
      error: 'Complete identity verification to continue.',
      data: null,
    })
    expect(mocks.getDepositWalletAddress).not.toHaveBeenCalled()
    expect(mocks.getUserTradingAuthSecrets).not.toHaveBeenCalled()
  })

  it('blocks trading credential creation before validating or calling services', async () => {
    const fetchSpy = spyOn(globalThis, 'fetch')
    await expect(enableTradingAuthAction({ signature: '', timestamp: '', nonce: '' })).resolves.toEqual({
      error: 'Complete identity verification to continue.',
      data: null,
    })
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
