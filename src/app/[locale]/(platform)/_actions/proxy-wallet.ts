'use server'

import type { ProxyWalletStatus } from '@/types'
import { eq } from 'drizzle-orm'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { UserRepository } from '@/lib/db/queries/user'
import { users } from '@/lib/db/schema/auth/tables'
import { db } from '@/lib/drizzle'
import { buildClobHmacSignature } from '@/lib/hmac'
import {
  getSafeProxyWalletAddress,
  isProxyWalletDeployed,
  SAFE_PROXY_CREATE_PROXY_MESSAGE,
} from '@/lib/safe-proxy'
import { TRADING_AUTH_REQUIRED_ERROR } from '@/lib/trading-auth/errors'
import { getUserTradingAuthSecrets } from '@/lib/trading-auth/server'

interface SaveProxyWalletSignatureArgs {
  signature: string
}

interface SaveProxyWalletSignatureResult {
  data: {
    proxy_wallet_address: string | null
    proxy_wallet_signature: string | null
    proxy_wallet_signed_at: string | null
    proxy_wallet_status: ProxyWalletStatus | null
    proxy_wallet_tx_hash: string | null
  } | null
  error: string | null
}

export async function saveProxyWalletSignature({ signature }: SaveProxyWalletSignatureArgs): Promise<SaveProxyWalletSignatureResult> {
  const trimmedSignature = signature.trim()

  if (!trimmedSignature || !trimmedSignature.startsWith('0x')) {
    return { data: null, error: 'Invalid signature received.' }
  }

  const currentUser = await UserRepository.getCurrentUser({ disableCookieCache: true })
  if (!currentUser) {
    return { data: null, error: 'Unauthenticated.' }
  }

  try {
    const hasStoredRelayerAuth = Boolean(currentUser.settings?.tradingAuth?.relayer?.enabled)
    const tradingAuth = await getUserTradingAuthSecrets(currentUser.id)
    if (hasStoredRelayerAuth && !tradingAuth?.relayer) {
      return { data: null, error: TRADING_AUTH_REQUIRED_ERROR }
    }

    const relayerAuth = tradingAuth?.relayer
      ? {
          key: tradingAuth.relayer.key,
          secret: tradingAuth.relayer.secret,
          passphrase: tradingAuth.relayer.passphrase,
          address: currentUser.address,
        }
      : {
          key: process.env.KUEST_API_KEY ?? '',
          secret: process.env.KUEST_API_SECRET ?? '',
          passphrase: process.env.KUEST_PASSPHRASE ?? '',
          address: process.env.KUEST_ADDRESS ?? '',
        }

    if (!relayerAuth.key || !relayerAuth.secret || !relayerAuth.passphrase || !relayerAuth.address) {
      return { data: null, error: 'Relayer credentials not configured.' }
    }

    const proxyAddress = currentUser.proxy_wallet_address
      ? currentUser.proxy_wallet_address as `0x${string}`
      : await getSafeProxyWalletAddress(currentUser.address as `0x${string}`)
    let proxyIsDeployed = await isProxyWalletDeployed(proxyAddress)
    let txHash: string | null = currentUser.proxy_wallet_tx_hash ?? null
    if (!proxyIsDeployed) {
      txHash = await triggerSafeProxyDeployment({
        owner: currentUser.address,
        signature: trimmedSignature,
        auth: relayerAuth,
      })
      proxyIsDeployed = await isProxyWalletDeployed(proxyAddress)
    }

    let nextStatus: ProxyWalletStatus = 'signed'
    if (proxyIsDeployed) {
      nextStatus = 'deployed'
      txHash = null
    }
    else if (txHash) {
      nextStatus = 'deploying'
    }

    const [updated] = await db
      .update(users)
      .set({
        proxy_wallet_signature: trimmedSignature,
        proxy_wallet_address: proxyAddress,
        proxy_wallet_signed_at: new Date(),
        proxy_wallet_status: nextStatus,
        proxy_wallet_tx_hash: txHash,
      })
      .where(eq(users.id, currentUser.id))
      .returning({
        proxy_wallet_address: users.proxy_wallet_address,
        proxy_wallet_signature: users.proxy_wallet_signature,
        proxy_wallet_signed_at: users.proxy_wallet_signed_at,
        proxy_wallet_status: users.proxy_wallet_status,
        proxy_wallet_tx_hash: users.proxy_wallet_tx_hash,
      })

    if (!updated) {
      return { data: null, error: DEFAULT_ERROR_MESSAGE }
    }

    return {
      data: {
        proxy_wallet_address: updated.proxy_wallet_address,
        proxy_wallet_signature: updated.proxy_wallet_signature,
        proxy_wallet_signed_at: updated.proxy_wallet_signed_at?.toISOString() ?? null,
        proxy_wallet_status: updated.proxy_wallet_status as ProxyWalletStatus | null,
        proxy_wallet_tx_hash: updated.proxy_wallet_tx_hash,
      },
      error: null,
    }
  }
  catch (error) {
    console.error('Failed to save proxy wallet signature', error)
    const message = error instanceof Error && error.message ? error.message : DEFAULT_ERROR_MESSAGE
    return { data: null, error: message }
  }
}

async function triggerSafeProxyDeployment({
  owner,
  signature,
  auth,
}: {
  owner: string
  signature: string
  auth: { key: string, secret: string, passphrase: string, address: string }
}) {
  const relayerUrl = process.env.RELAYER_URL!
  const method = 'POST'
  const path = '/wallet/safe'

  const payload = {
    owner,
    paymentToken: SAFE_PROXY_CREATE_PROXY_MESSAGE.paymentToken,
    payment: SAFE_PROXY_CREATE_PROXY_MESSAGE.payment.toString(),
    paymentReceiver: SAFE_PROXY_CREATE_PROXY_MESSAGE.paymentReceiver,
    signature,
  }

  const body = JSON.stringify(payload)
  const timestamp = Math.floor(Date.now() / 1000)
  const hmacSignature = buildClobHmacSignature(
    auth.secret,
    timestamp,
    method,
    path,
    body,
  )

  const response = await fetch(`${relayerUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'KUEST_ADDRESS': auth.address,
      'KUEST_API_KEY': auth.key,
      'KUEST_PASSPHRASE': auth.passphrase,
      'KUEST_TIMESTAMP': timestamp.toString(),
      'KUEST_SIGNATURE': hmacSignature,
    },
    body,
    signal: AbortSignal.timeout(15_000),
  })

  const responseForText = response.clone()

  let json: any
  try {
    json = await response.json()
  }
  catch {
    json = null
  }

  if (!response.ok) {
    const messageFromJson = json && typeof json?.error === 'string'
      ? json.error
      : json && typeof json?.message === 'string'
        ? json.message
        : null

    let messageFromText: string | null = null
    if (!messageFromJson) {
      try {
        const text = await responseForText.text()
        messageFromText = text.trim().slice(0, 300) || null
      }
      catch {
        messageFromText = null
      }
    }

    const message = messageFromJson ?? messageFromText ?? DEFAULT_ERROR_MESSAGE
    throw new Error(message)
  }

  return json && typeof json?.txHash === 'string' ? json.txHash : null
}
