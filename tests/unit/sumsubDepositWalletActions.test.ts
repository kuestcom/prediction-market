import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  requireApproval: vi.fn(),
  getDepositWalletAddress: vi.fn(),
  getUserTradingAuthSecrets: vi.fn(),
}))

vi.mock('@/lib/db/queries/user', () => ({ UserRepository: { getCurrentUser: mocks.getCurrentUser } }))
vi.mock('@/lib/sumsub/enforcement', () => ({
  requireSumsubTradingApproval: mocks.requireApproval,
  SUMSUB_APPROVAL_REQUIRED_MESSAGE: 'Complete identity verification to continue.',
}))
vi.mock('@/lib/deposit-wallet', () => ({
  getDepositWalletAddress: mocks.getDepositWalletAddress,
  isDepositWalletDeployed: vi.fn(),
}))
vi.mock('@/lib/trading-auth/server', () => ({
  getUserTradingAuthSecrets: mocks.getUserTradingAuthSecrets,
  markAutoRedeemApprovalCompleted: vi.fn(),
  saveUserTradingAuthCredentials: vi.fn(),
}))
vi.mock('@/lib/drizzle', () => ({ db: {} }))
vi.mock('next/headers', () => ({ cookies: vi.fn() }))

const { createDepositWalletAction, enableTradingAuthAction } = await import('@/app/[locale]/(platform)/_actions/deposit-wallet')

describe('sumsub deposit wallet enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    await expect(enableTradingAuthAction({ signature: '', timestamp: '', nonce: '' })).resolves.toEqual({
      error: 'Complete identity verification to continue.',
      data: null,
    })
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
