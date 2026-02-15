'use server'

import { z } from 'zod'
import { UserRepository } from '@/lib/db/queries/user'
import { buildClobHmacSignature } from '@/lib/hmac'
import { TRADING_AUTH_REQUIRED_ERROR } from '@/lib/trading-auth/errors'
import { getUserTradingAuthSecrets } from '@/lib/trading-auth/server'

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

const CANCEL_MARKET_ORDERS_ERROR = 'Unable to cancel open orders right now. Please try again.'

interface CancelMarketOrdersResult {
  cancelled: string[]
  notCanceled: Record<string, string>
  error: string | null
}

function normalizeCancelResponse(payload: any) {
  const cancelled = Array.isArray(payload?.cancelled)
    ? payload.cancelled
    : Array.isArray(payload?.canceled)
      ? payload.canceled
      : null
  const notCanceled = payload?.notCanceled ?? payload?.not_canceled ?? null

  if (!Array.isArray(cancelled) || !notCanceled || typeof notCanceled !== 'object' || Array.isArray(notCanceled)) {
    return null
  }

  return { cancelled, notCanceled }
}

export async function cancelMarketOrdersAction(payload: { market?: string, assetId?: string }): Promise<CancelMarketOrdersResult> {
  const user = await UserRepository.getCurrentUser({ disableCookieCache: true })
  if (!user) {
    return { cancelled: [], notCanceled: {}, error: 'Unauthenticated.' }
  }

  const auth = await getUserTradingAuthSecrets(user.id)
  if (!auth?.clob) {
    return { cancelled: [], notCanceled: {}, error: TRADING_AUTH_REQUIRED_ERROR }
  }
  if (!user.proxy_wallet_address) {
    return { cancelled: [], notCanceled: {}, error: 'Deploy your proxy wallet before trading.' }
  }

  const parsed = CancelMarketOrdersSchema.safeParse(payload)
  if (!parsed.success) {
    return { cancelled: [], notCanceled: {}, error: parsed.error.issues[0]?.message ?? 'Invalid request.' }
  }

  const method = 'DELETE'
  const path = '/cancel-market-orders'
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
    const response = await fetch(`${process.env.CLOB_URL}${path}`, {
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
      return { cancelled: [], notCanceled: {}, error: message || CANCEL_MARKET_ORDERS_ERROR }
    }

    const normalized = normalizeCancelResponse(responsePayload)
    if (!normalized) {
      return { cancelled: [], notCanceled: {}, error: CANCEL_MARKET_ORDERS_ERROR }
    }

    return {
      cancelled: normalized.cancelled,
      notCanceled: normalized.notCanceled ?? {},
      error: null,
    }
  }
  catch (error) {
    console.error('Failed to cancel market orders.', error)
    return { cancelled: [], notCanceled: {}, error: CANCEL_MARKET_ORDERS_ERROR }
  }
}
