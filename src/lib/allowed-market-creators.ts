export const PUBLIC_ALLOWED_MARKET_CREATORS_PATH = '/api/allowed-market-creators'
export const DEMO_ALLOWED_MARKET_CREATOR_DISPLAY_NAME = 'demo.kuest.com'
export const DEMO_ALLOWED_MARKET_CREATOR_URL = 'https://demo.kuest.com'

export type AllowedMarketCreatorSourceType = 'site' | 'wallet'

export interface AllowedMarketCreatorItem {
  walletAddress: string
  displayName: string
  sourceUrl: string | null
  sourceType: AllowedMarketCreatorSourceType
}

export interface AdminAllowedMarketCreatorsResponse {
  items: AllowedMarketCreatorItem[]
  wallets: string[]
  allowed: boolean
}

export interface PublicAllowedMarketCreatorsResponse {
  wallets: string[]
}

function withDefaultProtocol(value: string) {
  if (/^[a-z][a-z\d+\-.]*:\/\//i.test(value)) {
    return value
  }

  return `https://${value}`
}

export function normalizeAllowedMarketCreatorSiteInput(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return { error: 'Site URL is required.' } as const
  }

  try {
    const parsed = new URL(withDefaultProtocol(trimmed))
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { error: 'Site URL must use http or https.' } as const
    }

    const displayName = parsed.host.trim().toLowerCase()
    if (!displayName) {
      return { error: 'Site URL is invalid.' } as const
    }

    const origin = parsed.origin

    return {
      origin,
      displayName,
      endpointUrl: `${origin}${PUBLIC_ALLOWED_MARKET_CREATORS_PATH}`,
    } as const
  }
  catch {
    return { error: 'Site URL is invalid.' } as const
  }
}

export function isAllowedMarketCreatorItem(payload: unknown): payload is AllowedMarketCreatorItem {
  if (!payload || typeof payload !== 'object') {
    return false
  }

  const candidate = payload as Partial<AllowedMarketCreatorItem>
  return typeof candidate.walletAddress === 'string'
    && typeof candidate.displayName === 'string'
    && (typeof candidate.sourceUrl === 'string' || candidate.sourceUrl === null)
    && (candidate.sourceType === 'site' || candidate.sourceType === 'wallet')
}

export function isAdminAllowedMarketCreatorsResponse(payload: unknown): payload is AdminAllowedMarketCreatorsResponse {
  if (!payload || typeof payload !== 'object') {
    return false
  }

  const candidate = payload as Partial<AdminAllowedMarketCreatorsResponse>
  return Array.isArray(candidate.items)
    && candidate.items.every(item => isAllowedMarketCreatorItem(item))
    && Array.isArray(candidate.wallets)
    && candidate.wallets.every(wallet => typeof wallet === 'string')
    && typeof candidate.allowed === 'boolean'
}

export function isPublicAllowedMarketCreatorsResponse(payload: unknown): payload is PublicAllowedMarketCreatorsResponse {
  if (!payload || typeof payload !== 'object') {
    return false
  }

  const candidate = payload as Partial<PublicAllowedMarketCreatorsResponse>
  return Array.isArray(candidate.wallets) && candidate.wallets.every(wallet => typeof wallet === 'string')
}
