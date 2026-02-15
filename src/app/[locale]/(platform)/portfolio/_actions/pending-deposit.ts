'use server'

import type { SafeTransactionRequestPayload } from '@/lib/safe/transactions'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { UserRepository } from '@/lib/db/queries/user'
import { buildClobHmacSignature } from '@/lib/hmac'
import { TRADING_AUTH_REQUIRED_ERROR } from '@/lib/trading-auth/errors'
import { getUserTradingAuthSecrets } from '@/lib/trading-auth/server'

export interface PendingDepositBuildResponse {
  nonce: string
  transaction: {
    to: string
    value: string
    data: string
    operation: number
  }
  signatureParams: {
    gasPrice: string
    operation: string
    safeTxnGas: string
    baseGas: string
    gasToken: string
    refundReceiver: string
  }
  amountIn: string
  amountOutMinimum: string
  fee: number
  deadline: number
}

interface BuildPendingDepositResult {
  error: string | null
  payload?: PendingDepositBuildResponse
}

interface SubmitPendingDepositResult {
  error: string | null
  txHash?: string
}

export async function buildPendingUsdcSwapAction(params: {
  amount: string
  slippageBps?: number
}): Promise<BuildPendingDepositResult> {
  const user = await UserRepository.getCurrentUser({ disableCookieCache: true })
  if (!user) {
    return { error: 'Unauthenticated.' }
  }

  if (!user.proxy_wallet_address) {
    return { error: 'Deploy your proxy wallet first.' }
  }

  const auth = await getUserTradingAuthSecrets(user.id)
  if (!auth?.relayer) {
    return { error: TRADING_AUTH_REQUIRED_ERROR }
  }

  const relayerUrl = process.env.RELAYER_URL
  if (!relayerUrl) {
    return { error: DEFAULT_ERROR_MESSAGE }
  }

  const path = '/swap/usdc-e/build'
  const body = JSON.stringify({
    from: user.address,
    proxyWallet: user.proxy_wallet_address,
    amount: params.amount,
    slippageBps: params.slippageBps,
  })
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = buildClobHmacSignature(auth.relayer.secret, timestamp, 'POST', path, body)

  try {
    const response = await fetch(`${relayerUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'KUEST_ADDRESS': user.address,
        'KUEST_API_KEY': auth.relayer.key,
        'KUEST_PASSPHRASE': auth.relayer.passphrase,
        'KUEST_TIMESTAMP': timestamp.toString(),
        'KUEST_SIGNATURE': signature,
      },
      body,
      signal: AbortSignal.timeout(15000),
    })

    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      const message = typeof payload?.error === 'string'
        ? payload.error
        : typeof payload?.message === 'string'
          ? payload.message
          : DEFAULT_ERROR_MESSAGE
      return { error: message }
    }

    if (!payload || typeof payload.nonce !== 'string' || !payload.transaction) {
      return { error: DEFAULT_ERROR_MESSAGE }
    }

    return { error: null, payload }
  }
  catch (error) {
    console.error('Failed to build pending deposit swap', error)
    return { error: DEFAULT_ERROR_MESSAGE }
  }
}

export async function submitPendingUsdcSwapAction(
  request: SafeTransactionRequestPayload,
): Promise<SubmitPendingDepositResult> {
  const user = await UserRepository.getCurrentUser({ disableCookieCache: true })
  if (!user) {
    return { error: 'Unauthenticated.' }
  }

  const auth = await getUserTradingAuthSecrets(user.id)
  if (!auth?.relayer) {
    return { error: TRADING_AUTH_REQUIRED_ERROR }
  }

  if (!user.proxy_wallet_address) {
    return { error: 'Deploy your proxy wallet first.' }
  }

  if (request.type !== 'SAFE') {
    return { error: 'Invalid transaction type.' }
  }

  if (request.from.toLowerCase() !== user.address.toLowerCase()) {
    return { error: 'Signer mismatch.' }
  }

  if (request.proxyWallet.toLowerCase() !== user.proxy_wallet_address.toLowerCase()) {
    return { error: 'Proxy wallet mismatch.' }
  }

  const relayerUrl = process.env.RELAYER_URL
  if (!relayerUrl) {
    return { error: DEFAULT_ERROR_MESSAGE }
  }

  const path = '/swap/usdc-e/submit'
  const body = JSON.stringify(request)
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = buildClobHmacSignature(auth.relayer.secret, timestamp, 'POST', path, body)

  try {
    const response = await fetch(`${relayerUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'KUEST_ADDRESS': user.address,
        'KUEST_API_KEY': auth.relayer.key,
        'KUEST_PASSPHRASE': auth.relayer.passphrase,
        'KUEST_TIMESTAMP': timestamp.toString(),
        'KUEST_SIGNATURE': signature,
      },
      body,
      signal: AbortSignal.timeout(20000),
    })

    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      const message = typeof payload?.error === 'string'
        ? payload.error
        : typeof payload?.message === 'string'
          ? payload.message
          : DEFAULT_ERROR_MESSAGE
      return { error: message }
    }

    const txHash = typeof payload?.txHash === 'string'
      ? payload.txHash
      : typeof payload?.hash === 'string'
        ? payload.hash
        : undefined

    return { error: null, txHash }
  }
  catch (error) {
    console.error('Failed to submit pending deposit swap', error)
    return { error: DEFAULT_ERROR_MESSAGE }
  }
}
