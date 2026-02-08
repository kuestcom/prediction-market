import { createConfig } from '@lifi/sdk'
import { SettingsRepository } from '@/lib/db/queries/settings'
import { decryptSecret } from '@/lib/encryption'
import 'server-only'

const GENERAL_SETTINGS_GROUP = 'general'
const LIFI_INTEGRATOR_KEY = 'lifi_integrator'
const LIFI_API_KEY = 'lifi_api_key'
const DEFAULT_LIFI_INTEGRATOR = 'lifi-sdk'

let configuredSignature: string | null = null

function normalizeSettingValue(value: string | undefined) {
  const normalized = value?.trim()
  return normalized && normalized.length > 0 ? normalized : null
}

export async function ensureLiFiServerConfig() {
  const { data: allSettings, error } = await SettingsRepository.getSettings()
  if (error) {
    return
  }

  const generalSettings = allSettings?.[GENERAL_SETTINGS_GROUP]
  const integrator = normalizeSettingValue(generalSettings?.[LIFI_INTEGRATOR_KEY]?.value)
  const encryptedApiKey = generalSettings?.[LIFI_API_KEY]?.value
  const apiKey = normalizeSettingValue(decryptSecret(encryptedApiKey))

  if (!integrator) {
    if (configuredSignature !== null) {
      createConfig({ integrator: DEFAULT_LIFI_INTEGRATOR })
      configuredSignature = null
    }
    return
  }

  const nextSignature = `${integrator}::${apiKey ?? ''}`
  if (configuredSignature === nextSignature) {
    return
  }

  if (apiKey) {
    createConfig({
      integrator,
      apiKey,
    })
  }
  else {
    createConfig({ integrator })
  }

  configuredSignature = nextSignature
}
