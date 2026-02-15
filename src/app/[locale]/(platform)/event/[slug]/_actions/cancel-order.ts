'use server'

import { z } from 'zod'
import { UserRepository } from '@/lib/db/queries/user'
import { buildClobHmacSignature } from '@/lib/hmac'
import { TRADING_AUTH_REQUIRED_ERROR } from '@/lib/trading-auth/errors'
import { getUserTradingAuthSecrets } from '@/lib/trading-auth/server'

const CancelOrderSchema = z.object({
  orderId: z.string().min(1, 'Order id is required.'),
})

const CANCEL_ORDER_ERROR = 'Unable to cancel this order right now. Please try again.'

export async function cancelOrderAction(rawOrderId: string) {
  const user = await UserRepository.getCurrentUser({ disableCookieCache: true })
  if (!user) {
    return { error: 'Unauthenticated.' }
  }

  const auth = await getUserTradingAuthSecrets(user.id)
  if (!auth?.clob) {
    return { error: TRADING_AUTH_REQUIRED_ERROR }
  }
  if (!user.proxy_wallet_address) {
    return { error: 'Deploy your proxy wallet before trading.' }
  }

  const parsed = CancelOrderSchema.safeParse({ orderId: rawOrderId })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid order.' }
  }

  const method = 'DELETE'
  const path = '/order'
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
      return { error: message || CANCEL_ORDER_ERROR }
    }

    return { error: null }
  }
  catch (error) {
    console.error('Failed to cancel order.', error)
    return { error: CANCEL_ORDER_ERROR }
  }
}
