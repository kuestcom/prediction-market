import type { IdentityProviderAdapter } from './types'
import { Buffer } from 'node:buffer'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { isIP } from 'node:net'
import { z } from 'zod'
import { IDENTITY_GENERIC_WEBHOOK_ADAPTER, IDENTITY_SUBMISSION_STATUSES } from '@/lib/identity/constants'
import { readResponseBodyWithLimit } from '@/lib/read-response-body-with-limit'

const PROVIDER_DECISIONS = IDENTITY_SUBMISSION_STATUSES.filter(status => ![
  'not_required',
  'not_started',
  'draft',
].includes(status)) as [
  'pending' | 'under_review' | 'approved' | 'rejected' | 'needs_resubmission' | 'expired' | 'suspended',
  ...Array<'pending' | 'under_review' | 'approved' | 'rejected' | 'needs_resubmission' | 'expired' | 'suspended'>,
]

const GenericWebhookConfigSchema = z.object({
  verificationUrl: z.url(),
  statusUrl: z.url().optional(),
  deletionUrl: z.url().optional(),
  stateParameter: z.string().trim().regex(/^[a-z][\w-]{0,63}$/i).default('state'),
  referenceParameter: z.string().trim().regex(/^[a-z][\w-]{0,63}$/i).default('reference'),
  returnUrlParameter: z.string().trim().regex(/^[a-z][\w-]{0,63}$/i).default('return_url'),
  sessionTtlSeconds: z.number().int().min(60).max(24 * 60 * 60).default(15 * 60),
  statusMapping: z.record(z.string().trim().min(1).max(64), z.enum(PROVIDER_DECISIONS)),
  supportedCountries: z.array(z.string().regex(/^[A-Z]{2}$/)).max(250).optional(),
  processingRegion: z.string().trim().min(1).max(128).optional(),
  storageRegion: z.string().trim().min(1).max(128).optional(),
  retentionDays: z.number().int().min(1).max(3650).optional(),
  subprocessors: z.array(z.string().trim().min(1).max(255)).max(100).optional(),
  serviceLevel: z.string().trim().min(1).max(500).optional(),
  contractDocumentationUrl: z.url().optional(),
}).strict()

const GenericWebhookPayloadSchema = z.object({
  eventId: z.string().trim().min(1).max(128),
  reference: z.string().trim().min(1).max(256),
  type: z.string().trim().min(1).max(128),
  status: z.string().trim().min(1).max(64),
  reasonCode: z.string().trim().regex(/^[A-Z0-9_:-]{1,128}$/).nullable().optional(),
  occurredAt: z.iso.datetime({ offset: true }),
}).strict()

export type GenericWebhookConfig = z.infer<typeof GenericWebhookConfigSchema>

function isPrivateIpv4(hostname: string) {
  const parts = hostname.split('.').map(Number)
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false
  }
  return parts[0] === 10
    || parts[0] === 127
    || (parts[0] === 169 && parts[1] === 254)
    || (parts[0] === 172 && (parts[1] ?? 0) >= 16 && (parts[1] ?? 0) <= 31)
    || (parts[0] === 192 && parts[1] === 168)
    || parts[0] === 0
}

function assertSafeProviderUrl(rawUrl: string, environment: 'sandbox' | 'production') {
  const url = new URL(rawUrl)
  const hostname = url.hostname.toLowerCase()
  if (!['https:', ...(environment === 'sandbox' ? ['http:'] : [])].includes(url.protocol)) {
    throw new Error('IDENTITY_PROVIDER_URL_PROTOCOL_INVALID')
  }
  if (url.username || url.password || url.hash) {
    throw new Error('IDENTITY_PROVIDER_URL_INVALID')
  }
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || isPrivateIpv4(hostname)) {
    throw new Error('IDENTITY_PROVIDER_URL_PRIVATE')
  }
  const ipVersion = isIP(hostname)
  if (ipVersion === 6 && (hostname === '::1' || hostname.startsWith('fc') || hostname.startsWith('fd') || hostname.startsWith('fe80'))) {
    throw new Error('IDENTITY_PROVIDER_URL_PRIVATE')
  }
  return url
}

function signState(secret: string, payload: string) {
  return createHmac('sha256', secret).update(`identity-provider-state:v1:${payload}`).digest('base64url')
}

