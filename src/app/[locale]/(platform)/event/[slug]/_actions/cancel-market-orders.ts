'use server'

import { z } from 'zod'
import { UserRepository } from '@/lib/db/queries/user'
import { buildClobHmacSignature } from '@/lib/hmac'
import { resolvePublicRuntimeEnv } from '@/lib/public-runtime-config.shared'
import {
  TRADING_AUTH_REQUIRED_ERROR,
  TRADING_DEPOSIT_WALLET_REQUIRED_ERROR,
  UNAUTHENTICATED_ERROR,
} from '@/lib/trading-auth/errors'
import { getUserTradingAuthSecrets } from '@/lib/trading-auth/server'
import {
  DEFAULT_CANCEL_OPEN_ORDERS_ERROR_MESSAGE,
  normalizeCancelOrdersResponse,
} from '@/lib/trading-flow-errors'

const OptionalNonEmptyString = z.preprocess(
  value => (typeof value === 'string' && value.trim().length === 0 ? undefined : value),
  z.string().trim().min(1).optional(),
)

const CancelMarketOrdersSchema = z.object({
  market: OptionalNonEmptyString,
  assetId: OptionalNonEmptyString,
}).refine(value => Boolean(value.market || value.assetId), {
  message: 'Market or asset is required.',
})

interface CancelMarketOrdersResult {
  cancelled: string[]
  notCanceled: Record<string, string>
  error: string | null
}

export async function cancelMarketOrdersAction(payload: { market?: string, assetId?: string }): Promise<CancelMarketOrdersResult> {
  const user = await UserRepository.getCurrentUser({ disableCookieCache: true, minimal: true })
  if (!user) {
    return { cancelled: [], notCanceled: {}, error: UNAUTHENTICATED_ERROR }
  }

  const auth = await getUserTradingAuthSecrets(user.id)
  if (!auth?.clob) {
    return { cancelled: [], notCanceled: {}, error: TRADING_AUTH_REQUIRED_ERROR }
  }
  if (!user.deposit_wallet_address) {
    return { cancelled: [], notCanceled: {}, error: TRADING_DEPOSIT_WALLET_REQUIRED_ERROR }
  }

  const parsed = CancelMarketOrdersSchema.safeParse(payload)
  if (!parsed.success) {
    return { cancelled: [], notCanceled: {}, error: parsed.error.issues[0]?.message ?? 'Invalid request.' }
  }

  const method = 'DELETE'
  const path = '/cancel-market-orders'
  const { clobUrl } = resolvePublicRuntimeEnv(process.env)
  const body = JSON.stringify({
    ...(parsed.data.market ? { market: parsed.data.market } : {}),
    ...(parsed.data.assetId ? { assetId: parsed.data.assetId } : {}),
  })
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = buildClobHmacSignature(
    auth.clob.secret,
    timestamp,
    method,
    path,
    body,
  )

  try {
    const response = await fetch(`${clobUrl}${path}`, {
      method,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'KUEST_ADDRESS': user.address,
        'KUEST_API_KEY': auth.clob.key,
        'KUEST_PASSPHRASE': auth.clob.passphrase,
        'KUEST_TIMESTAMP': timestamp.toString(),
        'KUEST_SIGNATURE': signature,
      },
      body,
      signal: AbortSignal.timeout(5_000),
    })

    let responsePayload: any
    try {
      responsePayload = await response.json()
    }
    catch {
      responsePayload = null
    }

    if (!response.ok) {
      const message = responsePayload && typeof responsePayload?.error === 'string'
        ? responsePayload.error
        : responsePayload && typeof responsePayload?.message === 'string'
          ? responsePayload.message
          : null

      console.error('Failed to cancel market orders on CLOB.', message ?? `Status ${response.status}`)
      return { cancelled: [], notCanceled: {}, error: message || DEFAULT_CANCEL_OPEN_ORDERS_ERROR_MESSAGE }
    }

    const normalized = normalizeCancelOrdersResponse(responsePayload)
    if (!normalized) {
      return { cancelled: [], notCanceled: {}, error: DEFAULT_CANCEL_OPEN_ORDERS_ERROR_MESSAGE }
    }

    return {
      cancelled: normalized.cancelled,
      notCanceled: normalized.notCanceled ?? {},
      error: null,
    }
  }
  catch (error) {
    console.error('Failed to cancel market orders.', error)
    return { cancelled: [], notCanceled: {}, error: DEFAULT_CANCEL_OPEN_ORDERS_ERROR_MESSAGE }
  }
}
