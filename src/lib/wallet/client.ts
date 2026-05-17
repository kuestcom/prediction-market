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
import { isTradingAuthRequiredError } from '@/lib/trading-auth/errors'
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
  autoRedeem?: {
    enabled: boolean
    updatedAt: string
    version: string
  }
}

export interface SignAndSubmitDepositWalletCallItemsResult<T> extends SignAndSubmitDepositWalletCallsResult {
  successfulItems: T[]
  failedItems: T[]
  partialFailure: boolean
  failure?: SignAndSubmitDepositWalletCallsResult
}

export class DepositWalletCallItemsSplitFallbackError<T> extends Error {
  readonly successfulItems: T[]
  readonly failedItems: T[]
  readonly originalError: unknown

  constructor(error: unknown, successfulItems: T[], failedItems: T[]) {
    super(error instanceof Error && error.message ? error.message : DEFAULT_ERROR_MESSAGE)
    this.name = 'DepositWalletCallItemsSplitFallbackError'
    this.successfulItems = successfulItems
    this.failedItems = failedItems
    this.originalError = error
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
  if (calls.length === 0) {
    return { error: DEFAULT_ERROR_MESSAGE, code: 'empty_wallet_calls' }
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

function shouldSplitDepositWalletCallFailure(result: SignAndSubmitDepositWalletCallsResult) {
  if (!result.error || result.code || isTradingAuthRequiredError(result.error)) {
    return false
  }

  const normalized = result.error.toLowerCase()
  return normalized.includes('revert')
    || normalized.includes('transaction failed')
}

function getPreferredFailure(
  current: SignAndSubmitDepositWalletCallsResult | null,
  next: SignAndSubmitDepositWalletCallsResult,
) {
  if (!current) {
    return next
  }

  if (next.error && isTradingAuthRequiredError(next.error) && !isTradingAuthRequiredError(current.error)) {
    return next
  }

  return current
}

export async function signAndSubmitDepositWalletCallItemsWithSplitFallback<T>({
  user,
  items,
  getCall,
  metadata,
  signTypedDataAsync,
}: {
  user: Pick<User, 'address' | 'deposit_wallet_address'>
  items: T[]
  getCall: (item: T) => WalletCall
  metadata?: string
  signTypedDataAsync: SignTypedDataFn
}): Promise<SignAndSubmitDepositWalletCallItemsResult<T>> {
  const successfulItems: T[] = []
  const failedItems: T[] = []
  let lastSuccess: SignAndSubmitDepositWalletCallsResult | null = null
  let firstFailure: SignAndSubmitDepositWalletCallsResult | null = null

  async function submitChunk(chunk: T[]): Promise<void> {
    let result: SignAndSubmitDepositWalletCallsResult
    try {
      result = await signAndSubmitDepositWalletCalls({
        user,
        calls: chunk.map(getCall),
        metadata,
        signTypedDataAsync,
      })
    }
    catch (error) {
      if (successfulItems.length > 0) {
        throw new DepositWalletCallItemsSplitFallbackError(error, successfulItems, [
          ...failedItems,
          ...chunk,
        ])
      }
      throw error
    }

    if (!result.error) {
      successfulItems.push(...chunk)
      lastSuccess = result
      return
    }

    firstFailure = getPreferredFailure(firstFailure, result)
    if (chunk.length <= 1 || !shouldSplitDepositWalletCallFailure(result)) {
      failedItems.push(...chunk)
      return
    }

    const midpoint = Math.ceil(chunk.length / 2)
    await submitChunk(chunk.slice(0, midpoint))
    await submitChunk(chunk.slice(midpoint))
  }

  await submitChunk(items)

  if (successfulItems.length === 0) {
    return {
      ...(firstFailure ?? { error: DEFAULT_ERROR_MESSAGE }),
      successfulItems,
      failedItems: failedItems.length ? failedItems : items,
      partialFailure: false,
      failure: firstFailure ?? undefined,
    }
  }

  return {
    ...(lastSuccess ?? { error: null }),
    error: null,
    successfulItems,
    failedItems,
    partialFailure: failedItems.length > 0,
    failure: firstFailure ?? undefined,
  }
}
