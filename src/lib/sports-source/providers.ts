export const SPORTS_SOURCE_PROVIDERS = ['thesportsdb', 'pandascore'] as const
export const DEFAULT_SPORTS_SOURCE_PROVIDER_ORDER = ['thesportsdb', 'pandascore'] as const

export type SportsSourceProvider = typeof SPORTS_SOURCE_PROVIDERS[number]

export interface SportsSourceProviderAvailability {
  pandascoreToken?: string | null
  theSportsDbApiKey?: string | null
}

const SPORTS_SOURCE_PROVIDER_SET = new Set<string>(SPORTS_SOURCE_PROVIDERS)

function readSportsSourceProviderTokens(provider?: string | null) {
  return provider
    ?.trim()
    .toLowerCase()
    .split(/[,\s]+/)
    .map(value => value.trim())
    .filter(Boolean)
    ?? []
}

export function normalizeSportsSourceProviderTokens(provider?: string | null): SportsSourceProvider[] {
  const providers = readSportsSourceProviderTokens(provider)
    .filter((value): value is SportsSourceProvider => SPORTS_SOURCE_PROVIDER_SET.has(value))

  return Array.from(new Set(providers))
}

function normalizeSportsSourceProviderParam(provider?: string | null) {
  const providers = normalizeSportsSourceProviderTokens(provider)
  return providers.length > 0 ? providers.join(',') : null
}

export function normalizeSingleSportsSourceProvider(provider?: string | null) {
  return normalizeSportsSourceProviderTokens(provider)[0] ?? null
}

export function formatSportsSourceProviderLabel(provider: string) {
  switch (provider) {
    case 'pandascore':
      return 'PandaScore'
    case 'thesportsdb':
      return 'TheSportsDB'
    default:
      return provider
  }
}

export function getConfiguredSportsSourceProviders(settings?: SportsSourceProviderAvailability | null): SportsSourceProvider[] {
  if (!settings) {
    return []
  }

  return SPORTS_SOURCE_PROVIDERS.filter((provider) => {
    switch (provider) {
      case 'thesportsdb':
        return Boolean(settings.theSportsDbApiKey?.trim())
      case 'pandascore':
        return Boolean(settings.pandascoreToken?.trim())
    }

    return false
  })
}

export function filterSportsSourceProvidersByCategory(input: {
  providers: readonly SportsSourceProvider[]
  category?: string | null
  tags?: string[] | null
}) {
  const normalizedTags = new Set((input.tags ?? []).map(tag => tag.trim().toLowerCase()).filter(Boolean))
  const category = input.category?.trim().toLowerCase()

  if (category === 'esports' || normalizedTags.has('esports')) {
    return input.providers.filter(provider => provider === 'pandascore')
  }

  if (category === 'sports' || normalizedTags.has('sports')) {
    return input.providers.filter(provider => provider === 'thesportsdb')
  }

  return [...input.providers]
}

export function resolveSportsSourceProviderParam(input: {
  provider?: string | null
  category?: string | null
  tags?: string[] | null
}) {
  const hasExplicitProvider = Boolean(input.provider?.trim())
  const providerTokens = readSportsSourceProviderTokens(input.provider)
  const unsupportedProviders = providerTokens.filter(token => !SPORTS_SOURCE_PROVIDER_SET.has(token))
  if (unsupportedProviders.length > 0) {
    return {
      provider: null,
      error: `Unsupported sports source provider. Use one of: ${SPORTS_SOURCE_PROVIDERS.join(', ')}.`,
    }
  }

  const explicitProvider = normalizeSportsSourceProviderParam(input.provider)
  if (explicitProvider) {
    return { provider: explicitProvider, error: null as string | null }
  }
  if (hasExplicitProvider) {
    return {
      provider: null,
      error: `Unsupported sports source provider. Use one of: ${SPORTS_SOURCE_PROVIDERS.join(', ')}.`,
    }
  }

  const normalizedTags = new Set((input.tags ?? []).map(tag => tag.trim().toLowerCase()).filter(Boolean))
  const category = input.category?.trim().toLowerCase()
  if (category === 'esports' || normalizedTags.has('esports')) {
    return { provider: 'pandascore', error: null }
  }
  if (category === 'sports' || normalizedTags.has('sports')) {
    return { provider: 'thesportsdb', error: null }
  }

  return { provider: null, error: null }
}
