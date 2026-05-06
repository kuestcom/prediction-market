'use server'

import type { SafeTransactionRequestPayload } from '@/lib/safe/transactions'
import type { WalletTransactionRequestPayload } from '@/lib/wallet/transactions'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { DEPOSIT_WALLET_FACTORY_ADDRESS } from '@/lib/contracts'
import { UserRepository } from '@/lib/db/queries/user'
import { buildClobHmacSignature } from '@/lib/hmac'
import { TRADING_AUTH_REQUIRED_ERROR } from '@/lib/trading-auth/errors'
import { getUserTradingAuthSecrets, markTokenApprovalsCompleted } from '@/lib/trading-auth/server'
import {
  getTradingFlowErrorPreview,
  mapApproveTokensError,
  readTradingFlowErrorResponse,
} from '@/lib/trading-flow-errors'

interface SafeNonceResult {
  error: string | null
  code?: string
  nonce?: string
}

interface SubmitSafeTransactionResult {
  error: string | null
  code?: string
  approvals?: {
    enabled: boolean
    updatedAt: string
    version: string
  }
  txHash?: string
}

function resolveWalletSubmitErrorCode(rawError: string | null | undefined) {
  const normalized = rawError?.trim().toLowerCase() ?? ''
  if (!normalized) {
    return undefined
  }
  if (normalized === 'wallet_nonce_mismatch' || normalized.includes('wallet_nonce_mismatch')) {
    return 'wallet_nonce_mismatch'
  }
  if (normalized === 'deadline_expired' || normalized.includes('deadline expired')) {
    return 'deadline_expired'
  }
  if (normalized === 'deposit_wallet_not_deployed') {
    return 'deposit_wallet_not_deployed'
  }
  return undefined
}

function friendlyWalletSubmitError(rawError: string | null | undefined, fallback: string) {
  const code = resolveWalletSubmitErrorCode(rawError)
  switch (code) {
    case 'wallet_nonce_mismatch':
      return 'Your Deposit Wallet nonce changed. Please try again.'
    case 'deadline_expired':
      return 'Your signature expired. Please sign again.'
    case 'deposit_wallet_not_deployed':
      return 'Your Deposit Wallet is still being created. Try again in a moment.'
    default:
      return fallback
  }
}

