import { MARKET_CONTEXT_PROMPT_DEFAULT } from '@/lib/ai/market-context-template'
import { SettingsRepository } from '@/lib/db/queries/settings'
import { decryptSecret } from '@/lib/encryption'

type SettingsGroup = Record<string, { value: string, updated_at: string }>

interface SettingsMap {
  [group: string]: SettingsGroup | undefined
}

export interface OpenRouterProviderSettings {
  model?: string
  apiKey?: string
  configured: boolean
  allSettings?: SettingsMap
  aiSettings?: SettingsGroup
}

export interface MarketContextSettings {
  prompt: string
  model?: string
  apiKey?: string
  enabled: boolean
}

export interface MarketContextSettingsResult extends MarketContextSettings {
  allSettings?: SettingsMap
  aiSettings?: SettingsGroup
}

function normalizeBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback
  }

  const normalized = value.trim().toLowerCase()
  if (['true', '1', 'yes', 'on', 'enabled'].includes(normalized)) {
    return true
  }
  if (['false', '0', 'no', 'off', 'disabled'].includes(normalized)) {
    return false
  }

  return fallback
}

function parseOpenRouterProviderSettingsFromMap(allSettings?: SettingsMap): OpenRouterProviderSettings {
  const aiSettings = allSettings?.ai
  const model = aiSettings?.openrouter_model?.value?.trim() || undefined
  const encryptedApiKey = aiSettings?.openrouter_api_key?.value
  const decryptedApiKey = encryptedApiKey ? decryptSecret(encryptedApiKey) : ''
  const apiKey = decryptedApiKey.trim() || undefined
  const configured = Boolean(apiKey)

  return {
    model,
    apiKey,
    configured,
    allSettings,
    aiSettings,
  }
}

function parseMarketContextSettingsFromMap(allSettings?: SettingsMap): MarketContextSettingsResult {
  const openRouter = parseOpenRouterProviderSettingsFromMap(allSettings)
  const aiSettings = openRouter.aiSettings

  const prompt = aiSettings?.market_context_prompt?.value?.trim() || MARKET_CONTEXT_PROMPT_DEFAULT

  const enabled = normalizeBoolean(
    aiSettings?.market_context_enabled?.value,
    true,
  )

  return {
    prompt,
    model: openRouter.model,
    apiKey: openRouter.apiKey,
    enabled,
    allSettings,
    aiSettings,
  }
}

export async function loadOpenRouterProviderSettings(): Promise<OpenRouterProviderSettings> {
  const { data } = await SettingsRepository.getSettings()
  return parseOpenRouterProviderSettingsFromMap(data ?? undefined)
}

export function parseOpenRouterProviderSettings(allSettings?: SettingsMap): OpenRouterProviderSettings {
  return parseOpenRouterProviderSettingsFromMap(allSettings)
}

export async function loadMarketContextSettings(): Promise<MarketContextSettingsResult> {
  const { data } = await SettingsRepository.getSettings()
  return parseMarketContextSettingsFromMap(data ?? undefined)
}

export function parseMarketContextSettings(allSettings?: SettingsMap): MarketContextSettingsResult {
  return parseMarketContextSettingsFromMap(allSettings)
}
