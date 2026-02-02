'use server'

import { z } from 'zod'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { UserRepository } from '@/lib/db/queries/user'
import { saveUserTradingAuthCredentials } from '@/lib/trading-auth/server'

interface TradingAuthActionResult {
  error: string | null
  data: {
    relayer?: { enabled: boolean, updatedAt: string }
    clob?: { enabled: boolean, updatedAt: string }
  } | null
}

const GenerateTradingAuthSchema = z.object({
  signature: z.string().min(1),
  timestamp: z.string().min(1),
  nonce: z.string().min(1),
})

async function requestApiKey(baseUrl: string, headers: Record<string, string>) {
  const response = await fetch(`${baseUrl}/auth/api-key`, {
    method: 'POST',
    headers,
    body: '',
    signal: AbortSignal.timeout(10_000),
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload) {
    const message = typeof payload?.error === 'string'
      ? payload.error
      : typeof payload?.message === 'string'
        ? payload.message
        : DEFAULT_ERROR_MESSAGE
    throw new Error(message)
  }

  if (
    typeof payload?.apiKey !== 'string'
    || typeof payload?.secret !== 'string'
    || typeof payload?.passphrase !== 'string'
  ) {
    throw new TypeError('Invalid response from auth service.')
  }

  return {
    key: payload.apiKey,
    secret: payload.secret as string,
    passphrase: payload.passphrase as string,
  }
}

export async function generateTradingAuthAction(input: z.input<typeof GenerateTradingAuthSchema>): Promise<TradingAuthActionResult> {
  const user = await UserRepository.getCurrentUser({ disableCookieCache: true })
  if (!user) {
    return { error: 'Unauthenticated.', data: null }
  }
  if (!user.proxy_wallet_address) {
    return { error: 'Deploy your proxy wallet before enabling trading.', data: null }
  }

  const parsed = GenerateTradingAuthSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid signature.', data: null }
  }

  const relayerUrl = process.env.RELAYER_URL
  const clobUrl = process.env.CLOB_URL
  if (!relayerUrl || !clobUrl) {
    return { error: DEFAULT_ERROR_MESSAGE, data: null }
  }

  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'KUEST_ADDRESS': user.address,
    'KUEST_SIGNATURE': parsed.data.signature,
    'KUEST_TIMESTAMP': parsed.data.timestamp,
    'KUEST_NONCE': parsed.data.nonce,
  }

  try {
    const [relayerCreds, clobCreds] = await Promise.all([
      requestApiKey(relayerUrl, headers),
      requestApiKey(clobUrl, headers),
    ])

    await saveUserTradingAuthCredentials(user.id, {
      relayer: relayerCreds,
      clob: clobCreds,
    })

    const updatedAt = new Date().toISOString()
    return {
      error: null,
      data: {
        relayer: { enabled: true, updatedAt },
        clob: { enabled: true, updatedAt },
      },
    }
  }
  catch (error) {
    console.error('Failed to generate trading auth credentials', error)
    const message = error instanceof Error ? error.message : DEFAULT_ERROR_MESSAGE
    return { error: message, data: null }
  }
}
