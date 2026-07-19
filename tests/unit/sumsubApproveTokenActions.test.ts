import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  requireApproval: vi.fn(),
  getUserTradingAuthSecrets: vi.fn(),
  markTokenApprovalsCompleted: vi.fn(),
}))

vi.mock('@/lib/db/queries/user', () => ({ UserRepository: { getCurrentUser: mocks.getCurrentUser } }))
vi.mock('@/lib/sumsub/enforcement', () => ({
  requireSumsubTradingApproval: mocks.requireApproval,
  SUMSUB_APPROVAL_REQUIRED_CODE: 'sumsub_approval_required',
  SUMSUB_APPROVAL_REQUIRED_MESSAGE: 'Complete identity verification to continue.',
}))
vi.mock('@/lib/trading-auth/server', () => ({
  getUserTradingAuthSecrets: mocks.getUserTradingAuthSecrets,
  markAutoRedeemApprovalCompleted: vi.fn(),
  markTokenApprovalsCompleted: mocks.markTokenApprovalsCompleted,
}))
vi.mock('@/lib/public-runtime-config.shared', () => ({
  resolvePublicRuntimeEnv: () => ({ relayerUrl: 'https://relayer.test', clobUrl: 'https://clob.test' }),
}))
vi.mock('@/lib/hmac', () => ({ buildClobHmacSignature: () => 'signature' }))
vi.mock('@/lib/deposit-wallet-observability', () => ({
  captureDepositWalletError: vi.fn(),
  captureDepositWalletEvent: vi.fn(),
}))

const actions = await import('@/app/[locale]/(platform)/_actions/approve-tokens')

describe('sumsub allowance enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentUser.mockResolvedValue({
      id: 'user-1',
      address: '0x0000000000000000000000000000000000000001',
      deposit_wallet_address: '0x0000000000000000000000000000000000000002',
      deposit_wallet_status: 'deployed',
    })
    mocks.requireApproval.mockResolvedValue({ allowed: false })
  })

  it('blocks allowance nonce and completion before external effects', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    await expect(actions.getDepositWalletNonceAction('approve_tokens')).resolves.toEqual({
      error: 'Complete identity verification to continue.',
      code: 'sumsub_approval_required',
    })
    await expect(actions.markApprovalStateWithoutTransactionAction('approve_tokens')).resolves.toEqual({
      error: 'Complete identity verification to continue.',
      code: 'sumsub_approval_required',
    })
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(mocks.markTokenApprovalsCompleted).not.toHaveBeenCalled()
  })

  it('keeps withdrawal nonce retrieval available while Required is blocking trades', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ nonce: '7' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))
    await expect(actions.getDepositWalletNonceAction('send_tokens')).resolves.toEqual({ error: null, nonce: '7' })
  })
})
