import { beforeEach, describe, expect, it, mock, jest } from 'bun:test'

import { hoisted, spyOn } from '../bun-test-helpers'

const mocks = hoisted(() => ({
  getCurrentUser: mock(),
  requireApproval: mock(),
  getUserTradingAuthSecrets: mock(),
  markTokenApprovalsCompleted: mock(),
}))

void mock.module('@/lib/db/queries/user', () => ({ UserRepository: { getCurrentUser: mocks.getCurrentUser } }))
void mock.module('@/lib/sumsub/enforcement', () => ({
  requireSumsubTradingApproval: mocks.requireApproval,
  SUMSUB_APPROVAL_REQUIRED_CODE: 'sumsub_approval_required',
  SUMSUB_APPROVAL_REQUIRED_MESSAGE: 'Complete identity verification to continue.',
}))
void mock.module('@/lib/trading-auth/server', () => ({
  getUserTradingAuthSecrets: mocks.getUserTradingAuthSecrets,
  markAutoRedeemApprovalCompleted: mock(),
  markTokenApprovalsCompleted: mocks.markTokenApprovalsCompleted,
}))
void mock.module('@/lib/public-runtime-config.shared', () => ({
  resolvePublicRuntimeEnv: () => ({ relayerUrl: 'https://relayer.test', clobUrl: 'https://clob.test' }),
}))
void mock.module('@/lib/hmac', () => ({ buildClobHmacSignature: () => 'signature' }))
void mock.module('@/lib/deposit-wallet-observability', () => ({
  captureDepositWalletError: mock(),
  captureDepositWalletEvent: mock(),
}))

const actions = await import('@/app/[locale]/(platform)/_actions/approve-tokens')

describe('sumsub allowance enforcement', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mocks.getCurrentUser.mockResolvedValue({
      id: 'user-1',
      address: '0x0000000000000000000000000000000000000001',
      deposit_wallet_address: '0x0000000000000000000000000000000000000002',
      deposit_wallet_status: 'deployed',
    })
    mocks.requireApproval.mockResolvedValue({ allowed: false })
  })

  it('blocks allowance nonce and completion before external effects', async () => {
    const fetchSpy = spyOn(globalThis, 'fetch')
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
    spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ nonce: '7' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    await expect(actions.getDepositWalletNonceAction('send_tokens')).resolves.toEqual({ error: null, nonce: '7' })
  })
})
