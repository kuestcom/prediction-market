import { encodeFunctionData, erc20Abi } from 'viem'
import { describe, expect, it } from 'vitest'
import {
  COLLATERAL_TOKEN_ADDRESS,
  CTF_EXCHANGE_ADDRESS,
} from '@/lib/contracts'
import { resolveDepositWalletTransactionPolicy } from '@/lib/wallet/transaction-policy'
import {
  buildCollateralApproveCall,
  buildSendErc20Call,
  buildSplitPositionCall,
  buildWalletTransactionRequestPayload,
  getDepositWalletBatchTypedData,
} from '@/lib/wallet/transactions'

const USER = '0x0000000000000000000000000000000000000001' as const
const DEPOSIT_WALLET = '0x0000000000000000000000000000000000000002' as const

function buildRequest(calls: Parameters<typeof getDepositWalletBatchTypedData>[0]['calls'], metadata: string) {
  const typedData = getDepositWalletBatchTypedData({
    chainId: 137,
    depositWallet: DEPOSIT_WALLET,
    calls,
    nonce: '1',
    deadline: 1_800_000_000,
  })
  return buildWalletTransactionRequestPayload({
    from: USER,
    nonce: '1',
    signature: '0xsignature',
    typedData,
    metadata,
  })
}

describe('deposit wallet transaction policy', () => {
  it('derives restricted and safety capabilities from signed calls', () => {
    const trade = buildRequest([buildSplitPositionCall({
      conditionId: `0x${'11'.repeat(32)}`,
      partition: [1, 2],
      amount: '1000000',
    })], 'split_position')
    const withdrawal = buildRequest([buildSendErc20Call({
      token: COLLATERAL_TOKEN_ADDRESS,
      to: '0x0000000000000000000000000000000000000003',
      amount: '1',
    })], 'send_tokens')

    expect(resolveDepositWalletTransactionPolicy(trade)).toEqual({
      operation: 'split_position',
      capability: 'trade',
    })
    expect(resolveDepositWalletTransactionPolicy(withdrawal)).toEqual({
      operation: 'send_tokens',
      capability: 'withdraw',
    })
  })

  it('rejects a trade mislabeled as an always-available redemption', () => {
    const request = buildRequest([buildSplitPositionCall({
      conditionId: `0x${'22'.repeat(32)}`,
      partition: [1, 2],
      amount: '1000000',
    })], 'redeem_positions')

    expect(resolveDepositWalletTransactionPolicy(request)).toBeNull()
  })

  it('rejects token approval for an untrusted spender regardless of metadata', () => {
    const request = buildRequest([{
      target: COLLATERAL_TOKEN_ADDRESS,
      value: '0',
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: ['0x0000000000000000000000000000000000000004', (1n << 256n) - 1n],
      }),
    }], 'send_tokens')

    expect(resolveDepositWalletTransactionPolicy(request)).toBeNull()
  })

  it('accepts the application approval call for a known spender', () => {
    const request = buildRequest([buildCollateralApproveCall(CTF_EXCHANGE_ADDRESS)], 'approve_tokens')

    expect(resolveDepositWalletTransactionPolicy(request)).toEqual({
      operation: 'approve_tokens',
      capability: 'approve_tokens',
    })
  })

  it('rejects requests whose classified and signed call copies differ', () => {
    const request = buildRequest([buildSendErc20Call({
      token: COLLATERAL_TOKEN_ADDRESS,
      to: '0x0000000000000000000000000000000000000003',
      amount: '1',
    })], 'send_tokens')
    request.depositWalletParams = {
      ...request.depositWalletParams,
      calls: request.depositWalletParams.calls.map(call => ({ ...call })),
    }
    request.depositWalletParams.calls[0]!.data = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: [CTF_EXCHANGE_ADDRESS, (1n << 256n) - 1n],
    })

    expect(resolveDepositWalletTransactionPolicy(request)).toBeNull()
  })
})
