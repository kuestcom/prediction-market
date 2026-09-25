'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { headers } from 'next/headers'
import { randomBytes } from 'node:crypto'

import {
  getKuestSupportSettings,
  KUEST_SUPPORT_ENABLED_KEY,
  KUEST_SUPPORT_POSITION_KEY,
  KUEST_SUPPORT_SETTINGS_GROUP,
  parseKuestSupportPosition,
} from '@/lib/admin-support-settings'
import {
  ARBITRAGE_ENABLED_SETTINGS_KEY,
  ARBITRAGE_MULTI_WALLET_ENABLED_SETTINGS_KEY,
  ARBITRAGE_SETTINGS_GROUP,
} from '@/lib/arbitrage-settings'
import { cacheTags } from '@/lib/cache-tags'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { SettingsRepository } from '@/lib/db/queries/settings'
import { UserRepository } from '@/lib/db/queries/user'
import { decryptSecret, encryptSecret } from '@/lib/encryption'
import {
  getPaymentsCanonicalDomain,
  getPaymentsOperatorChallengeSettingKey,
  PAYMENTS_ENABLED_KEY as PAYMENTS_ENABLED_SETTING_KEY,
  PAYMENTS_OPERATOR_DOMAIN_KEY,
  PAYMENTS_OPERATOR_CHALLENGE_KEY,
  PAYMENTS_OPERATOR_LEGACY_CHALLENGE_KEY,
  PAYMENTS_OPERATOR_KEY as PAYMENTS_OPERATOR_SETTING_KEY,
  PAYMENTS_SETTINGS_GROUP,
} from '@/lib/payments/operator-key'
import {
  PaymentsOperatorProvisioningError,
  requestPaymentsOperatorChallenge,
  verifyPaymentsOperatorDomain,
} from '@/lib/payments/worker'
import {
  SUMSUB_APP_TOKEN_KEY,
  SUMSUB_ENABLED_KEY,
  SUMSUB_ENFORCEMENT_KEY,
  SUMSUB_LEVEL_NAME_KEY,
  SUMSUB_SECRET_KEY,
  SUMSUB_SETTINGS_GROUP,
  SUMSUB_WEBHOOK_SECRET_KEY,
  validateSumsubInput,
} from '@/lib/sumsub/settings'
import { getThemeSiteSettingsFormState, validateThemeSiteSettingsInput } from '@/lib/theme-settings'

export interface IntegrationsSettingsActionState {
  error: string | null
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function getCanonicalPaymentsDomain(requestHeaders: Pick<Headers, 'get'>) {
  const domain = getPaymentsCanonicalDomain(requestHeaders)
  if (!domain) {
    throw new PaymentsOperatorProvisioningError('payments_site_url_invalid')
  }
  return domain
}

async function savePaymentsDomainChallenge(
  domain: string,
  challengeId: string,
  challenge: string,
  registrationToken: string,
  expiresAt: number,
  currentSettings: Record<string, Record<string, { value: string } | undefined> | undefined> | null | undefined,
) {
  let encryptedChallenge: string
  try {
    encryptedChallenge = encryptSecret(JSON.stringify({ domain, challengeId, challenge, registrationToken, expiresAt }))
  } catch {
    throw new PaymentsOperatorProvisioningError('payments_operator_storage_failed')
  }

  const updates = [
    {
      group: PAYMENTS_SETTINGS_GROUP,
      key: getPaymentsOperatorChallengeSettingKey(challengeId),
      value: encryptedChallenge,
    },
  ]
  const savedChallenges = currentSettings?.[PAYMENTS_SETTINGS_GROUP] ?? {}
  for (const [key, setting] of Object.entries(savedChallenges)) {
    if (!key.startsWith(PAYMENTS_OPERATOR_CHALLENGE_KEY) || !setting?.value) {
      continue
    }
    try {
      const previous = decryptSecret(setting.value)
      const parsed: unknown = JSON.parse(previous)
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        !('expiresAt' in parsed) ||
        typeof parsed.expiresAt !== 'number' ||
        parsed.expiresAt <= Date.now()
      ) {
        updates.push({ group: PAYMENTS_SETTINGS_GROUP, key, value: '' })
      }
    } catch {
      updates.push({ group: PAYMENTS_SETTINGS_GROUP, key, value: '' })
    }
  }

