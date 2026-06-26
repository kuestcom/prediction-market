'use server'

import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { buildClobHmacSignature } from '@/lib/hmac'
import { resolvePublicRuntimeEnv } from '@/lib/public-runtime-config.shared'
import { getUserTradingAuthSecrets } from '@/lib/trading-auth/server'

const SYNC_BUILDER_FEES_PATH = '/set-builder-fees'
const SYNC_BUILDER_FEES_TIMEOUT_MS = 330_000

export interface SyncBuilderFeesPayload {
  feeRecipientWallet: string
  builderTakerFeeBps: number
  builderMakerFeeBps: number
}

function getErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const { error, message } = payload as { error?: unknown, message?: unknown }
  for (const value of [error, message]) {
    if (typeof value === 'string' && value.trim()) {
      return value
    }
  }

  return null
}

export async function syncBuilderFeesForAdmin(user: {
  id: string
  address: string
}, payload: SyncBuilderFeesPayload) {
  const { relayerUrl } = resolvePublicRuntimeEnv(process.env)

  const tradingAuth = await getUserTradingAuthSecrets(user.id)
  if (!tradingAuth?.relayer) {
    throw new Error('Enable trading auth before syncing builder fees.')
  }

  const timestamp = Math.floor(Date.now() / 1000)
  const requestBody = JSON.stringify(payload)
  const signature = buildClobHmacSignature(
    tradingAuth.relayer.secret,
    timestamp,
    'POST',
    SYNC_BUILDER_FEES_PATH,
    requestBody,
  )

  let response: Response
  try {
    response = await fetch(`${relayerUrl}${SYNC_BUILDER_FEES_PATH}`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'KUEST_ADDRESS': user.address,
        'KUEST_API_KEY': tradingAuth.relayer.key,
        'KUEST_PASSPHRASE': tradingAuth.relayer.passphrase,
        'KUEST_TIMESTAMP': timestamp.toString(),
        'KUEST_SIGNATURE': signature,
      },
      body: requestBody,
      signal: AbortSignal.timeout(SYNC_BUILDER_FEES_TIMEOUT_MS),
    })
  }
  catch (error) {
    console.error('Failed to sync builder fees through relayer', error)
    throw new Error(DEFAULT_ERROR_MESSAGE)
  }

  const responsePayload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(getErrorMessage(responsePayload) ?? DEFAULT_ERROR_MESSAGE)
  }
}
