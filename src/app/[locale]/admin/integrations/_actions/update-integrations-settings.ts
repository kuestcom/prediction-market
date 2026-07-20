'use server'

import { revalidatePath, updateTag } from 'next/cache'
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
    const theSportsDbApiKey = getString(formData, 'sports_thesportsdb_api_key')
    const pandaScoreToken = getString(formData, 'sports_pandascore_token')
    const lifiIntegrator = getString(formData, 'lifi_integrator')
    const lifiApiKey = getString(formData, 'lifi_api_key')
    const customJavascriptCodesJson = getString(formData, 'custom_javascript_codes_json')

    if (openRouterApiKey.length > 256 || openRouterModel.length > 160) {
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
      { group: 'general', key: 'site_custom_javascript_codes', value: validatedThemeSettings.data.customJavascriptCodesValue },
      { group: 'general', key: 'lifi_integrator', value: validatedThemeSettings.data.lifiIntegratorValue },
      { group: 'general', key: 'lifi_api_key', value: encryptedLiFiApiKey },
      { group: 'ai', key: 'openrouter_model', value: openRouterModel },
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
      return { error: DEFAULT_ERROR_MESSAGE }
    }

    updateTag(cacheTags.settings)
    revalidatePath('/[locale]/admin/integrations', 'page')
    revalidatePath('/[locale]/admin', 'page')
    revalidatePath('/[locale]/event/[slug]', 'page')
    revalidatePath('/[locale]/sports/[sport]/[event]', 'page')
    return { error: null }
  }
  catch (error) {
    console.error('Failed to update integration settings', error)
    return { error: DEFAULT_ERROR_MESSAGE }
  }
}
