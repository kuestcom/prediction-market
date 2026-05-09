'use server'

import type { DepositWalletStatus } from '@/types'
import { eq } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { DEPOSIT_WALLET_FACTORY_ADDRESS } from '@/lib/contracts'
import { UserRepository } from '@/lib/db/queries/user'
import { users } from '@/lib/db/schema/auth/tables'
import { getDepositWalletAddress, isDepositWalletDeployed } from '@/lib/deposit-wallet'
import { captureDepositWalletError, captureDepositWalletEvent } from '@/lib/deposit-wallet-observability'
import { db } from '@/lib/drizzle'
import {
  L2_AUTH_CONTEXT_COOKIE_NAME,
  L2_AUTH_CONTEXT_COOKIE_NAME_SECURE,
  L2_AUTH_CONTEXT_TTL_SECONDS,
} from '@/lib/l2-auth-context'
import {
  markAutoRedeemApprovalCompleted,
  saveUserTradingAuthCredentials,
} from '@/lib/trading-auth/server'
import {
  DEFAULT_DEPOSIT_WALLET_CREATE_ERROR_MESSAGE,
  getTradingFlowErrorPreview,
  mapDepositWalletCreateError,
  mapTradingAuthError,
  readTradingFlowErrorResponse,
} from '@/lib/trading-flow-errors'

const USERNAME_MIN_LENGTH = 3
const USERNAME_MAX_LENGTH = 42
const WALLET_CREATE_POLL_ATTEMPTS = 45
const WALLET_CREATE_POLL_DELAY_MS = 2_000

const OnboardingUsernameSchema = z.object({
  username: z
    .string()
    .trim()
    .min(USERNAME_MIN_LENGTH, 'Username must be at least 3 character long')
    .max(USERNAME_MAX_LENGTH, 'Username must be at most 42 characters long')
    .regex(/^[A-Z0-9.-]+$/i, 'Only letters, numbers, dots and hyphens are allowed')
    .regex(/^(?![.-])/, 'Cannot start with a dot or hyphen')
    .regex(/(?<![.-])$/, 'Cannot end with a dot or hyphen'),
  termsAccepted: z.literal(true),
})

const OnboardingEmailSchema = z.object({
  email: z
    .string()
    .trim()
    .pipe(z.email({ pattern: z.regexes.html5Email, error: 'Invalid email address.' })),
})

const TradingAuthSignatureSchema = z.object({
  signature: z.string().min(1),
  timestamp: z.string().min(1),
  nonce: z.string().min(1),
})

interface DepositWalletActionUserData {
  deposit_wallet_address: string | null
  deposit_wallet_signature: string | null
  deposit_wallet_signed_at: string | null
  deposit_wallet_status: DepositWalletStatus | null
  deposit_wallet_tx_hash: string | null
  settings?: Record<string, any>
}

interface EnableDepositWalletTradingActionResult {
  error: string | null
  data: (DepositWalletActionUserData & {
    tradingAuth?: {
      relayer?: { enabled: boolean, updatedAt: string }
      clob?: { enabled: boolean, updatedAt: string }
    }
  }) | null
}

interface EnableTradingAuthActionResult {
  error: string | null
  data: {
    tradingAuth: {
      relayer: { enabled: boolean, updatedAt: string }
      clob: { enabled: boolean, updatedAt: string }
    }
  } | null
}

interface MarkAutoRedeemApprovalActionResult {
  error: string | null
  data: {
    autoRedeem: {
      enabled: boolean
      updatedAt: string
      version: string
    }
  } | null
}

interface UsernameAvailabilityResult {
  available: boolean | null
  code?: 'username_taken' | 'availability_unavailable'
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function resolveUsernameAvailability(payload: unknown): boolean | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const record = payload as Record<string, any>
  if (typeof record.available === 'boolean') {
    return record.available
  }
  if (typeof record.isAvailable === 'boolean') {
    return record.isAvailable
  }
  if (typeof record.data?.available === 'boolean') {
    return record.data.available
  }
  if (typeof record.data?.isAvailable === 'boolean') {
    return record.data.isAvailable
  }

  return null
}

async function fetchUsernameAvailability(username: string): Promise<UsernameAvailabilityResult> {
  const dataUrl = process.env.DATA_URL
  if (!dataUrl) {
    return { available: null, code: 'availability_unavailable' }
  }

  const url = new URL('/profile/username-availability', dataUrl)
  url.searchParams.set('username', username)

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8_000),
    })
    const payload = await response.json().catch(() => null)

    if (response.status === 409) {
      return { available: false, code: 'username_taken' }
    }

    if (!response.ok) {
      return { available: null, code: 'availability_unavailable' }
    }

    const available = resolveUsernameAvailability(payload)
    return available === null
      ? { available: null, code: 'availability_unavailable' }
      : { available }
  }
  catch (error) {
    console.error('Failed to check username availability', error)
    return { available: null, code: 'availability_unavailable' }
  }
}

