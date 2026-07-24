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
const LIFI_TOKEN_CACHE_MAX_ENTRIES = 32

type LiFiServerActions = Omit<ReturnType<typeof actions>, 'getQuote'> & {
  getQuote:
    & ((params: QuoteRequestFromAmount, options?: RequestOptions) => Promise<LiFiStep>)
    & ((params: QuoteRequestToAmount, options?: RequestOptions) => Promise<LiFiStep>)
}

let configuredSignature: string | null = null
let configuredActions: LiFiServerActions | null = null
const tokensCache = new Map<string, {
  actions: LiFiServerActions
  expiresAt: number
  promise: Promise<TokensExtendedResponse>
}>()
let chainsCache: {
  actions: LiFiServerActions
  expiresAt: number
  promise: Promise<ExtendedChain[]>
} | null = null

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

function clearCatalogCaches() {
  tokensCache.clear()
  chainsCache = null
}

function normalizeChainIds(chains?: number[]) {
  return chains?.length
    ? [...new Set(chains)].sort((a, b) => a - b)
    : []
}

function cacheTokens(
  cacheKey: string,
  lifi: LiFiServerActions,
  promise: Promise<TokensExtendedResponse>,
) {
  tokensCache.set(cacheKey, {
    actions: lifi,
    expiresAt: Date.now() + LIFI_CATALOG_CACHE_TTL_MS,
    promise,
  })

  while (tokensCache.size > LIFI_TOKEN_CACHE_MAX_ENTRIES) {
    const oldestKey = tokensCache.keys().next().value
    if (oldestKey === undefined) {
      break
    }
    tokensCache.delete(oldestKey)
  }
}

export async function getLiFiServerActions() {
  const { data: allSettings, error } = await SettingsRepository.getSettings()
  if (error) {
    if (configuredActions) {
      return configuredActions
    }

    configuredActions = createLiFiServerActions(DEFAULT_LIFI_INTEGRATOR, null)
    configuredSignature = `${DEFAULT_LIFI_INTEGRATOR}::`
    clearCatalogCaches()
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
  clearCatalogCaches()
  return configuredActions
}

export async function getLiFiTokens(chains?: number[]) {
  const lifi = await getLiFiServerActions()
  const normalizedChains = normalizeChainIds(chains)
  const cacheKey = normalizedChains.join(',')
  const cached = tokensCache.get(cacheKey)

  if (cached && cached.actions === lifi && cached.expiresAt > Date.now()) {
    return cached.promise
  }

  const promise = lifi.getTokens({
    extended: true,
    ...(normalizedChains.length ? { chains: normalizedChains } : {}),
  })
  cacheTokens(cacheKey, lifi, promise)

  try {
    return await promise
  }
  catch (error) {
    if (tokensCache.get(cacheKey)?.promise === promise) {
      tokensCache.delete(cacheKey)
    }
    throw error
  }
}

export async function getLiFiChains() {
  const lifi = await getLiFiServerActions()

  if (
    chainsCache
    && chainsCache.actions === lifi
    && chainsCache.expiresAt > Date.now()
  ) {
    return chainsCache.promise
  }

  const promise = lifi.getChains()
  chainsCache = {
    actions: lifi,
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
