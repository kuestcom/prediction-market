export const PUBLIC_ALLOWED_MARKET_CREATORS_PATH = '/api/allowed-market-creators'
export const DEMO_ALLOWED_MARKET_CREATOR_DISPLAY_NAME = 'demo.kuest.com'

export type AllowedMarketCreatorSourceType = 'site' | 'wallet'

export interface AllowedMarketCreatorRecord {
  walletAddress: string
  displayName: string
  sourceUrl: string | null
  sourceType: AllowedMarketCreatorSourceType
}

export interface AllowedMarketCreatorItem {
  walletAddress: string | null
  walletCount: number
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

function normalizeSiteHostname(hostname: string) {
  return hostname.trim().toLowerCase().replace(/^\[|\]$/g, '')
}

function isPrivateIpv4Hostname(hostname: string) {
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) {
    return false
  }

  const octets = hostname.split('.').map(part => Number(part))
  if (octets.some(octet => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return false
  }

  const [first, second] = octets
  return first === 0
    || first === 10
    || first === 127
    || (first === 100 && second >= 64 && second <= 127)
    || (first === 169 && second === 254)
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 168)
    || (first === 198 && (second === 18 || second === 19))
}

function isPrivateIpv6Hostname(hostname: string) {
  if (!hostname.includes(':')) {
    return false
  }

  const normalized = hostname.toLowerCase()
  if (normalized === '::' || normalized === '::1') {
    return true
  }

  if (normalized.startsWith('::ffff:')) {
    return isPrivateIpv4Hostname(normalized.slice(7))
  }

  const firstHextet = (() => {
    const [head] = normalized.split('::', 2)
    if (!head) {
      return '0'
    }

    return head.split(':')[0] || '0'
  })()
  return /^fc/i.test(firstHextet)
    || /^fd/i.test(firstHextet)
    || /^fe[89ab]/i.test(firstHextet)
}

function isDisallowedSiteHostname(hostname: string) {
  const normalized = normalizeSiteHostname(hostname)
  if (!normalized) {
    return true
  }

  if (normalized === 'localhost' || normalized.endsWith('.localhost')) {
    return true
  }

  if (!normalized.includes('.') && !normalized.includes(':')) {
    return true
  }

  return isPrivateIpv4Hostname(normalized) || isPrivateIpv6Hostname(normalized)
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

    if (isDisallowedSiteHostname(parsed.hostname)) {
      return { error: 'Site URL must point to a public host.' } as const
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

export function groupAllowedMarketCreatorItems(records: AllowedMarketCreatorRecord[]): AllowedMarketCreatorItem[] {
  const siteItems = new Map<string, AllowedMarketCreatorItem>()
  const walletItems: AllowedMarketCreatorItem[] = []

  for (const record of records) {
    if (record.sourceType === 'site' && record.sourceUrl) {
      const existing = siteItems.get(record.sourceUrl)
      if (existing) {
        existing.walletCount += 1
        continue
      }

      siteItems.set(record.sourceUrl, {
        walletAddress: null,
        walletCount: 1,
        displayName: record.displayName,
        sourceUrl: record.sourceUrl,
        sourceType: 'site',
      })
      continue
    }

    walletItems.push({
      walletAddress: record.walletAddress,
      walletCount: 1,
      displayName: record.displayName,
      sourceUrl: record.sourceUrl,
      sourceType: record.sourceType,
    })
  }

  return [...siteItems.values(), ...walletItems]
}

export function isAllowedMarketCreatorItem(payload: unknown): payload is AllowedMarketCreatorItem {
  if (!payload || typeof payload !== 'object') {
    return false
  }

  const candidate = payload as Partial<AllowedMarketCreatorItem>
  return (typeof candidate.walletAddress === 'string' || candidate.walletAddress === null)
    && typeof candidate.walletCount === 'number'
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
