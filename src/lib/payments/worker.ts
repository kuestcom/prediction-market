import 'server-only'
import { getPaymentsOperatorKey, getPaymentsOperatorKeyForCheckoutStatus } from '@/lib/payments/operator-key'

export const PAYMENTS_WORKER_ORIGIN = 'https://payments.kuest.com'

export class PaymentsWorkerRequestError extends Error {
  constructor(readonly code: 'not_configured' | 'unavailable') {
    super(code)
  }
}

export class PaymentsOperatorProvisioningError extends Error {
  constructor(readonly code: string) {
    super(code)
  }
}

const PROVISIONING_ERROR_CODES: Record<string, string> = {
  domain_banned: 'payments_domain_banned',
  registration_rate_limited: 'payments_registration_rate_limited',
  invalid_domain: 'payments_site_url_invalid',
  domain_verification_failed: 'payments_domain_verification_failed',
  domain_challenge_expired_or_used: 'payments_domain_verification_failed',
  invalid_domain_challenge: 'payments_domain_verification_failed',
  operator_registration_failed: 'payments_operator_registration_failed',
  operator_domain_already_registered: 'payments_operator_domain_conflict',
  operator_migration_conflict: 'payments_operator_migration_conflict',
  operator_migration_key_revoked: 'payments_operator_migration_key_revoked',
}

async function readWorkerJson(response: Response): Promise<unknown> {
  const contentLength = Number(response.headers.get('content-length') ?? 0)
  if (Number.isFinite(contentLength) && contentLength > 4_096) {
    await response.body?.cancel()
    throw new PaymentsOperatorProvisioningError('payments_worker_unavailable')
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new PaymentsOperatorProvisioningError('payments_worker_unavailable')
  }
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    total += value.byteLength
    if (total > 4_096) {
      await reader.cancel()
      throw new PaymentsOperatorProvisioningError('payments_worker_unavailable')
    }
    chunks.push(value)
  }

  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown
  } catch {
    throw new PaymentsOperatorProvisioningError('payments_worker_unavailable')
  }
}

async function requestPublicPaymentsWorker(
  path: string,
  payload: Record<string, unknown>,
  operatorKey?: string,
): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(`${PAYMENTS_WORKER_ORIGIN}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(operatorKey ? { Authorization: `Bearer ${operatorKey}` } : {}),
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    throw new PaymentsOperatorProvisioningError('payments_worker_unavailable')
  }

  const result = await readWorkerJson(response)
  if (!response.ok) {
    const errorCode =
      typeof result === 'object' && result !== null && 'error' in result && typeof result.error === 'string'
        ? PROVISIONING_ERROR_CODES[result.error]
        : undefined
    throw new PaymentsOperatorProvisioningError(errorCode ?? 'payments_operator_registration_failed')
  }
  return result
}

export async function requestPaymentsOperatorChallenge(domain: string, registrationToken: string) {
  const challengeResult = await requestPublicPaymentsWorker('/v1/operators/challenges', { domain, registrationToken })
  if (
    typeof challengeResult !== 'object' ||
    challengeResult === null ||
    !('challengeId' in challengeResult) ||
    typeof challengeResult.challengeId !== 'string' ||
    !/^[A-Za-z0-9_-]{22}$/u.test(challengeResult.challengeId) ||
    !('challenge' in challengeResult) ||
    typeof challengeResult.challenge !== 'string' ||
    !/^[A-Za-z0-9_-]{43}$/u.test(challengeResult.challenge) ||
    !('expiresAt' in challengeResult) ||
    typeof challengeResult.expiresAt !== 'number' ||
    challengeResult.expiresAt <= Date.now() ||
    challengeResult.expiresAt > Date.now() + 6 * 60 * 1000
  ) {
    throw new PaymentsOperatorProvisioningError('payments_worker_unavailable')
  }
  return {
    challengeId: challengeResult.challengeId,
    challenge: challengeResult.challenge,
    expiresAt: challengeResult.expiresAt,
  }
}

export async function verifyPaymentsOperatorDomain(
  domain: string,
  challengeId: string,
  challenge: string,
  registrationToken: string,
  currentOperatorKey?: string,
) {
  const verificationResult = await requestPublicPaymentsWorker(
    '/v1/operators/verify',
    {
      domain,
      challengeId,
      challenge,
      registrationToken,
    },
    currentOperatorKey,
  )
  if (
    typeof verificationResult !== 'object' ||
    verificationResult === null ||
    !('domain' in verificationResult) ||
    verificationResult.domain !== domain ||
    !('operatorId' in verificationResult) ||
    typeof verificationResult.operatorId !== 'string' ||
    verificationResult.operatorId.length > 253 ||
    !('apiKey' in verificationResult) ||
    typeof verificationResult.apiKey !== 'string' ||
    !/^[A-Za-z0-9_-]{40,64}$/u.test(verificationResult.apiKey)
  ) {
    throw new PaymentsOperatorProvisioningError('payments_operator_registration_failed')
  }
  return verificationResult.apiKey
}

async function requestPaymentsWorkerWithKey(path: string, init: RequestInit, operatorKey: string): Promise<Response> {
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${operatorKey}`)

  try {
    return await fetch(`${PAYMENTS_WORKER_ORIGIN}${path}`, {
      ...init,
      headers,
      redirect: 'error',
      signal: init.signal ?? AbortSignal.timeout(15_000),
      cache: 'no-store',
    })
  } catch {
    throw new PaymentsWorkerRequestError('unavailable')
  }
}

export async function requestPaymentsWorker(path: string, init: RequestInit = {}): Promise<Response> {
  const operatorKey = await getPaymentsOperatorKey()
  if (!operatorKey) {
    throw new PaymentsWorkerRequestError('not_configured')
  }

  return requestPaymentsWorkerWithKey(path, init, operatorKey)
}

export async function requestPaymentsCheckoutStatus(checkoutId: string, externalCustomerId: string): Promise<Response> {
  if (!/^[0-9a-f-]{36}$/iu.test(checkoutId) || !externalCustomerId || /[\r\n]/u.test(externalCustomerId)) {
    throw new PaymentsWorkerRequestError('unavailable')
  }

  const operatorKey = await getPaymentsOperatorKeyForCheckoutStatus()
  if (!operatorKey) {
    throw new PaymentsWorkerRequestError('not_configured')
  }

  return requestPaymentsWorkerWithKey(
    `/v1/checkouts/${checkoutId}/status`,
    {
      method: 'GET',
      headers: { 'X-External-Customer-ID': externalCustomerId },
      signal: AbortSignal.timeout(10_000),
    },
    operatorKey,
  )
}