function verifyWebhookSignature(secret: string, timestamp: string, rawBody: string, signature: string) {
  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`, 'utf8')
    .digest('base64url')
  const providedBuffer = Buffer.from(signature.replace(/^v1=/, ''), 'utf8')
  const expectedBuffer = Buffer.from(expected, 'utf8')
  return providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer)
}

export const genericWebhookAdapter: IdentityProviderAdapter<GenericWebhookConfig> = {
  key: IDENTITY_GENERIC_WEBHOOK_ADAPTER,
  contractVersion: 1,
  capabilities: {
    hostedRedirect: true,
    embeddedSdk: false,
    documents: false,
    liveness: false,
    age: false,
    address: false,
    sanctionsPep: false,
    ongoingMonitoring: true,
    deletion: true,
    sandbox: true,
  },

  validateConfig(config, environment) {
    const parsed = GenericWebhookConfigSchema.parse(config)
    assertSafeProviderUrl(parsed.verificationUrl, environment)
    if (parsed.deletionUrl) {
      assertSafeProviderUrl(parsed.deletionUrl, environment)
    }
    if (parsed.statusUrl) {
      assertSafeProviderUrl(parsed.statusUrl, environment)
    }
    return parsed
  },

  async healthCheck(config) {
    try {
      const url = assertSafeProviderUrl(config.verificationUrl, 'production')
      const response = await fetch(url, {
        method: 'HEAD',
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
      })
      return { healthy: response.status < 500, detail: `Provider returned HTTP ${response.status}.` }
    }
    catch {
      return { healthy: false, detail: 'Provider endpoint could not be reached safely.' }
    }
  },

  async createSession(input) {
    const expiresAt = new Date(Date.now() + input.config.sessionTtlSeconds * 1000)
    const statePayload = Buffer.from(JSON.stringify({
      caseId: input.caseId,
      submissionId: input.submissionId,
      userId: input.userId,
      exp: Math.floor(expiresAt.getTime() / 1000),
    })).toString('base64url')
    const state = `${statePayload}.${signState(input.secret, statePayload)}`
    const url = assertSafeProviderUrl(input.config.verificationUrl, 'sandbox')
    url.searchParams.set(input.config.stateParameter, state)
    url.searchParams.set(input.config.referenceParameter, input.externalReference)
    url.searchParams.set(input.config.returnUrlParameter, input.returnUrl)
    return { externalReference: input.externalReference, sessionUrl: url.toString(), expiresAt }
  },

  parseWebhook(input) {
    const timestamp = input.headers.get('x-identity-timestamp')?.trim() ?? ''
    const signature = input.headers.get('x-identity-signature')?.trim() ?? ''
    if (!/^\d{10,13}$/.test(timestamp) || !signature) {
      throw new Error('IDENTITY_PROVIDER_SIGNATURE_MISSING')
    }
    const timestampNumber = Number(timestamp)
    const timestampMs = timestamp.length === 10 ? timestampNumber * 1000 : timestampNumber
    const now = input.now ?? new Date()
    if (!Number.isFinite(timestampMs) || Math.abs(now.getTime() - timestampMs) > 5 * 60 * 1000) {
      throw new Error('IDENTITY_PROVIDER_TIMESTAMP_INVALID')
    }
    if (!verifyWebhookSignature(input.secret, timestamp, input.rawBody, signature)) {
      throw new Error('IDENTITY_PROVIDER_SIGNATURE_INVALID')
    }
    const payload = GenericWebhookPayloadSchema.parse(JSON.parse(input.rawBody))
    const decision = input.config.statusMapping[payload.status]
    if (!decision) {
      throw new Error('IDENTITY_PROVIDER_STATUS_UNMAPPED')
    }
    return {
      eventId: payload.eventId,
      externalReference: payload.reference,
      eventType: payload.type,
      status: payload.status,
      decision,
      reasonCode: payload.reasonCode ?? null,
      occurredAt: new Date(payload.occurredAt),
    }
  },

  async getCase(input) {
    if (!input.config.statusUrl) {
      return { status: 'unsupported', decision: null }
    }
    const url = assertSafeProviderUrl(input.config.statusUrl, 'production')
    url.searchParams.set('reference', input.externalReference)
    const timestamp = String(Math.floor(Date.now() / 1000))
    const signature = createHmac('sha256', input.secret)
      .update(`${timestamp}.GET.${input.externalReference}`, 'utf8')
      .digest('base64url')
    const response = await fetch(url, {
      headers: {
        'x-identity-timestamp': timestamp,
        'x-identity-signature': `v1=${signature}`,
      },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
    })
    const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
    const responseBytes = contentType.includes('application/json') ? await readResponseBodyWithLimit(response, 64 * 1024) : null
    const payload = responseBytes
      ? JSON.parse(new TextDecoder().decode(responseBytes)) as { status?: unknown }
      : null
    if (!response.ok || typeof payload?.status !== 'string') {
      throw new Error('IDENTITY_PROVIDER_RECONCILIATION_FAILED')
    }
    return {
      status: payload.status,
      decision: input.config.statusMapping[payload.status] ?? null,
    }
  },

  async deleteCase(input) {
    if (!input.config.deletionUrl) {
      return { deleted: false, detail: 'Deletion endpoint is not configured.' }
    }
    const url = assertSafeProviderUrl(input.config.deletionUrl, 'production')
    url.searchParams.set('reference', input.externalReference)
    const timestamp = String(Math.floor(Date.now() / 1000))
    const signature = createHmac('sha256', input.secret)
      .update(`${timestamp}.DELETE.${input.externalReference}`, 'utf8')
      .digest('base64url')
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'x-identity-timestamp': timestamp,
        'x-identity-signature': `v1=${signature}`,
      },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
    })
    return {
      deleted: response.ok || response.status === 404 || response.status === 410,
      detail: response.ok ? 'Deleted.' : `Provider returned HTTP ${response.status}.`,
    }
  },
}
