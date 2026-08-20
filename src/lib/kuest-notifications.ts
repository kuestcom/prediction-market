import type { WalletClient } from 'viem'

import { keccak256, toHex } from 'viem'

interface NotificationApiErrorBody {
  error?: string
}

export class NotificationApiError extends Error {
  constructor(
    readonly code: string,
    message = code,
  ) {
    super(message)
  }
}

async function notificationJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  const body = (await response.json().catch(() => null)) as (T & NotificationApiErrorBody) | null
  if (!response.ok || !body) {
    throw new NotificationApiError(body?.error ?? 'notifications_unavailable')
  }
  return body
}

function baseUrl(value: string) {
  return value.replace(/\/+$/, '')
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(',')}]`
  }
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

function payloadHash(payload: unknown): `0x${string}` {
  return keccak256(toHex(stableJson(payload)))
}

async function signWalletAction(input: {
  notificationsUrl: string
  chainId: number
  wallet: `0x${string}`
  walletClient: WalletClient
  action: 'read_contact_status' | 'update_preferences'
  payload: unknown
}) {
  const challenge = await notificationJson<{
    nonce: string
    expiresAt: number
  }>(`${baseUrl(input.notificationsUrl)}/v1/me/action-challenge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallet: input.wallet, action: input.action }),
  })
  const signature = await input.walletClient.signTypedData({
    account: input.wallet,
    domain: { name: 'Kuest Notifications', version: '1', chainId: input.chainId },
    types: {
      WalletAction: [
        { name: 'wallet', type: 'address' },
        { name: 'action', type: 'string' },
        { name: 'payloadHash', type: 'bytes32' },
        { name: 'nonce', type: 'string' },
        { name: 'expiresAt', type: 'uint64' },
      ],
    },
    primaryType: 'WalletAction',
    message: {
      wallet: input.wallet,
      action: input.action,
      payloadHash: payloadHash(input.payload),
      nonce: challenge.nonce,
      expiresAt: BigInt(challenge.expiresAt),
    },
  })
  return { ...challenge, signature }
}

export async function linkSponsorEmail(input: {
  notificationsUrl: string
  wallet: `0x${string}`
  walletClient: WalletClient
  email: string
  locale: string
  siteDomain: string
}) {
  const url = baseUrl(input.notificationsUrl)
  const email = input.email.trim().toLowerCase()
  const challenge = await notificationJson<{
    alreadyVerified: boolean
    nonce?: string
    expiresAt?: number
    typedData?: {
      domain: { name: string; version: string; chainId: number }
      types: {
        LinkEmail: readonly { name: string; type: string }[]
      }
      primaryType: 'LinkEmail'
    }
  }>(`${url}/v1/me/email/challenge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      wallet: input.wallet,
      email,
      role: 'sponsor',
      siteDomain: input.siteDomain,
      locale: input.locale.toLowerCase().startsWith('pt') ? 'pt' : 'en',
    }),
  })
  if (challenge.alreadyVerified) {
    return { alreadyVerified: true as const }
  }
  if (!challenge.nonce || !challenge.expiresAt || !challenge.typedData) {
    throw new NotificationApiError('invalid_challenge')
  }
  const signature = await input.walletClient.signTypedData({
    account: input.wallet,
    domain: challenge.typedData.domain,
    types: challenge.typedData.types,
    primaryType: challenge.typedData.primaryType,
    message: {
      wallet: input.wallet,
      email,
      role: 'sponsor',
      siteDomain: input.siteDomain,
      nonce: challenge.nonce,
      expiresAt: BigInt(challenge.expiresAt),
    },
  })
  return notificationJson<{ alreadyVerified: boolean; verificationPending?: boolean; maskedEmail?: string }>(
    `${url}/v1/me/email/link`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wallet: input.wallet,
        email,
        role: 'sponsor',
        siteDomain: input.siteDomain,
        locale: input.locale.toLowerCase().startsWith('pt') ? 'pt' : 'en',
        nonce: challenge.nonce,
        expiresAt: challenge.expiresAt,
        signature,
      }),
    },
  )
}

export interface NotificationPreference {
  channel: 'email' | 'telegram'
  topic: 'campaign_status' | 'new_opportunities'
  enabled: boolean
}

export async function readNotificationSettings(input: {
  notificationsUrl: string
  chainId: number
  wallet: `0x${string}`
  walletClient: WalletClient
}) {
  const signed = await signWalletAction({ ...input, action: 'read_contact_status', payload: {} })
  const params = new URLSearchParams({
    wallet: input.wallet,
    nonce: signed.nonce,
    expiresAt: String(signed.expiresAt),
    signature: signed.signature,
  })
  return notificationJson<{
    emailVerified: boolean
    maskedEmail?: string | null
    sourceDomain?: string | null
    preferences?: NotificationPreference[]
  }>(`${baseUrl(input.notificationsUrl)}/v1/me/contact-status?${params}`)
}

export async function updateNotificationSettings(input: {
  notificationsUrl: string
  chainId: number
  wallet: `0x${string}`
  walletClient: WalletClient
  preferences: NotificationPreference[]
}) {
  const payload = { preferences: input.preferences }
  const signed = await signWalletAction({ ...input, action: 'update_preferences', payload })
  return notificationJson<{ updated: boolean }>(`${baseUrl(input.notificationsUrl)}/v1/me/preferences`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      wallet: input.wallet,
      preferences: input.preferences,
      nonce: signed.nonce,
      expiresAt: signed.expiresAt,
      signature: signed.signature,
    }),
  })
}
