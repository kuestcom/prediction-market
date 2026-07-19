import type { PublicSumsubSettings, SumsubEnforcement } from './types'

import { SettingsRepository } from '@/lib/db/queries/settings'
import { decryptSecret } from '@/lib/encryption'
import { SUMSUB_ENFORCEMENTS } from './types'
import 'server-only'

export const SUMSUB_SETTINGS_GROUP = 'integrations'
export const SUMSUB_ENABLED_KEY = 'sumsub_enabled'
export const SUMSUB_APP_TOKEN_KEY = 'sumsub_app_token'
export const SUMSUB_SECRET_KEY = 'sumsub_secret_key'
export const SUMSUB_WEBHOOK_SECRET_KEY = 'sumsub_webhook_secret'
export const SUMSUB_LEVEL_NAME_KEY = 'sumsub_level_name'
export const SUMSUB_ENFORCEMENT_KEY = 'sumsub_enforcement'

export const SUMSUB_LIMITS = {
  appToken: 512,
  secretKey: 512,
  webhookSecret: 512,
  levelName: 128,
} as const

type SettingsMap = Record<string, Record<string, { value: string }>>

export interface SumsubSettings extends PublicSumsubSettings {
  appToken: string
  secretKey: string
  webhookSecret: string
}

function parseEnforcement(value?: string): SumsubEnforcement {
  return SUMSUB_ENFORCEMENTS.includes(value as SumsubEnforcement)
    ? value as SumsubEnforcement
    : 'disabled'
}

export function parseSumsubSettings(settings?: SettingsMap): SumsubSettings {
  const group = settings?.[SUMSUB_SETTINGS_GROUP]
  const appToken = decryptSecret(group?.[SUMSUB_APP_TOKEN_KEY]?.value).trim()
  const secretKey = decryptSecret(group?.[SUMSUB_SECRET_KEY]?.value).trim()
  const webhookSecret = decryptSecret(group?.[SUMSUB_WEBHOOK_SECRET_KEY]?.value).trim()
  const levelName = (group?.[SUMSUB_LEVEL_NAME_KEY]?.value ?? '').trim()
  const enabled = group?.[SUMSUB_ENABLED_KEY]?.value === 'true'
  const enforcement = parseEnforcement(group?.[SUMSUB_ENFORCEMENT_KEY]?.value)
  const configured = Boolean(appToken && secretKey && webhookSecret && levelName)

  return {
    enabled,
    configured,
    effective: enabled && configured && enforcement !== 'disabled',
    enforcement,
    levelName,
    appToken,
    secretKey,
    webhookSecret,
  }
}

export function sanitizeSumsubSettings(settings: SumsubSettings): PublicSumsubSettings {
  return {
    enabled: settings.enabled,
    configured: settings.configured,
    effective: settings.effective,
    enforcement: settings.enforcement,
    levelName: settings.levelName,
  }
}

export async function getSumsubSettings() {
  const { data, error } = await SettingsRepository.getSettings()
  if (error) {
    throw new Error('Unable to load Sumsub settings.')
  }
  return parseSumsubSettings(data ?? undefined)
}

export function validateSumsubInput(input: {
  enabled: unknown
  enforcement: unknown
  levelName: unknown
  appToken: unknown
  secretKey: unknown
  webhookSecret: unknown
  hasStoredAppToken?: boolean
  hasStoredSecretKey?: boolean
  hasStoredWebhookSecret?: boolean
}) {
  const enabled = input.enabled === true || input.enabled === 'true'
  const enforcement = parseEnforcement(typeof input.enforcement === 'string' ? input.enforcement : undefined)
  if (input.enforcement !== enforcement) {
    return { data: null, error: 'Invalid Sumsub enforcement mode.' }
  }

  const appToken = typeof input.appToken === 'string' ? input.appToken.trim() : ''
  const secretKey = typeof input.secretKey === 'string' ? input.secretKey.trim() : ''
  const webhookSecret = typeof input.webhookSecret === 'string' ? input.webhookSecret.trim() : ''
  const levelName = typeof input.levelName === 'string' ? input.levelName.trim() : ''

  if (appToken.length > SUMSUB_LIMITS.appToken
    || secretKey.length > SUMSUB_LIMITS.secretKey
    || webhookSecret.length > SUMSUB_LIMITS.webhookSecret
    || levelName.length > SUMSUB_LIMITS.levelName) {
    return { data: null, error: 'One or more Sumsub fields are too long.' }
  }

  const configured = Boolean(
    (appToken || input.hasStoredAppToken)
    && (secretKey || input.hasStoredSecretKey)
    && (webhookSecret || input.hasStoredWebhookSecret)
    && levelName,
  )
  if (enabled && enforcement !== 'disabled' && !configured) {
    return { data: null, error: 'Complete all Sumsub credentials before enabling this enforcement mode.' }
  }

  return { data: { enabled, enforcement, appToken, secretKey, webhookSecret, levelName }, error: null }
}
