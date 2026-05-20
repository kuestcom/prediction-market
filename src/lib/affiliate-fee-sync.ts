'use server'

import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { buildClobHmacSignature } from '@/lib/hmac'
import { getUserTradingAuthSecrets } from '@/lib/trading-auth/server'

const SYNC_BUILDER_FEES_PATH = '/set-builder-fees'
const SYNC_BUILDER_FEES_TIMEOUT_MS = 330_000

function getErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const maybeError = (payload as { error?: unknown }).error
  return typeof maybeError === 'string' && maybeError.trim()
    ? maybeError
    : null
}

export async function syncBuilderFeesForAdmin(user: {
  id: string
  address: string
}) {
  const relayerUrl = process.env.RELAYER_URL
  if (!relayerUrl) {
    throw new Error(DEFAULT_ERROR_MESSAGE)
  }

  const tradingAuth = await getUserTradingAuthSecrets(user.id)
  if (!tradingAuth?.relayer) {
    throw new Error('Enable trading auth before syncing builder fees.')
  }

  const timestamp = Math.floor(Date.now() / 1000)
  const signature = buildClobHmacSignature(
    tradingAuth.relayer.secret,
    timestamp,
    'POST',
    SYNC_BUILDER_FEES_PATH,
  )

  const response = await fetch(`${relayerUrl}${SYNC_BUILDER_FEES_PATH}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      KUEST_ADDRESS: user.address,
      KUEST_API_KEY: tradingAuth.relayer.key,
      KUEST_PASSPHRASE: tradingAuth.relayer.passphrase,
      KUEST_TIMESTAMP: timestamp.toString(),
      KUEST_SIGNATURE: signature,
    },
    signal: AbortSignal.timeout(SYNC_BUILDER_FEES_TIMEOUT_MS),
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(getErrorMessage(payload) ?? DEFAULT_ERROR_MESSAGE)
  }
}
