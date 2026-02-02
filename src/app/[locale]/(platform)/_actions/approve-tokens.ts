'use server'

import type { SafeTransactionRequestPayload } from '@/lib/safe/transactions'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { UserRepository } from '@/lib/db/queries/user'
import { buildClobHmacSignature } from '@/lib/hmac'
import { TRADING_AUTH_REQUIRED_ERROR } from '@/lib/trading-auth/errors'
import { getUserTradingAuthSecrets, markTokenApprovalsCompleted } from '@/lib/trading-auth/server'

interface SafeNonceResult {
  error: string | null
  nonce?: string
}

interface SubmitSafeTransactionResult {
  error: string | null
  approvals?: {
    enabled: boolean
    updatedAt: string
  }
}

export async function getSafeNonceAction(): Promise<SafeNonceResult> {
  const user = await UserRepository.getCurrentUser({ disableCookieCache: true })
  if (!user) {
    return { error: 'Unauthenticated.' }
  }
  if (!user.proxy_wallet_address) {
    return { error: 'Deploy your proxy wallet before approving tokens.' }
  }

  const auth = await getUserTradingAuthSecrets(user.id)
  if (!auth?.relayer) {
    return { error: TRADING_AUTH_REQUIRED_ERROR }
  }

  const relayerUrl = process.env.RELAYER_URL
  if (!relayerUrl) {
    return { error: DEFAULT_ERROR_MESSAGE }
  }

  const query = `address=${encodeURIComponent(user.address)}&type=SAFE`
  const path = `/nonce?${query}`
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = buildClobHmacSignature(auth.relayer.secret, timestamp, 'GET', path)

  try {
    const response = await fetch(`${relayerUrl}${path}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        KUEST_ADDRESS: user.address,
        KUEST_API_KEY: auth.relayer.key,
        KUEST_PASSPHRASE: auth.relayer.passphrase,
        KUEST_TIMESTAMP: timestamp.toString(),
        KUEST_SIGNATURE: signature,
      },
      signal: AbortSignal.timeout(10_000),
    })

    const payload = await response.json().catch(() => null)
    if (!response.ok || typeof payload?.nonce !== 'string') {
      const message = typeof payload?.error === 'string'
        ? payload.error
        : DEFAULT_ERROR_MESSAGE
      return { error: message }
    }

    return { error: null, nonce: payload.nonce }
  }
  catch (error) {
    console.error('Failed to fetch safe nonce', error)
    return { error: DEFAULT_ERROR_MESSAGE }
  }
}

export async function submitSafeTransactionAction(request: SafeTransactionRequestPayload): Promise<SubmitSafeTransactionResult> {
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

  const path = '/submit'
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

    let approvals
    if (request.metadata === 'approve_tokens') {
      approvals = await markTokenApprovalsCompleted(user.id)
    }

    return { error: null, approvals }
  }
  catch (error) {
    console.error('Failed to submit safe transaction', error)
    return { error: DEFAULT_ERROR_MESSAGE }
  }
}
