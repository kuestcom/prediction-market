import type { WalletTransactionRequestPayload } from '@/lib/wallet/transactions'
import { encodeAbiParameters } from 'viem'
import { describe, expect, it } from 'vitest'
import {
  COLLATERAL_TOKEN_ADDRESS,
  CONDITIONAL_TOKENS_CONTRACT,
  FEE_CLAIM_EXCHANGE_ADDRESSES,
  UMA_NEG_RISK_ADAPTER_ADDRESS,
} from '@/lib/contracts'
import { isSumsubExitOperation, isVerifiedSumsubExitTransaction } from '@/lib/sumsub/wallet-operations'

const DEPOSIT_WALLET = '0x0000000000000000000000000000000000000009'
const RECIPIENT = '0x0000000000000000000000000000000000000008'
const CONDITION_ID = `0x${'11'.repeat(32)}` as const
const PARENT_COLLECTION_ID = `0x${'00'.repeat(32)}` as const

function calldata(selector: string, parameters: Parameters<typeof encodeAbiParameters>[0], values: readonly unknown[]) {
  return `${selector}${encodeAbiParameters(parameters, values as never).slice(2)}`
}

const exitCalls = {
  send_tokens: {
    target: COLLATERAL_TOKEN_ADDRESS,
    data: calldata('0xa9059cbb', [
      { type: 'address' },
      { type: 'uint256' },
    ], [RECIPIENT, 1n]),
  },
  claim_fees: {
    target: FEE_CLAIM_EXCHANGE_ADDRESSES[0],
    data: '0x4e71d92d',
  },
  redeem_positions: {
    target: CONDITIONAL_TOKENS_CONTRACT,
    data: calldata('0x01b7037c', [
      { type: 'address' },
      { type: 'bytes32' },
      { type: 'bytes32' },
      { type: 'uint256[]' },
    ], [COLLATERAL_TOKEN_ADDRESS, PARENT_COLLECTION_ID, CONDITION_ID, [1n, 2n]]),
  },
  redeem_neg_risk: {
    target: UMA_NEG_RISK_ADAPTER_ADDRESS,
    data: calldata('0xdbeccb23', [
      { type: 'bytes32' },
      { type: 'uint256[]' },
    ], [CONDITION_ID, [1n, 2n]]),
  },
  merge_position: {
    target: CONDITIONAL_TOKENS_CONTRACT,
    data: calldata('0x9e7212ad', [
      { type: 'address' },
      { type: 'bytes32' },
      { type: 'bytes32' },
      { type: 'uint256[]' },
      { type: 'uint256' },
    ], [COLLATERAL_TOKEN_ADDRESS, PARENT_COLLECTION_ID, CONDITION_ID, [1n, 2n], 1n]),
  },
} as const

function request(metadata: string | undefined, target: string, data: string, value = '0') {
  const depositWalletParams = {
    depositWallet: DEPOSIT_WALLET,
    deadline: '1770000000',
    calls: [{ target, value, data }],
  }
  return {
    metadata,
    depositWalletParams,
    signatureParams: {
      depositWalletParams: structuredClone(depositWalletParams),
    },
  } as unknown as WalletTransactionRequestPayload
}

describe('sumsub exit wallet operations', () => {
  it.each([
    ['send_tokens', exitCalls.send_tokens],
    ['claim_fees', exitCalls.claim_fees],
    ['redeem_positions', exitCalls.redeem_positions],
    ['redeem_positions', exitCalls.redeem_neg_risk],
    ['merge_position', exitCalls.merge_position],
  ])('allows verified %s calls', (metadata, call) => {
    expect(isSumsubExitOperation(metadata)).toBe(true)
    expect(isVerifiedSumsubExitTransaction(request(metadata, call.target, call.data))).toBe(true)
  })

  it('does not trust exit metadata with a non-exit selector', () => {
    expect(isVerifiedSumsubExitTransaction(request(
      'send_tokens',
      COLLATERAL_TOKEN_ADDRESS,
      '0x095ea7b30000',
    ))).toBe(false)
  })

  it('rejects value transfers and non-exit metadata', () => {
    expect(isVerifiedSumsubExitTransaction(request(
      'redeem_positions',
      exitCalls.redeem_positions.target,
      exitCalls.redeem_positions.data,
      '1',
    ))).toBe(false)
    expect(isVerifiedSumsubExitTransaction(request(
      'approve_tokens',
      exitCalls.send_tokens.target,
      exitCalls.send_tokens.data,
    ))).toBe(false)
  })

  it('rejects exit metadata when there are no wallet calls', () => {
    const emptyRequest = request('send_tokens', exitCalls.send_tokens.target, exitCalls.send_tokens.data)
    emptyRequest.depositWalletParams.calls = []
    emptyRequest.signatureParams.depositWalletParams.calls = []
    expect(isVerifiedSumsubExitTransaction(emptyRequest)).toBe(false)

    const missingCallsRequest = request('send_tokens', exitCalls.send_tokens.target, exitCalls.send_tokens.data)
    delete (missingCallsRequest.depositWalletParams as Partial<typeof missingCallsRequest.depositWalletParams>).calls
    delete (missingCallsRequest.signatureParams.depositWalletParams as Partial<typeof missingCallsRequest.depositWalletParams>).calls
    expect(isVerifiedSumsubExitTransaction(missingCallsRequest)).toBe(false)
  })

  it('rejects allowed selectors sent to an arbitrary contract', () => {
    expect(isVerifiedSumsubExitTransaction(request(
      'send_tokens',
      '0x0000000000000000000000000000000000000001',
      exitCalls.send_tokens.data,
    ))).toBe(false)
  })

  it('rejects direct calls that differ from the signed calls', () => {
    const mismatchedRequest = request('send_tokens', exitCalls.send_tokens.target, exitCalls.send_tokens.data)
    mismatchedRequest.signatureParams.depositWalletParams.calls[0].data = calldata('0xa9059cbb', [
      { type: 'address' },
      { type: 'uint256' },
    ], [RECIPIENT, 2n])

    expect(isVerifiedSumsubExitTransaction(mismatchedRequest)).toBe(false)
  })
})
