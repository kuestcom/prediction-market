'use client'

import type { SignTypedDataParameters } from 'wagmi/actions'
import type { WalletCall } from '@/lib/wallet/transactions'
import type { User } from '@/types'
import {
  getDepositWalletNonceAction,
  submitDepositWalletTransactionAction,
} from '@/app/[locale]/(platform)/_actions/approve-tokens'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { DEFAULT_CHAIN_ID } from '@/lib/network'
import {
  buildWalletTransactionRequestPayload,
  getDepositWalletBatchTypedData,
} from '@/lib/wallet/transactions'

type SignTypedDataFn = (args: SignTypedDataParameters) => Promise<string>

export interface SignAndSubmitDepositWalletCallsResult {
  error: string | null
  code?: string
  txHash?: string
  approvals?: {
    enabled: boolean
    updatedAt: string
    version: string
  }
}

export async function signAndSubmitDepositWalletCalls({
  user,
  calls,
  metadata,
  signTypedDataAsync,
}: {
  user: Pick<User, 'address' | 'deposit_wallet_address'>
  calls: WalletCall[]
  metadata?: string
  signTypedDataAsync: SignTypedDataFn
}): Promise<SignAndSubmitDepositWalletCallsResult> {
  if (!user.deposit_wallet_address) {
    return { error: DEFAULT_ERROR_MESSAGE, code: 'missing_deposit_wallet' }
  }

  async function attempt(): Promise<SignAndSubmitDepositWalletCallsResult> {
    const nonceResult = await getDepositWalletNonceAction()
    if (nonceResult.error || !nonceResult.nonce) {
      return {
        error: nonceResult.error ?? DEFAULT_ERROR_MESSAGE,
        code: nonceResult.code,
      }
    }

    const typedData = getDepositWalletBatchTypedData({
      chainId: DEFAULT_CHAIN_ID,
      depositWallet: user.deposit_wallet_address as `0x${string}`,
      calls,
      nonce: nonceResult.nonce,
    })

    const signature = await signTypedDataAsync({
      domain: typedData.domain,
      types: typedData.types,
      primaryType: typedData.primaryType,
      message: typedData.message,
    })

    const payload = buildWalletTransactionRequestPayload({
      from: user.address,
      nonce: nonceResult.nonce,
      signature,
      typedData,
      metadata,
    })

    return await submitDepositWalletTransactionAction(payload)
  }

  const first = await attempt()
  if (first.code !== 'wallet_nonce_mismatch') {
    return first
  }

  return await attempt()
}
