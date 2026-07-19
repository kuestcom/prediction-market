import type { WalletTransactionRequestPayload } from '@/lib/wallet/transactions'
import { describe, expect, it } from 'vitest'
import { isSumsubExitOperation, isVerifiedSumsubExitTransaction } from '@/lib/sumsub/wallet-operations'

function request(metadata: string | undefined, data: string, value = '0') {
  const call = {
    target: '0x0000000000000000000000000000000000000001',
    value,
    data,
  }
  return {
    metadata,
    depositWalletParams: { calls: [call] },
  } as unknown as WalletTransactionRequestPayload
}

describe('sumsub exit wallet operations', () => {
  it.each([
    ['send_tokens', '0xa9059cbb0000'],
    ['claim_fees', '0x4e71d92d'],
    ['redeem_positions', '0x01b7037c0000'],
    ['redeem_positions', '0xdbeccb230000'],
    ['merge_position', '0x9e7212ad0000'],
  ])('allows verified %s calls', (metadata, data) => {
    expect(isSumsubExitOperation(metadata)).toBe(true)
    expect(isVerifiedSumsubExitTransaction(request(metadata, data))).toBe(true)
  })

  it('does not trust exit metadata with a non-exit selector', () => {
    expect(isVerifiedSumsubExitTransaction(request('send_tokens', '0x095ea7b30000'))).toBe(false)
  })

  it('rejects value transfers and non-exit metadata', () => {
    expect(isVerifiedSumsubExitTransaction(request('redeem_positions', '0x01b7037c', '1'))).toBe(false)
    expect(isVerifiedSumsubExitTransaction(request('approve_tokens', '0xa9059cbb'))).toBe(false)
  })
})