  const { error } = await SettingsRepository.updateSettings(updates)
  if (error) {
    throw new PaymentsOperatorProvisioningError('payments_operator_storage_failed')
  }
}

async function clearPaymentsDomainChallenge(challengeId: string) {
  await SettingsRepository.updateSettings([
    {
      group: PAYMENTS_SETTINGS_GROUP,
      key: getPaymentsOperatorChallengeSettingKey(challengeId),
      value: '',
    },
  ])
}

export async function updateIntegrationsSettingsAction(
  _previousState: IntegrationsSettingsActionState,
  formData: FormData,
): Promise<IntegrationsSettingsActionState> {
  try {
    const user = await UserRepository.getCurrentUser({ minimal: true })
    if (!user || !user.is_admin) {
      return { error: 'Unauthenticated.' }
    }

    const googleAnalyticsId = getString(formData, 'google_analytics_id')
    const openRouterApiKey = getString(formData, 'openrouter_api_key')
    const openRouterModel = getString(formData, 'openrouter_model')
    const openRouterTranslationModel = getString(formData, 'openrouter_translation_model')
    const openRouterDecisionModel = getString(formData, 'openrouter_decision_model')
    const theSportsDbApiKey = getString(formData, 'sports_thesportsdb_api_key')
    const pandaScoreToken = getString(formData, 'sports_pandascore_token')
    const lifiIntegrator = getString(formData, 'lifi_integrator')
    const lifiApiKey = getString(formData, 'lifi_api_key')
    const reissuePaymentsOperatorKey = formData.get('payments_reissue_operator_key') === 'true'
    const customJavascriptCodesJson = getString(formData, 'custom_javascript_codes_json')
    const kuestSupportPositionRaw = getString(formData, 'kuest_support_position')

    if (
      openRouterApiKey.length > 256 ||
      openRouterModel.length > 160 ||
      openRouterTranslationModel.length > 160 ||
      openRouterDecisionModel.length > 160
    ) {
      return { error: 'OpenRouter settings are too long.' }
    }
    if (theSportsDbApiKey.length > 512) {
      return { error: 'TheSportsDB API key is too long.' }
    }
    if (pandaScoreToken.length > 512) {
      return { error: 'PandaScore token is too long.' }
    }
    if (lifiIntegrator.length > 120 || lifiApiKey.length > 256) {
      return { error: 'LI.FI settings are too long.' }
    }
    if (
      formData.has('kuest_support_position') &&
      kuestSupportPositionRaw !== 'left' &&
      kuestSupportPositionRaw !== 'right'
    ) {
      return { error: 'Kuest Support position is invalid.' }
    }

    const { data: allSettings, error: settingsError } = await SettingsRepository.getSettings()
    if (settingsError) {
      return { error: DEFAULT_ERROR_MESSAGE }
    }

    const currentThemeSettings = getThemeSiteSettingsFormState(allSettings ?? undefined)
    const validatedThemeSettings = validateThemeSiteSettingsInput({
      siteName: currentThemeSettings.siteName,
      siteDescription: currentThemeSettings.siteDescription,
      logoMode: currentThemeSettings.logoMode,
      logoSvg: currentThemeSettings.logoSvg,
      logoImagePath: currentThemeSettings.logoImagePath,
      pwaIcon192Path: currentThemeSettings.pwaIcon192Path,
      pwaIcon512Path: currentThemeSettings.pwaIcon512Path,
      googleAnalyticsId,
      discordLink: currentThemeSettings.discordLink,
      twitterLink: currentThemeSettings.twitterLink,
      facebookLink: currentThemeSettings.facebookLink,
      instagramLink: currentThemeSettings.instagramLink,
      tiktokLink: currentThemeSettings.tiktokLink,
      linkedinLink: currentThemeSettings.linkedinLink,
      youtubeLink: currentThemeSettings.youtubeLink,
      supportUrl: currentThemeSettings.supportUrl,
      customJavascriptCodesJson,
      feeRecipientWallet: currentThemeSettings.feeRecipientWallet,
      lifiIntegrator,
      lifiApiKey,
    })
    if (!validatedThemeSettings.data) {
      return { error: validatedThemeSettings.error ?? 'Invalid integration settings.' }
    }

    const existingOpenRouterApiKey = allSettings?.ai?.openrouter_api_key?.value ?? ''
    const existingTheSportsDbApiKey = allSettings?.ai?.sports_thesportsdb_api_key?.value ?? ''
    const existingPandaScoreToken = allSettings?.ai?.sports_pandascore_token?.value ?? ''
    const existingLiFiApiKey = allSettings?.general?.lifi_api_key?.value ?? ''
    const existingPaymentsOperatorKey =
      allSettings?.[PAYMENTS_SETTINGS_GROUP]?.[PAYMENTS_OPERATOR_SETTING_KEY]?.value ?? ''
    const existingPaymentsOperatorDomain =
      allSettings?.[PAYMENTS_SETTINGS_GROUP]?.[PAYMENTS_OPERATOR_DOMAIN_KEY]?.value?.trim().toLowerCase() ?? ''
    const existingPaymentsEnabled =
      allSettings?.[PAYMENTS_SETTINGS_GROUP]?.[PAYMENTS_ENABLED_SETTING_KEY]?.value === 'true'
    const paymentsEnabled = formData.has('payments_enabled')
      ? formData.get('payments_enabled') === 'true'
      : existingPaymentsEnabled
    const existingPaymentsKey = decryptSecret(existingPaymentsOperatorKey)
    const hasExistingPaymentsKey = /^[A-Za-z0-9_-]{40,64}$/u.test(existingPaymentsKey)
    const currentKuestSupportSettings = getKuestSupportSettings(allSettings)
    const sumsubGroup = allSettings?.[SUMSUB_SETTINGS_GROUP]
    const existingSumsubAppToken = sumsubGroup?.[SUMSUB_APP_TOKEN_KEY]?.value ?? ''
    const existingSumsubSecretKey = sumsubGroup?.[SUMSUB_SECRET_KEY]?.value ?? ''
    const existingSumsubWebhookSecret = sumsubGroup?.[SUMSUB_WEBHOOK_SECRET_KEY]?.value ?? ''

    const validatedSumsub = validateSumsubInput({
      enabled: formData.get('sumsub_enabled'),
      enforcement: formData.get('sumsub_enforcement'),
      levelName: formData.get('sumsub_level_name'),
      appToken: formData.get('sumsub_app_token'),
      secretKey: formData.get('sumsub_secret_key'),
      webhookSecret: formData.get('sumsub_webhook_secret'),
      hasStoredAppToken: Boolean(decryptSecret(existingSumsubAppToken)),
      hasStoredSecretKey: Boolean(decryptSecret(existingSumsubSecretKey)),
      hasStoredWebhookSecret: Boolean(decryptSecret(existingSumsubWebhookSecret)),
    })
    if (!validatedSumsub.data) {
      return { error: validatedSumsub.error }
    }

    const encryptedOpenRouterApiKey = openRouterApiKey ? encryptSecret(openRouterApiKey) : existingOpenRouterApiKey
    const encryptedTheSportsDbApiKey = theSportsDbApiKey ? encryptSecret(theSportsDbApiKey) : existingTheSportsDbApiKey
    const encryptedPandaScoreToken = pandaScoreToken ? encryptSecret(pandaScoreToken) : existingPandaScoreToken
    const encryptedLiFiApiKey = lifiApiKey ? encryptSecret(lifiApiKey) : existingLiFiApiKey
    let encryptedPaymentsOperatorKey = hasExistingPaymentsKey
      ? existingPaymentsOperatorKey.startsWith('enc.v1.')
        ? existingPaymentsOperatorKey
        : encryptSecret(existingPaymentsKey)
      : ''
    let provisionedPaymentsOperatorKey: string | null = null
    let paymentsOperatorDomain = existingPaymentsOperatorDomain
    let challengeSettingKey: string | null = null
    const canonicalPaymentsDomain =
      paymentsEnabled || reissuePaymentsOperatorKey ? getCanonicalPaymentsDomain(await headers()) : null
    const paymentsDomainChanged = Boolean(
      canonicalPaymentsDomain && canonicalPaymentsDomain !== existingPaymentsOperatorDomain,
    )

    if (
      (reissuePaymentsOperatorKey || paymentsEnabled) &&
      paymentsDomainChanged &&
      existingPaymentsOperatorDomain &&
      !hasExistingPaymentsKey
    ) {
      throw new PaymentsOperatorProvisioningError('payments_operator_domain_change_key_missing')
    }

    if (reissuePaymentsOperatorKey || (paymentsEnabled && (!hasExistingPaymentsKey || paymentsDomainChanged))) {
      const domain = canonicalPaymentsDomain!
      const registrationToken = randomBytes(32).toString('base64url')
      const domainChallenge = await requestPaymentsOperatorChallenge(domain, registrationToken)
      challengeSettingKey = getPaymentsOperatorChallengeSettingKey(domainChallenge.challengeId)
      await savePaymentsDomainChallenge(
        domain,
        domainChallenge.challengeId,
        domainChallenge.challenge,
        registrationToken,
        domainChallenge.expiresAt,
        allSettings,
      )

      try {
        provisionedPaymentsOperatorKey = await verifyPaymentsOperatorDomain(
          domain,
          domainChallenge.challengeId,
          domainChallenge.challenge,
          registrationToken,
          hasExistingPaymentsKey ? existingPaymentsKey : undefined,
        )
      } catch (error) {
        await clearPaymentsDomainChallenge(domainChallenge.challengeId)
        throw error
      }

      try {
        encryptedPaymentsOperatorKey = encryptSecret(provisionedPaymentsOperatorKey)
        paymentsOperatorDomain = domain
      } catch {
        await clearPaymentsDomainChallenge(domainChallenge.challengeId)
        throw new PaymentsOperatorProvisioningError('payments_operator_storage_failed')
      }
    }
    const encryptedSumsubAppToken = validatedSumsub.data.appToken
      ? encryptSecret(validatedSumsub.data.appToken)
      : existingSumsubAppToken
    const encryptedSumsubSecretKey = validatedSumsub.data.secretKey
      ? encryptSecret(validatedSumsub.data.secretKey)
      : existingSumsubSecretKey
    const encryptedSumsubWebhookSecret = validatedSumsub.data.webhookSecret
      ? encryptSecret(validatedSumsub.data.webhookSecret)
      : existingSumsubWebhookSecret

    const { error } = await SettingsRepository.updateSettings([
      { group: 'general', key: 'site_google_analytics', value: validatedThemeSettings.data.googleAnalyticsIdValue },
      {
        group: 'general',
        key: 'site_custom_javascript_codes',
        value: validatedThemeSettings.data.customJavascriptCodesValue,
      },
      { group: 'general', key: 'lifi_integrator', value: validatedThemeSettings.data.lifiIntegratorValue },
      { group: 'general', key: 'lifi_api_key', value: encryptedLiFiApiKey },
      {
        group: PAYMENTS_SETTINGS_GROUP,
        key: PAYMENTS_OPERATOR_SETTING_KEY,
        value: encryptedPaymentsOperatorKey,
      },
      { group: PAYMENTS_SETTINGS_GROUP, key: PAYMENTS_OPERATOR_DOMAIN_KEY, value: paymentsOperatorDomain },
      ...(challengeSettingKey ? [{ group: PAYMENTS_SETTINGS_GROUP, key: challengeSettingKey, value: '' }] : []),
      { group: PAYMENTS_SETTINGS_GROUP, key: PAYMENTS_OPERATOR_LEGACY_CHALLENGE_KEY, value: '' },
      {
        group: PAYMENTS_SETTINGS_GROUP,
        key: PAYMENTS_ENABLED_SETTING_KEY,
        value: paymentsEnabled ? 'true' : 'false',
      },
      { group: 'ai', key: 'openrouter_model', value: openRouterModel },
      { group: 'ai', key: 'openrouter_translation_model', value: openRouterTranslationModel },
      ...(formData.has('openrouter_decision_model')
        ? [{ group: 'ai' as const, key: 'openrouter_decision_model', value: openRouterDecisionModel }]
        : []),
      { group: 'ai', key: 'openrouter_api_key', value: encryptedOpenRouterApiKey },
      { group: 'ai', key: 'sports_thesportsdb_api_key', value: encryptedTheSportsDbApiKey },
      { group: 'ai', key: 'sports_pandascore_token', value: encryptedPandaScoreToken },
      {
        group: ARBITRAGE_SETTINGS_GROUP,
        key: ARBITRAGE_ENABLED_SETTINGS_KEY,
        value: formData.get('arbitrage_enabled') === 'true' ? 'true' : 'false',
      },
      {
        group: ARBITRAGE_SETTINGS_GROUP,
        key: ARBITRAGE_MULTI_WALLET_ENABLED_SETTINGS_KEY,
        value: formData.get('arbitrage_multi_wallet_enabled') === 'true' ? 'true' : 'false',
      },
      {
        group: KUEST_SUPPORT_SETTINGS_GROUP,
        key: KUEST_SUPPORT_ENABLED_KEY,
        value: formData.has('kuest_support_enabled')
          ? formData.get('kuest_support_enabled') === 'true'
            ? 'true'
            : 'false'
          : currentKuestSupportSettings.enabled
            ? 'true'
            : 'false',
      },
      {
        group: KUEST_SUPPORT_SETTINGS_GROUP,
        key: KUEST_SUPPORT_POSITION_KEY,
        value: formData.has('kuest_support_position')
          ? parseKuestSupportPosition(kuestSupportPositionRaw)
          : currentKuestSupportSettings.position,
      },
      {
        group: SUMSUB_SETTINGS_GROUP,
        key: SUMSUB_ENABLED_KEY,
        value: validatedSumsub.data.enabled ? 'true' : 'false',
      },
      { group: SUMSUB_SETTINGS_GROUP, key: SUMSUB_APP_TOKEN_KEY, value: encryptedSumsubAppToken },
      { group: SUMSUB_SETTINGS_GROUP, key: SUMSUB_SECRET_KEY, value: encryptedSumsubSecretKey },
      { group: SUMSUB_SETTINGS_GROUP, key: SUMSUB_WEBHOOK_SECRET_KEY, value: encryptedSumsubWebhookSecret },
      { group: SUMSUB_SETTINGS_GROUP, key: SUMSUB_LEVEL_NAME_KEY, value: validatedSumsub.data.levelName },
      { group: SUMSUB_SETTINGS_GROUP, key: SUMSUB_ENFORCEMENT_KEY, value: validatedSumsub.data.enforcement },
    ])
    if (error) {
      if (provisionedPaymentsOperatorKey) {
        const fallback = await SettingsRepository.updateSettings([
          {
            group: PAYMENTS_SETTINGS_GROUP,
            key: PAYMENTS_OPERATOR_SETTING_KEY,
            value: encryptedPaymentsOperatorKey,
          },
          { group: PAYMENTS_SETTINGS_GROUP, key: PAYMENTS_OPERATOR_DOMAIN_KEY, value: paymentsOperatorDomain },
          { group: PAYMENTS_SETTINGS_GROUP, key: PAYMENTS_ENABLED_SETTING_KEY, value: 'false' },
          ...(challengeSettingKey ? [{ group: PAYMENTS_SETTINGS_GROUP, key: challengeSettingKey, value: '' }] : []),
          { group: PAYMENTS_SETTINGS_GROUP, key: PAYMENTS_OPERATOR_LEGACY_CHALLENGE_KEY, value: '' },
        ])
        if (fallback.error) {
          return { error: 'payments_operator_storage_failed' }
        }
        return { error: 'payments_operator_saved_disabled' }
      }
      return { error: DEFAULT_ERROR_MESSAGE }
    }

    updateTag(cacheTags.settings)
    revalidatePath('/[locale]/admin/integrations', 'page')
    revalidatePath('/[locale]/admin', 'page')
    revalidatePath('/[locale]/event/[slug]', 'page')
    revalidatePath('/[locale]/sports/[sport]/[event]', 'page')
    return { error: null }
  } catch (error) {
    if (error instanceof PaymentsOperatorProvisioningError) {
      return { error: error.code }
    }
    console.error('Failed to update integration settings', error)
    return { error: DEFAULT_ERROR_MESSAGE }
  }
}
