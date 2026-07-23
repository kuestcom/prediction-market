import type {
  ExtendedChain,
  LiFiStep,
  QuoteRequestFromAmount,
  QuoteRequestToAmount,
  RequestOptions,
  TokensExtendedResponse,
} from '@lifi/sdk'
import { actions, createClient } from '@lifi/sdk'
import { SettingsRepository } from '@/lib/db/queries/settings'
import { decryptSecret } from '@/lib/encryption'
import 'server-only'

const GENERAL_SETTINGS_GROUP = 'general'
const LIFI_INTEGRATOR_KEY = 'lifi_integrator'
const LIFI_API_KEY = 'lifi_api_key'
const DEFAULT_LIFI_INTEGRATOR = 'kuest-prediction-market'
const LIFI_CATALOG_CACHE_TTL_MS = 5 * 60_000

type LiFiServerActions = Omit<ReturnType<typeof actions>, 'getQuote'> & {
  getQuote:
    & ((params: QuoteRequestFromAmount, options?: RequestOptions) => Promise<LiFiStep>)
    & ((params: QuoteRequestToAmount, options?: RequestOptions) => Promise<LiFiStep>)
}

let configuredSignature: string | null = null
let configuredActions: LiFiServerActions | null = null
let allTokensCache: { expiresAt: number, promise: Promise<TokensExtendedResponse> } | null = null
let chainsCache: { expiresAt: number, promise: Promise<ExtendedChain[]> } | null = null

function normalizeSettingValue(value: string | undefined) {
  const normalized = value?.trim()
  return normalized && normalized.length > 0 ? normalized : null
}

function createLiFiServerActions(integrator: string, apiKey: string | null) {
  const client = createClient(
    apiKey
      ? { integrator, apiKey }
      : { integrator },
  )

  return actions(client) as LiFiServerActions
}

export async function getLiFiServerActions() {
  const { data: allSettings, error } = await SettingsRepository.getSettings()
  if (error) {
    if (configuredActions) {
      return configuredActions
    }

    configuredActions = createLiFiServerActions(DEFAULT_LIFI_INTEGRATOR, null)
    configuredSignature = `${DEFAULT_LIFI_INTEGRATOR}::`
    return configuredActions
  }

  const generalSettings = allSettings?.[GENERAL_SETTINGS_GROUP]
  const integrator = normalizeSettingValue(generalSettings?.[LIFI_INTEGRATOR_KEY]?.value)
    ?? DEFAULT_LIFI_INTEGRATOR
  const encryptedApiKey = generalSettings?.[LIFI_API_KEY]?.value
  const apiKey = normalizeSettingValue(decryptSecret(encryptedApiKey))

  const nextSignature = `${integrator}::${apiKey ?? ''}`
  if (configuredActions && configuredSignature === nextSignature) {
    return configuredActions
  }

  configuredActions = createLiFiServerActions(integrator, apiKey)
  configuredSignature = nextSignature
  return configuredActions
}

export async function getLiFiTokens(chains?: number[]) {
  if (chains?.length) {
    const lifi = await getLiFiServerActions()
    return lifi.getTokens({ extended: true, chains })
  }

  if (allTokensCache && allTokensCache.expiresAt > Date.now()) {
    return allTokensCache.promise
  }

  const promise = getLiFiServerActions()
    .then(lifi => lifi.getTokens({ extended: true }))
  allTokensCache = {
    expiresAt: Date.now() + LIFI_CATALOG_CACHE_TTL_MS,
    promise,
  }

  try {
    return await promise
  }
  catch (error) {
    if (allTokensCache?.promise === promise) {
      allTokensCache = null
    }
    throw error
  }
}

export async function getLiFiChains() {
  if (chainsCache && chainsCache.expiresAt > Date.now()) {
    return chainsCache.promise
  }

  const promise = getLiFiServerActions()
    .then(lifi => lifi.getChains())
  chainsCache = {
    expiresAt: Date.now() + LIFI_CATALOG_CACHE_TTL_MS,
    promise,
  }

  try {
    return await promise
  }
  catch (error) {
    if (chainsCache?.promise === promise) {
      chainsCache = null
    }
    throw error
  }
}
