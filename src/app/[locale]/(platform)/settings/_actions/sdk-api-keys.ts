'use server'

import type {
  SdkApiKeyActionPayload,
  SdkApiKeyActionResult,
  SdkApiKeyBundle,
  SdkApiKeyCredential,
  SdkApiKeyRevokeResult,
  SdkApiKeyService,
} from '@/lib/sdk-api-keys'
import { and, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { UserRepository } from '@/lib/db/queries/user'
import { wallets } from '@/lib/db/schema/auth/tables'
import { db } from '@/lib/drizzle'
import { buildClobHmacSignature } from '@/lib/hmac'
import { SDK_API_KEY_NONCE } from '@/lib/sdk-api-keys'
import {
  mapTradingAuthError,
  readTradingFlowErrorResponse,
} from '@/lib/trading-flow-errors'
import { normalizeAddress } from '@/lib/wallet'

const SdkApiKeySignatureSchema = z.object({
  address: z.string().refine(value => Boolean(normalizeAddress(value)), 'Invalid wallet address.'),
  signature: z.string().min(1),
  timestamp: z.string().regex(/^\d+$/),
  nonce: z.literal(SDK_API_KEY_NONCE),
})

interface SdkApiKeyTarget {
  service: SdkApiKeyService
  baseUrl: string
}

interface ServiceFailure {
  service: SdkApiKeyService
}

function getSdkApiKeyTargets(): SdkApiKeyTarget[] {
  return [
    { service: 'clob' as const, baseUrl: process.env.CLOB_URL?.trim() ?? '' },
    { service: 'relayer' as const, baseUrl: process.env.RELAYER_URL?.trim() ?? '' },
  ].filter((target): target is SdkApiKeyTarget => Boolean(target.baseUrl))
}

function buildWalletHeaders(address: string, payload: SdkApiKeyActionPayload) {
  return {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'KUEST_ADDRESS': address,
    'KUEST_SIGNATURE': payload.signature,
    'KUEST_TIMESTAMP': payload.timestamp,
    'KUEST_NONCE': payload.nonce,
  }
}

async function resolveAuthorizedWalletAddress(user: { id?: unknown, address?: unknown }, address: string) {
  const normalizedAddress = normalizeAddress(address)
  if (!normalizedAddress) {
    return null
  }

  const normalizedLower = normalizedAddress.toLowerCase()
  const userAddress = normalizeAddress(typeof user.address === 'string' ? user.address : null)?.toLowerCase()
  if (userAddress === normalizedLower) {
    return normalizedAddress
  }

  if (typeof user.id !== 'string' || !user.id) {
    return null
  }

  const linkedWallet = await db
    .select({ id: wallets.id })
    .from(wallets)
    .where(and(
      eq(wallets.user_id, user.id),
      eq(sql`LOWER(${wallets.address})`, normalizedLower),
    ))
    .limit(1)

  return linkedWallet[0] ? normalizedAddress : null
}

function normalizeCredentialPayload(payload: Record<string, unknown>): SdkApiKeyCredential {
  const key = typeof payload.apiKey === 'string'
    ? payload.apiKey
    : typeof payload.api_key === 'string'
      ? payload.api_key
      : null
  const secret = typeof payload.secret === 'string' ? payload.secret : null
  const passphrase = typeof payload.passphrase === 'string' ? payload.passphrase : null

  if (!key || !secret || !passphrase) {
    throw new TypeError('Invalid response from auth service.')
  }

  return {
    key,
    secret,
    passphrase,
  }
}

async function requestCredential(
  target: SdkApiKeyTarget,
  path: '/auth/api-key' | '/auth/derive-api-key',
  method: 'GET' | 'POST',
  address: string,
  payload: SdkApiKeyActionPayload,
) {
  const response = await fetch(`${target.baseUrl}${path}`, {
    method,
    headers: buildWalletHeaders(address, payload),
    body: method === 'POST' ? '' : undefined,
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  })

  const { payload: responsePayload, rawError, contentType } = await readTradingFlowErrorResponse(response)
  if (!response.ok || !responsePayload) {
    console.error('SDK API key credential request failed.', {
      service: target.service,
      status: response.status,
      contentType,
    })

    throw new Error(mapTradingAuthError(rawError, {
      status: response.status,
      contentType,
      forceFallback: true,
    }))
  }

  return normalizeCredentialPayload(responsePayload)
}

async function revokeCredential(target: SdkApiKeyTarget, address: string, credential: SdkApiKeyCredential) {
  const path = '/auth/api-key'
  const method = 'DELETE'
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = buildClobHmacSignature(
    credential.secret,
    timestamp,
    method,
    path,
  )

  const response = await fetch(`${target.baseUrl}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      KUEST_ADDRESS: address,
      KUEST_API_KEY: credential.key,
      KUEST_PASSPHRASE: credential.passphrase,
      KUEST_TIMESTAMP: timestamp.toString(),
      KUEST_SIGNATURE: signature,
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  })

  if (!response.ok) {
    const { rawError, contentType } = await readTradingFlowErrorResponse(response)
    console.error('SDK API key revoke request failed.', {
      service: target.service,
      status: response.status,
      contentType,
    })

    throw new Error(mapTradingAuthError(rawError, {
      status: response.status,
      contentType,
      forceFallback: true,
    }))
  }
}

function makePartialWarning(failures: ServiceFailure[]) {
  if (!failures.length) {
    return null
  }

  const services = failures.map(failure => failure.service.toUpperCase()).join(', ')
  return `Completed for the available service only. Failed service: ${services}.`
}

async function runCredentialAction(
  input: z.input<typeof SdkApiKeySignatureSchema>,
  path: '/auth/api-key' | '/auth/derive-api-key',
  method: 'GET' | 'POST',
): Promise<SdkApiKeyActionResult> {
  const parsed = SdkApiKeySignatureSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid signature.', data: null }
  }

  const user = await UserRepository.getCurrentUser({ disableCookieCache: true, minimal: true })
  if (!user) {
    return { error: 'Unauthenticated.', data: null }
  }

  const address = await resolveAuthorizedWalletAddress(user, parsed.data.address)
  if (!address) {
    return { error: 'Connect the wallet linked to this account before managing SDK keys.', data: null }
  }

  const targets = getSdkApiKeyTargets()
  if (!targets.length) {
    return { error: DEFAULT_ERROR_MESSAGE, data: null }
  }

  const results = await Promise.allSettled(
    targets.map(async (target) => {
      const credential = await requestCredential(target, path, method, address, parsed.data)
      return { service: target.service, credential }
    }),
  )

  const data: SdkApiKeyBundle = { nonce: SDK_API_KEY_NONCE, address }
  const failures: ServiceFailure[] = []

  for (const [index, result] of results.entries()) {
    if (result.status === 'fulfilled') {
      data[result.value.service] = result.value.credential
    }
    else {
      failures.push({
        service: targets[index]?.service ?? 'clob',
      })
    }
  }

  if (!data.clob && !data.relayer) {
    return { error: DEFAULT_ERROR_MESSAGE, data: null }
  }

  return {
    error: null,
    warning: makePartialWarning(failures),
    data,
  }
}

export async function generateSdkApiKeyAction(input: z.input<typeof SdkApiKeySignatureSchema>): Promise<SdkApiKeyActionResult> {
  return runCredentialAction(input, '/auth/api-key', 'POST')
}

export async function revealSdkApiKeyAction(input: z.input<typeof SdkApiKeySignatureSchema>): Promise<SdkApiKeyActionResult> {
  return runCredentialAction(input, '/auth/derive-api-key', 'GET')
}

export async function revokeSdkApiKeyAction(input: z.input<typeof SdkApiKeySignatureSchema>): Promise<SdkApiKeyRevokeResult> {
  const parsed = SdkApiKeySignatureSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid signature.', data: null }
  }

  const user = await UserRepository.getCurrentUser({ disableCookieCache: true, minimal: true })
  if (!user) {
    return { error: 'Unauthenticated.', data: null }
  }

  const address = await resolveAuthorizedWalletAddress(user, parsed.data.address)
  if (!address) {
    return { error: 'Connect the wallet linked to this account before managing SDK keys.', data: null }
  }

  const targets = getSdkApiKeyTargets()
  if (!targets.length) {
    return { error: DEFAULT_ERROR_MESSAGE, data: null }
  }

  const results = await Promise.allSettled(
    targets.map(async (target) => {
      const credential = await requestCredential(
        target,
        '/auth/derive-api-key',
        'GET',
        address,
        parsed.data,
      )
      await revokeCredential(target, address, credential)
      return target.service
    }),
  )

  const revoked: Partial<Record<SdkApiKeyService, boolean>> = {}
  const failures: ServiceFailure[] = []

  for (const [index, result] of results.entries()) {
    if (result.status === 'fulfilled') {
      revoked[result.value] = true
    }
    else {
      failures.push({
        service: targets[index]?.service ?? 'clob',
      })
    }
  }

  if (!revoked.clob && !revoked.relayer) {
    return { error: DEFAULT_ERROR_MESSAGE, data: null }
  }

  return {
    error: null,
    warning: makePartialWarning(failures),
    data: {
      nonce: SDK_API_KEY_NONCE,
      revoked,
    },
  }
}
