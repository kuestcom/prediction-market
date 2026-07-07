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
import { DEFAULT_CANCEL_ORDER_ERROR_MESSAGE } from '@/lib/trading-flow-errors'

const CancelOrderSchema = z.object({
  orderId: z.string().min(1, 'Order id is required.'),
})

export async function cancelOrderAction(rawOrderId: string) {
  const user = await UserRepository.getCurrentUser({ disableCookieCache: true, minimal: true })
  if (!user) {
    return { error: UNAUTHENTICATED_ERROR }
  }

  const auth = await getUserTradingAuthSecrets(user.id)
  if (!auth?.clob) {
    return { error: TRADING_AUTH_REQUIRED_ERROR }
  }
  if (!user.deposit_wallet_address) {
    return { error: TRADING_DEPOSIT_WALLET_REQUIRED_ERROR }
  }

  const parsed = CancelOrderSchema.safeParse({ orderId: rawOrderId })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid order.' }
  }

  const method = 'DELETE'
  const path = '/order'
  const { clobUrl } = resolvePublicRuntimeEnv(process.env)
  const body = JSON.stringify({ orderId: parsed.data.orderId })
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

    let payload: any
    try {
      payload = await response.json()
    }
    catch {
      payload = null
    }

    if (!response.ok) {
      if (response.status === 404) {
        return { error: 'Order not found.' }
      }
      if (response.status === 409) {
        return { error: 'Order is already filled or cancelled.' }
      }

      const message = payload && typeof payload?.error === 'string'
        ? payload.error
        : payload && typeof payload?.message === 'string'
          ? payload.message
          : null

      console.error('Failed to cancel order on CLOB.', message ?? `Status ${response.status}`)
      return { error: message || DEFAULT_CANCEL_ORDER_ERROR_MESSAGE }
    }

    return { error: null }
  }
  catch (error) {
    console.error('Failed to cancel order.', error)
    return { error: DEFAULT_CANCEL_ORDER_ERROR_MESSAGE }
  }
}
