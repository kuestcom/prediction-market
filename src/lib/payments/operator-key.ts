import 'server-only'
import { SettingsRepository } from '@/lib/db/queries/settings'
import { decryptSecret } from '@/lib/encryption'

export const PAYMENTS_SETTINGS_GROUP = 'payments'
export const PAYMENTS_OPERATOR_KEY = 'operator_key'
export const PAYMENTS_OPERATOR_DOMAIN_KEY = 'operator_domain'
export const PAYMENTS_OPERATOR_CHALLENGE_KEY = 'operator_domain_challenge:'
export const PAYMENTS_OPERATOR_LEGACY_CHALLENGE_KEY = 'operator_domain_challenge'
export const PAYMENTS_ENABLED_KEY = 'on_off_ramp_enabled'

export function getPaymentsCanonicalDomain(): string | null {
  const siteUrl = process.env.SITE_URL?.trim()
  if (!siteUrl) {
    return null
  }

  try {
    const url = new URL(siteUrl)
    if (
      url.protocol !== 'https:' ||
      !url.hostname ||
      url.username ||
      url.password ||
      url.port ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    ) {
      return null
    }
    return url.hostname.toLowerCase()
  } catch {
    return null
  }
}

export function getPaymentsOperatorChallengeSettingKey(challengeId: string) {
  if (!/^[A-Za-z0-9_-]{22}$/u.test(challengeId)) {
    throw new Error('invalid_payments_operator_challenge_id')
  }
  return `${PAYMENTS_OPERATOR_CHALLENGE_KEY}${challengeId}`
}

type SettingsMap = Record<string, Record<string, { value: string } | undefined> | undefined>

export function getPaymentsIntegrationFormState(settings: SettingsMap | null | undefined) {
  const group = settings?.[PAYMENTS_SETTINGS_GROUP]
  const encryptedKey = group?.[PAYMENTS_OPERATOR_KEY]?.value ?? ''
  const operatorKey = decryptSecret(encryptedKey)
  const configured = /^[A-Za-z0-9_-]{40,64}$/u.test(operatorKey)
  const enabledValue = group?.[PAYMENTS_ENABLED_KEY]?.value
  const storedDomain = group?.[PAYMENTS_OPERATOR_DOMAIN_KEY]?.value?.trim().toLowerCase() ?? ''
  const canonicalDomain = getPaymentsCanonicalDomain()
  const operatorDomainChanged =
    (Boolean(storedDomain) && (!canonicalDomain || storedDomain !== canonicalDomain)) ||
    (configured && (!canonicalDomain || !storedDomain))

  return {
    enabled: configured && enabledValue === 'true' && !operatorDomainChanged,
    operatorKeyConfigured: configured,
    operatorDomainChanged,
  }
}

async function getStoredPaymentsOperatorKey(requireEnabled: boolean): Promise<string | null> {
  const { data, error } = await SettingsRepository.getSettings()
  if (error) {
    return null
  }

  const group = data?.[PAYMENTS_SETTINGS_GROUP]
  if (requireEnabled && group?.[PAYMENTS_ENABLED_KEY]?.value !== 'true') {
    return null
  }

  const storedDomain = group?.[PAYMENTS_OPERATOR_DOMAIN_KEY]?.value?.trim().toLowerCase() ?? ''
  const canonicalDomain = getPaymentsCanonicalDomain()
  if (!canonicalDomain || storedDomain !== canonicalDomain) {
    return null
  }

  const storedKey = decryptSecret(group?.[PAYMENTS_OPERATOR_KEY]?.value ?? '')
  return /^[A-Za-z0-9_-]{40,64}$/u.test(storedKey) ? storedKey : null
}

export function getPaymentsOperatorKey(): Promise<string | null> {
  return getStoredPaymentsOperatorKey(true)
}

// Existing checkouts remain queryable after an administrator disables new payments.
export function getPaymentsOperatorKeyForCheckoutStatus(): Promise<string | null> {
  return getStoredPaymentsOperatorKey(false)
}
