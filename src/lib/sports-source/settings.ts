import { SettingsRepository } from '@/lib/db/queries/settings'
import { decryptSecret } from '@/lib/encryption'
import 'server-only'

type SettingsGroup = Record<string, { value: string, updated_at: string }>

interface SettingsMap {
  [group: string]: SettingsGroup | undefined
}

export interface SportsSourceProviderSettings {
  pandascoreToken?: string
  theSportsDbApiKey?: string
  configured: boolean
}

function decryptSetting(value: string | undefined) {
  if (!value) {
    return undefined
  }

  const decrypted = decryptSecret(value).trim()
  return decrypted || undefined
}

export function parseSportsSourceProviderSettings(allSettings?: SettingsMap): SportsSourceProviderSettings {
  const aiSettings = allSettings?.ai
  const pandascoreToken = decryptSetting(aiSettings?.sports_pandascore_token?.value)
  const theSportsDbApiKey = decryptSetting(aiSettings?.sports_thesportsdb_api_key?.value)

  return {
    pandascoreToken,
    theSportsDbApiKey,
    configured: Boolean(pandascoreToken || theSportsDbApiKey),
  }
}

export async function loadSportsSourceProviderSettings(): Promise<SportsSourceProviderSettings> {
  const { data } = await SettingsRepository.getSettings()
  return parseSportsSourceProviderSettings(data ?? undefined)
}