async function updateOnboardingSettings(userId: string, patch: Record<string, unknown>) {
  const [row] = await db
    .select({ settings: users.settings })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  const settings = (row?.settings ?? {}) as Record<string, any>
  const onboarding = {
    ...(settings.onboarding ?? {}),
    ...patch,
  }

  await db
    .update(users)
    .set({
      settings: {
        ...settings,
        onboarding,
      },
    })
    .where(eq(users.id, userId))

  return {
    ...settings,
    onboarding,
  }
}

async function requestApiKey(baseUrl: string, headers: Record<string, string>) {
  const response = await fetch(`${baseUrl}/auth/api-key`, {
    method: 'POST',
    headers,
    body: '',
    signal: AbortSignal.timeout(10_000),
  })

  const { payload, rawError, contentType } = await readTradingFlowErrorResponse(response)
  if (!response.ok || !payload) {
    console.error('Trading auth API key request failed.', {
      baseUrl,
      status: response.status,
      contentType,
      rawError: getTradingFlowErrorPreview(rawError),
    })
    const message = mapTradingAuthError(rawError, {
      status: response.status,
      contentType,
      forceFallback: response.ok,
    })
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

async function persistL2AuthCookie(l2AuthContextId: string) {
  const cookieStore = await cookies()
  const isProduction = process.env.NODE_ENV === 'production'

  cookieStore.set({
    name: isProduction ? L2_AUTH_CONTEXT_COOKIE_NAME_SECURE : L2_AUTH_CONTEXT_COOKIE_NAME,
    value: l2AuthContextId,
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    path: '/',
    maxAge: L2_AUTH_CONTEXT_TTL_SECONDS,
  })
}

async function submitWalletCreate({
  userAddress,
  depositWallet,
}: {
  userAddress: string
  depositWallet: string
}) {
  const relayerUrl = process.env.RELAYER_URL
  if (!relayerUrl) {
    throw new Error(DEFAULT_DEPOSIT_WALLET_CREATE_ERROR_MESSAGE)
  }

  const path = '/submit/wallet'
  const body = JSON.stringify({
    type: 'WALLET-CREATE',
    from: userAddress,
    to: DEPOSIT_WALLET_FACTORY_ADDRESS,
    data: '0x',
    value: '0',
    signature: '',
    signatureParams: {},
    metadata: 'wallet_create',
  })
  const startedAt = Date.now()

  const response = await fetch(`${relayerUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body,
    signal: AbortSignal.timeout(15_000),
  })

  const { payload, rawError, contentType } = await readTradingFlowErrorResponse(response)
  if (!response.ok || !payload || typeof payload.transactionID !== 'string') {
    const durationMs = Date.now() - startedAt
    console.error('Deposit Wallet create submit failed.', {
      status: response.status,
      contentType,
      rawError: getTradingFlowErrorPreview(rawError),
      durationMs,
    })
    captureDepositWalletEvent('Deposit Wallet create submit failed', {
      operation: 'wallet_create_submit',
      userAddress,
      depositWallet,
      errorCode: rawError,
      durationMs,
      status: response.status,
    })
    throw new Error(mapDepositWalletCreateError(rawError, {
      status: response.status,
      contentType,
      forceFallback: response.ok,
    }))
  }

  return {
    transactionId: payload.transactionID as string,
    state: typeof payload.state === 'string' ? payload.state : null,
    txHash: typeof payload.transactionHash === 'string'
      ? payload.transactionHash
      : typeof payload.hash === 'string'
        ? payload.hash
        : null,
  }
}

async function fetchRelayerTransactionState(transactionId: string) {
  const relayerUrl = process.env.RELAYER_URL
  if (!relayerUrl) {
    return null
  }

  const query = `id=${encodeURIComponent(transactionId)}`
  const response = await fetch(`${relayerUrl}/transaction?${query}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(10_000),
  })

  const payload = await response.json().catch(() => null)
  const transaction = Array.isArray(payload) ? payload[0] : null
  if (!response.ok || !transaction) {
    return null
  }

  return {
    state: typeof transaction.state === 'string' ? transaction.state : null,
    txHash: typeof transaction.transactionHash === 'string'
      ? transaction.transactionHash
      : typeof transaction.hash === 'string'
        ? transaction.hash
        : null,
    failureReason: typeof transaction.failureReason === 'string'
      ? transaction.failureReason
      : null,
  }
}

async function pollWalletCreate(
  transactionId: string,
  context: { userAddress: string, depositWallet: string },
) {
  const startedAt = Date.now()
  for (let attempt = 0; attempt < WALLET_CREATE_POLL_ATTEMPTS; attempt += 1) {
    const transaction = await fetchRelayerTransactionState(transactionId)
    if (transaction?.state === 'STATE_MINED' || transaction?.state === 'STATE_CONFIRMED') {
      return transaction
    }
    if (transaction?.state === 'STATE_FAILED' || transaction?.state === 'STATE_INVALID') {
      captureDepositWalletEvent('Deposit Wallet create polling failed', {
        operation: 'wallet_create_poll',
        userAddress: context.userAddress,
        depositWallet: context.depositWallet,
        txHash: transaction.txHash,
        errorCode: transaction.failureReason ?? transaction.state,
        durationMs: Date.now() - startedAt,
      })
      throw new Error(transaction.failureReason ?? DEFAULT_ERROR_MESSAGE)
    }
    await sleep(WALLET_CREATE_POLL_DELAY_MS)
  }

  captureDepositWalletEvent('Deposit Wallet create polling timed out', {
    operation: 'wallet_create_poll',
    userAddress: context.userAddress,
    depositWallet: context.depositWallet,
    errorCode: 'polling_timeout',
    durationMs: Date.now() - startedAt,
  })
  return null
}

export async function updateOnboardingUsernameAction(input: {
  username: string
  termsAccepted: boolean
}) {
  const user = await UserRepository.getCurrentUser({ disableCookieCache: true, minimal: true })
  if (!user) {
    return { error: 'Unauthenticated.', data: null }
  }

  const parsed = OnboardingUsernameSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? DEFAULT_ERROR_MESSAGE, data: null }
  }

  try {
    const availability = await fetchUsernameAvailability(parsed.data.username)
    if (availability.available === false) {
      return { error: 'username_taken', code: 'username_taken', data: null }
    }

    const { error } = await UserRepository.updateUserProfileById(user.id, {
      username: parsed.data.username,
    })
    if (error) {
      return {
        error,
        code: error.toLowerCase().includes('username') ? 'username_taken' : undefined,
        data: null,
      }
    }
    const settings = await updateOnboardingSettings(user.id, {
      usernameCompletedAt: new Date().toISOString(),
      termsAcceptedAt: new Date().toISOString(),
    })

    return {
      error: null,
      data: {
        username: parsed.data.username,
        settings,
      },
    }
  }
  catch (error) {
    console.error('Failed to update onboarding username', error)
    return { error: DEFAULT_ERROR_MESSAGE, data: null }
  }
}