async function syncClobCollateralBalanceAllowanceSignatureType3(user: {
  address: string
  id: string
}) {
  const auth = await getUserTradingAuthSecrets(user.id)
  if (!auth?.clob) {
    return
  }

  const clobUrl = process.env.CLOB_URL
  if (!clobUrl) {
    return
  }

  const query = 'asset_type=COLLATERAL&signature_type=3'
  const path = `/balance-allowance/update?${query}`
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = buildClobHmacSignature(auth.clob.secret, timestamp, 'GET', path)

  try {
    const response = await fetch(`${clobUrl}${path}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        KUEST_ADDRESS: user.address,
        KUEST_API_KEY: auth.clob.key,
        KUEST_PASSPHRASE: auth.clob.passphrase,
        KUEST_TIMESTAMP: timestamp.toString(),
        KUEST_SIGNATURE: signature,
      },
      signal: AbortSignal.timeout(10_000),
    })

    if (!response.ok) {
      console.warn('Failed to sync CLOB balance/allowance after Deposit Wallet approval.', {
        status: response.status,
      })
    }
  }
  catch (error) {
    console.warn('Failed to sync CLOB balance/allowance after Deposit Wallet approval.', error)
  }
}

export async function getDepositWalletNonceAction(): Promise<SafeNonceResult> {
  const user = await UserRepository.getCurrentUser({ disableCookieCache: true })
  if (!user) {
    return { error: 'Unauthenticated.' }
  }
  if (!user.proxy_wallet_address) {
    return { error: 'Set up your Deposit Wallet before signing.', code: 'missing_deposit_wallet' }
  }
  if (user.proxy_wallet_status !== 'deployed') {
    return { error: 'Your Deposit Wallet is still being created. Try again in a moment.', code: 'deposit_wallet_not_deployed' }
  }

  const auth = await getUserTradingAuthSecrets(user.id)
  if (!auth?.relayer) {
    return { error: TRADING_AUTH_REQUIRED_ERROR }
  }

  const relayerUrl = process.env.RELAYER_URL
  if (!relayerUrl) {
    return { error: DEFAULT_ERROR_MESSAGE }
  }

  const query = `address=${encodeURIComponent(user.address)}&type=WALLET`
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

    const { payload, rawError, contentType } = await readTradingFlowErrorResponse(response)
    if (!response.ok || typeof payload?.nonce !== 'string') {
      console.error('Failed to fetch Deposit Wallet nonce response.', {
        status: response.status,
        contentType,
        rawError: getTradingFlowErrorPreview(rawError),
      })
      const message = mapApproveTokensError(rawError, {
        status: response.status,
        contentType,
        forceFallback: response.ok,
      })
      return { error: message, code: resolveWalletSubmitErrorCode(rawError) }
    }

    return { error: null, nonce: payload.nonce }
  }
  catch (error) {
    console.error('Failed to fetch Deposit Wallet nonce', error)
    return { error: DEFAULT_ERROR_MESSAGE }
  }
}

export async function submitDepositWalletTransactionAction(
  request: WalletTransactionRequestPayload,
): Promise<SubmitSafeTransactionResult> {
  const user = await UserRepository.getCurrentUser({ disableCookieCache: true })
  if (!user) {
    return { error: 'Unauthenticated.' }
  }

  const auth = await getUserTradingAuthSecrets(user.id)
  if (!auth?.relayer) {
    return { error: TRADING_AUTH_REQUIRED_ERROR }
  }

  if (!user.proxy_wallet_address) {
    return { error: 'Set up your Deposit Wallet first.', code: 'missing_deposit_wallet' }
  }

  if (request.type !== 'WALLET') {
    return { error: 'Invalid transaction type.' }
  }

  if (request.from.toLowerCase() !== user.address.toLowerCase()) {
    return { error: 'Signer mismatch.' }
  }

  const depositWallet = request.depositWalletParams?.depositWallet
    ?? request.signatureParams?.depositWalletParams?.depositWallet

  if (!depositWallet || depositWallet.toLowerCase() !== user.proxy_wallet_address.toLowerCase()) {
    return { error: 'Deposit Wallet mismatch.' }
  }

  if (request.to.toLowerCase() !== DEPOSIT_WALLET_FACTORY_ADDRESS.toLowerCase()) {
    return { error: 'Invalid Deposit Wallet target.' }
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
      signal: AbortSignal.timeout(15_000),
    })

    const { payload, rawError, contentType } = await readTradingFlowErrorResponse(response)
    if (!response.ok || !payload) {
      console.error('Failed to submit Deposit Wallet transaction response.', {
        status: response.status,
        contentType,
        rawError: getTradingFlowErrorPreview(rawError),
      })
      const fallback = mapApproveTokensError(rawError, {
        status: response.status,
        contentType,
        forceFallback: response.ok,
      })
      const code = resolveWalletSubmitErrorCode(rawError)
      return {
        error: friendlyWalletSubmitError(rawError, fallback),
        code,
      }
    }

    let approvals
    if (request.metadata === 'approve_tokens') {
      approvals = await markTokenApprovalsCompleted(user.id)
      await syncClobCollateralBalanceAllowanceSignatureType3(user)
    }

    const txHash = typeof payload?.txHash === 'string'
      ? payload.txHash
      : typeof payload?.tx_hash === 'string'
        ? payload.tx_hash
        : typeof payload?.transactionHash === 'string'
          ? payload.transactionHash
          : typeof payload?.hash === 'string'
            ? payload.hash
            : undefined

    return { error: null, approvals, txHash }
  }
  catch (error) {
    console.error('Failed to submit Deposit Wallet transaction', error)
    return { error: DEFAULT_ERROR_MESSAGE }
  }
}

export async function getSafeNonceAction(): Promise<SafeNonceResult> {
  const user = await UserRepository.getCurrentUser({ disableCookieCache: true })
  if (!user) {
    return { error: 'Unauthenticated.' }
  }
  if (!user.proxy_wallet_address) {
    return { error: 'Set up your Deposit Wallet before approving tokens.' }
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

    const { payload, rawError, contentType } = await readTradingFlowErrorResponse(response)
    if (!response.ok || typeof payload?.nonce !== 'string') {
      console.error('Failed to fetch safe nonce response.', {
        status: response.status,
        contentType,
        rawError: getTradingFlowErrorPreview(rawError),
      })
      const message = mapApproveTokensError(rawError, {
        status: response.status,
        contentType,
        forceFallback: response.ok,
      })
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
    return { error: 'Set up your Deposit Wallet first.' }
  }

  if (request.type !== 'SAFE') {
    return { error: 'Invalid transaction type.' }
  }

  if (request.from.toLowerCase() !== user.address.toLowerCase()) {
    return { error: 'Signer mismatch.' }
  }

  if (request.proxyWallet.toLowerCase() !== user.proxy_wallet_address.toLowerCase()) {
    return { error: 'Deposit Wallet mismatch.' }
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

    const { payload, rawError, contentType } = await readTradingFlowErrorResponse(response)
    if (!response.ok || !payload) {
      console.error('Failed to submit safe transaction response.', {
        status: response.status,
        contentType,
        rawError: getTradingFlowErrorPreview(rawError),
      })
      const message = mapApproveTokensError(rawError, {
        status: response.status,
        contentType,
        forceFallback: response.ok,
      })
      return { error: message }
    }

    let approvals
    if (request.metadata === 'approve_tokens') {
      approvals = await markTokenApprovalsCompleted(user.id)
    }

    const txHash = typeof payload?.txHash === 'string'
      ? payload.txHash
      : typeof payload?.tx_hash === 'string'
        ? payload.tx_hash
        : typeof payload?.transactionHash === 'string'
          ? payload.transactionHash
          : typeof payload?.hash === 'string'
            ? payload.hash
            : undefined

    return { error: null, approvals, txHash }
  }
  catch (error) {
    console.error('Failed to submit safe transaction', error)
    return { error: DEFAULT_ERROR_MESSAGE }
  }
}
