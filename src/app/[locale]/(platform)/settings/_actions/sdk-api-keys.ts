'use server'

import type {
  SdkApiKeyActionPayload,
  SdkApiKeyActionResult,
  SdkApiKeyBundle,
  SdkApiKeyCredential,
  SdkApiKeyNextNonceResult,
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
import { resolvePublicRuntimeEnv } from '@/lib/public-runtime-config.shared'
import { getUserTradingAuthSecrets } from '@/lib/trading-auth/server'
import {
  mapTradingAuthError,
  readTradingFlowErrorResponse,
} from '@/lib/trading-flow-errors'
import { normalizeAddress } from '@/lib/wallet'

const SdkApiKeySignatureSchema = z.object({
  address: z.string().refine(value => Boolean(normalizeAddress(value)), 'Invalid wallet address.'),
  signature: z.string().min(1),
  timestamp: z.string().regex(/^\d+$/),
  nonce: z.string().regex(/^\d+$/),
})

const SdkApiKeyNextNonceSchema = z.object({
  address: z.string().refine(value => Boolean(normalizeAddress(value)), 'Invalid wallet address.'),
})

interface SdkApiKeyTarget {
  service: SdkApiKeyService
  baseUrl: string
}

interface ServiceFailure {
  service: SdkApiKeyService
}

interface ApiKeyMetadata {
  key: string
  nonce: string
  status: string
}

function getSdkApiKeyTargets(): SdkApiKeyTarget[] {
  const { clobUrl, relayerUrl } = resolvePublicRuntimeEnv(process.env)
  return [
    { service: 'clob' as const, baseUrl: clobUrl },
    { service: 'relayer' as const, baseUrl: relayerUrl },
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

function buildL2Headers(address: string, credential: SdkApiKeyCredential, path: string) {
  const method = 'GET'
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = buildClobHmacSignature(
    credential.secret,
    timestamp,
    method,
    path,
  )

  return {
    Accept: 'application/json',
    KUEST_ADDRESS: address,
    KUEST_API_KEY: credential.key,
    KUEST_PASSPHRASE: credential.passphrase,
    KUEST_TIMESTAMP: timestamp.toString(),
    KUEST_SIGNATURE: signature,
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

function normalizeApiKeyMetadata(payload: unknown): ApiKeyMetadata[] {
  if (!Array.isArray(payload)) {
    return []
  }

  return payload.flatMap((item) => {
    if (!item || typeof item !== 'object') {
      return []
    }

    const record = item as Record<string, unknown>
    const key = typeof record.apiKey === 'string'
      ? record.apiKey
      : typeof record.api_key === 'string'
        ? record.api_key
        : typeof record.key === 'string'
          ? record.key
          : null
    const nonce = typeof record.nonce === 'string'
      ? record.nonce
      : typeof record.nonce === 'number' && Number.isInteger(record.nonce)
        ? record.nonce.toString()
        : null
    const status = typeof record.status === 'string' ? record.status : 'active'

    if (!key || !nonce) {
      return []
    }

    return [{ key, nonce, status }]
  })
}

function getTargetCredential(
  auth: Awaited<ReturnType<typeof getUserTradingAuthSecrets>>,
  service: SdkApiKeyService,
) {
  return service === 'clob' ? auth?.clob : auth?.relayer
}

function nextNonceFromMetadata(keys: ApiKeyMetadata[]) {
  let maxNonce: bigint | null = null

  for (const key of keys) {
    try {
      const value = BigInt(key.nonce)
      if (value < 0n) {
        continue
      }
      if (maxNonce === null || value > maxNonce) {
        maxNonce = value
      }
    }
    catch {
      continue
    }
  }

  return maxNonce === null ? '0' : (maxNonce + 1n).toString()
}

async function listApiKeyMetadata(
  target: SdkApiKeyTarget,
  address: string,
  credential: SdkApiKeyCredential,
) {
  const path = '/auth/api-keys'
  const pathWithQuery = `${path}?metadata=true&includeRevoked=true`
  const response = await fetch(`${target.baseUrl}${pathWithQuery}`, {
    method: 'GET',
    headers: buildL2Headers(address, credential, path),
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error('Unable to list API keys.')
  }

  return normalizeApiKeyMetadata(payload)
}

async function resolveNextSdkApiKeyNonce(userId: string, address: string) {
  const targets = getSdkApiKeyTargets()
  if (!targets.length) {
    return '0'
  }

  const auth = await getUserTradingAuthSecrets(userId, { requireL2Context: false })
  if (!auth?.clob && !auth?.relayer) {
    return '0'
  }

  const targetsWithCredentials = targets.map((target) => {
    const credential = getTargetCredential(auth, target.service)
    return { target, credential }
  })

  const missingCredentialServices = targetsWithCredentials.flatMap(({ target, credential }) => (
    credential ? [] : [target.service]
  ))
  if (missingCredentialServices.length) {
    throw new Error(`Unable to list API key metadata for: ${missingCredentialServices.join(', ')}`)
  }

  const queryableTargets = targetsWithCredentials.filter((entry): entry is {
    target: SdkApiKeyTarget
    credential: SdkApiKeyCredential
  } => Boolean(entry.credential))

  const results = await Promise.allSettled(
    queryableTargets.map(({ target, credential }) => listApiKeyMetadata(target, address, credential)),
  )

  const failedServices = results.flatMap((result, index) => (
    result.status === 'rejected' ? [queryableTargets[index]?.target.service ?? 'clob'] : []
  ))
  if (failedServices.length) {
    throw new Error(`Unable to list API key metadata for: ${failedServices.join(', ')}`)
  }

  const keys = results.flatMap(result => result.status === 'fulfilled' ? result.value : [])
  return nextNonceFromMetadata(keys)
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

  const data: SdkApiKeyBundle = { nonce: parsed.data.nonce, address }
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

export async function getNextSdkApiKeyNonceAction(input: z.input<typeof SdkApiKeyNextNonceSchema>): Promise<SdkApiKeyNextNonceResult> {
  const parsed = SdkApiKeyNextNonceSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid wallet address.', nonce: null }
  }

  const user = await UserRepository.getCurrentUser({ disableCookieCache: true, minimal: true })
  if (!user) {
    return { error: 'Unauthenticated.', nonce: null }
  }

  const address = await resolveAuthorizedWalletAddress(user, parsed.data.address)
  if (!address) {
    return { error: 'Connect the wallet linked to this account before managing SDK keys.', nonce: null }
  }

  try {
    return {
      error: null,
      nonce: await resolveNextSdkApiKeyNonce(user.id, address),
    }
  }
  catch (error) {
    console.error('Failed to resolve next SDK API key nonce.', error)
    return { error: DEFAULT_ERROR_MESSAGE, nonce: null }
  }
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
      nonce: parsed.data.nonce,
      revoked,
    },
  }
}