export async function checkUsernameAvailabilityAction(input: { username: string }) {
  const parsed = OnboardingUsernameSchema.pick({ username: true }).safeParse(input)
  if (!parsed.success) {
    return {
      available: false,
      code: 'invalid_username' as const,
      error: parsed.error.issues[0]?.message ?? DEFAULT_ERROR_MESSAGE,
    }
  }

  const result = await fetchUsernameAvailability(parsed.data.username)
  return {
    available: result.available,
    code: result.code,
    error: result.code === 'availability_unavailable' ? DEFAULT_ERROR_MESSAGE : null,
  }
}

export async function updateOnboardingEmailAction(input: {
  email?: string
  skip?: boolean
}) {
  const user = await UserRepository.getCurrentUser({ disableCookieCache: true, minimal: true })
  if (!user) {
    return { error: 'Unauthenticated.', data: null }
  }

  if (input.skip) {
    try {
      const settings = await updateOnboardingSettings(user.id, {
        emailSkippedAt: new Date().toISOString(),
      })
      return {
        error: null,
        data: {
          email: user.email,
          settings,
        },
      }
    }
    catch (error) {
      console.error('Failed to skip onboarding email', error)
      return { error: DEFAULT_ERROR_MESSAGE, data: null }
    }
  }

  const parsed = OnboardingEmailSchema.safeParse({ email: input.email ?? '' })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? DEFAULT_ERROR_MESSAGE, data: null }
  }

  try {
    const { error } = await UserRepository.updateUserProfileById(user.id, {
      email: parsed.data.email,
      username: user.username,
    })
    if (error) {
      return { error, data: null }
    }
    const settings = await updateOnboardingSettings(user.id, {
      emailCompletedAt: new Date().toISOString(),
    })

    return {
      error: null,
      data: {
        email: parsed.data.email,
        settings,
      },
    }
  }
  catch (error) {
    console.error('Failed to update onboarding email', error)
    return { error: DEFAULT_ERROR_MESSAGE, data: null }
  }
}

