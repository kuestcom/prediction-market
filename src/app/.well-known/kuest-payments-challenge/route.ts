import { SettingsRepository } from '../../../lib/db/queries/settings'
import { decryptSecret } from '../../../lib/encryption'
import { getPaymentsOperatorChallengeSettingKey, PAYMENTS_SETTINGS_GROUP } from '../../../lib/payments/operator-key'

function notFound() {
  return new Response(null, {
    status: 404,
    headers: {
      'Cache-Control': 'no-store, no-cache, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const challengeIds = url.searchParams.getAll('id')
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      url.hash ||
      challengeIds.length !== 1 ||
      [...url.searchParams.keys()].length !== 1
    ) {
      return notFound()
    }

    const challengeId = challengeIds[0]
    if (typeof challengeId !== 'string' || !/^[A-Za-z0-9_-]{22}$/u.test(challengeId)) {
      return notFound()
    }
    const challengeSettingKey = getPaymentsOperatorChallengeSettingKey(challengeId)

    const { data, error } = await SettingsRepository.getSettings()
    if (error) {
      return notFound()
    }

    const encryptedChallenge = data?.[PAYMENTS_SETTINGS_GROUP]?.[challengeSettingKey]?.value ?? ''
    const challengePayload = decryptSecret(encryptedChallenge)
    if (!challengePayload || challengePayload.length > 1_024) {
      return notFound()
    }

    const value: unknown = JSON.parse(challengePayload)
    if (
      typeof value !== 'object' ||
      value === null ||
      !('domain' in value) ||
      typeof value.domain !== 'string' ||
      value.domain !== url.hostname.toLowerCase() ||
      !('challengeId' in value) ||
      value.challengeId !== challengeId ||
      !('challenge' in value) ||
      typeof value.challenge !== 'string' ||
      !/^[A-Za-z0-9_-]{43}$/u.test(value.challenge) ||
      !('registrationToken' in value) ||
      typeof value.registrationToken !== 'string' ||
      !/^[A-Za-z0-9_-]{43}$/u.test(value.registrationToken) ||
      !('expiresAt' in value) ||
      typeof value.expiresAt !== 'number' ||
      value.expiresAt <= Date.now()
    ) {
      return notFound()
    }

    return new Response(value.challenge, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, max-age=0',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
      },
    })
  } catch {
    return notFound()
  }
}
