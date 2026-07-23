import { Buffer } from 'node:buffer'
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const SUPPORT_ASSERTION_VERSION = 1
const SUPPORT_ASSERTION_TTL_MS = 2 * 60 * 1000
const WALLET_ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/
const USERNAME_PATTERN = /^(?![.-])[A-Z0-9.-]{3,42}(?<![.-])$/i

export interface KuestSupportContext {
  appVersion: string
  feeRecipientWallet: string | null
  isVercel: boolean
  siteName: string
  siteUrl: string
  visitorEoa: string
  visitorUsername: string | null
}

interface KuestSupportAssertionPayload {
  context: KuestSupportContext
  expiresAt: number
  issuedAt: number
  nonce: string
  version: typeof SUPPORT_ASSERTION_VERSION
}

function getAssertionSecret() {
  const secret = process.env.BETTER_AUTH_SECRET?.trim()
  if (!secret || secret.length < 32) {
    throw new Error('BETTER_AUTH_SECRET must be configured to use Kuest Support.')
  }

  return secret
}

function signEncodedPayload(encodedPayload: string) {
  return createHmac('sha256', getAssertionSecret())
    .update(encodedPayload)
    .digest('base64url')
}

export function normalizeKuestSupportContext(context: KuestSupportContext): KuestSupportContext {
  const siteUrl = new URL(context.siteUrl).origin
  const visitorUsername = context.visitorUsername === null || context.visitorUsername === undefined
    ? null
    : typeof context.visitorUsername === 'string'
      ? context.visitorUsername.trim()
      : null
  const supportedVisitorUsername = visitorUsername && USERNAME_PATTERN.test(visitorUsername)
    ? visitorUsername
    : null
  if (!WALLET_ADDRESS_PATTERN.test(context.visitorEoa)) {
    throw new TypeError('Kuest Support EOA is invalid.')
  }
  if (
    !context.siteName.trim()
    || !context.appVersion.trim()
    || (
      context.feeRecipientWallet !== null
      && !WALLET_ADDRESS_PATTERN.test(context.feeRecipientWallet)
    )
  ) {
    throw new TypeError('Kuest Support context is invalid.')
  }

  return {
    appVersion: context.appVersion.trim().slice(0, 120),
    feeRecipientWallet: context.feeRecipientWallet,
    isVercel: context.isVercel,
    siteName: context.siteName.trim().slice(0, 120),
    siteUrl,
    visitorEoa: context.visitorEoa.toLowerCase(),
    visitorUsername: supportedVisitorUsername,
  }
}

export function createKuestSupportAssertion(context: KuestSupportContext, now = Date.now()) {
  const payload: KuestSupportAssertionPayload = {
    context: normalizeKuestSupportContext(context),
    expiresAt: now + SUPPORT_ASSERTION_TTL_MS,
    issuedAt: now,
    nonce: randomBytes(18).toString('base64url'),
    version: SUPPORT_ASSERTION_VERSION,
  }
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')

  return `${encodedPayload}.${signEncodedPayload(encodedPayload)}`
}

export function verifyKuestSupportAssertion(assertion: string, now = Date.now()) {
  const [encodedPayload, providedSignature, extraPart] = assertion.split('.')
  if (!encodedPayload || !providedSignature || extraPart) {
    return null
  }

  const expectedSignature = signEncodedPayload(encodedPayload)
  const providedBytes = Buffer.from(providedSignature, 'utf8')
  const expectedBytes = Buffer.from(expectedSignature, 'utf8')
  if (
    providedBytes.length !== expectedBytes.length
    || !timingSafeEqual(providedBytes, expectedBytes)
  ) {
    return null
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8'),
    ) as Partial<KuestSupportAssertionPayload>

    if (
      parsed.version !== SUPPORT_ASSERTION_VERSION
      || !Number.isInteger(parsed.issuedAt)
      || !Number.isInteger(parsed.expiresAt)
      || parsed.issuedAt! > now + 10_000
      || parsed.expiresAt! <= now
      || parsed.expiresAt! - parsed.issuedAt! > SUPPORT_ASSERTION_TTL_MS
      || typeof parsed.nonce !== 'string'
      || parsed.nonce.length < 16
      || !parsed.context
    ) {
      return null
    }

    return normalizeKuestSupportContext(parsed.context)
  }
  catch {
    return null
  }
}