export async function createDepositWalletAction(): Promise<EnableDepositWalletTradingActionResult> {
  const user = await UserRepository.getCurrentUser({ disableCookieCache: true, minimal: true })
  if (!user) {
    return { error: 'Unauthenticated.', data: null }
  }

  if (!process.env.RELAYER_URL) {
    return { error: DEFAULT_DEPOSIT_WALLET_CREATE_ERROR_MESSAGE, data: null }
  }

  try {
    const depositWalletAddress = await getDepositWalletAddress(user.address as `0x${string}`)
    let status = user.deposit_wallet_status ?? 'not_started'
    let txHash: string | null = user.deposit_wallet_tx_hash ?? null

    const alreadyDeployed = await isDepositWalletDeployed(depositWalletAddress)
    if (alreadyDeployed) {
      status = 'deployed'
      txHash = null
    }
    else {
      const submitResult = await submitWalletCreate({
        userAddress: user.address,
        depositWallet: depositWalletAddress,
      })
      txHash = submitResult.txHash
      status = submitResult.state === 'STATE_CONFIRMED' || submitResult.state === 'STATE_MINED'
        ? 'deployed'
        : 'deploying'

      await db
        .update(users)
        .set({
          deposit_wallet_address: depositWalletAddress,
          deposit_wallet_signature: null,
          deposit_wallet_signed_at: null,
          deposit_wallet_status: status,
          deposit_wallet_tx_hash: txHash,
        })
        .where(eq(users.id, user.id))

      if (status !== 'deployed') {
        const mined = await pollWalletCreate(submitResult.transactionId, {
          userAddress: user.address,
          depositWallet: depositWalletAddress,
        })
        if (mined?.state === 'STATE_MINED' || mined?.state === 'STATE_CONFIRMED') {
          status = 'deployed'
          txHash = null
        }
      }
    }

    await db
      .update(users)
      .set({
        deposit_wallet_address: depositWalletAddress,
        deposit_wallet_signature: null,
        deposit_wallet_signed_at: null,
        deposit_wallet_status: status,
        deposit_wallet_tx_hash: status === 'deployed' ? null : txHash,
      })
      .where(eq(users.id, user.id))

    return {
      error: null,
      data: {
        deposit_wallet_address: depositWalletAddress,
        deposit_wallet_signature: null,
        deposit_wallet_signed_at: null,
        deposit_wallet_status: status,
        deposit_wallet_tx_hash: status === 'deployed' ? null : txHash,
      },
    }
  }
  catch (error) {
    console.error('Failed to create Deposit Wallet', error)
    captureDepositWalletError(error, {
      operation: 'wallet_create',
      userAddress: user.address,
      depositWallet: user.deposit_wallet_address,
    })
    const message = error instanceof Error ? error.message : DEFAULT_ERROR_MESSAGE
    return { error: message, data: null }
  }
}

export async function enableTradingAuthAction(
  input: z.input<typeof TradingAuthSignatureSchema>,
): Promise<EnableTradingAuthActionResult> {
  const user = await UserRepository.getCurrentUser({ disableCookieCache: true })
  if (!user) {
    return { error: 'Unauthenticated.', data: null }
  }

  const parsed = TradingAuthSignatureSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid signature.', data: null }
  }

  if (user.deposit_wallet_status !== 'deployed') {
    return { error: 'Create your Deposit Wallet before enabling trading.', data: null }
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

    const l2AuthContextId = await saveUserTradingAuthCredentials(user.id, {
      relayer: relayerCreds,
      clob: clobCreds,
    })
    if (!l2AuthContextId) {
      return { error: DEFAULT_ERROR_MESSAGE, data: null }
    }
    await persistL2AuthCookie(l2AuthContextId)

    const updatedAt = new Date().toISOString()
    return {
      error: null,
      data: {
        tradingAuth: {
          relayer: { enabled: true, updatedAt },
          clob: { enabled: true, updatedAt },
        },
      },
    }
  }
  catch (error) {
    console.error('Failed to enable trading auth', error)
    captureDepositWalletError(error, {
      operation: 'enable_trading_auth',
      userAddress: user.address,
      depositWallet: user.deposit_wallet_address,
    })
    const message = error instanceof Error ? error.message : DEFAULT_ERROR_MESSAGE
    return { error: message, data: null }
  }
}

export async function markAutoRedeemApprovalCompletedAction(): Promise<MarkAutoRedeemApprovalActionResult> {
  const user = await UserRepository.getCurrentUser({ disableCookieCache: true, minimal: true })
  if (!user) {
    return { error: 'Unauthenticated.', data: null }
  }

  try {
    const autoRedeem = await markAutoRedeemApprovalCompleted(user.id)
    return {
      error: null,
      data: { autoRedeem },
    }
  }
  catch (error) {
    console.error('Failed to mark auto redeem approval', error)
    return {
      error: DEFAULT_ERROR_MESSAGE,
      data: null,
    }
  }
}
