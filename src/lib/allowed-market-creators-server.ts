import {
  isPublicAllowedMarketCreatorsResponse,
  normalizeAllowedMarketCreatorSiteInput,
} from '@/lib/allowed-market-creators'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { AllowedMarketCreatorRepository } from '@/lib/db/queries/allowed-market-creators'

const WALLET_ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/
const SITE_SOURCE_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000

interface RefreshAllowedMarketCreatorSiteSourcesOptions {
  force?: boolean
  now?: Date
}

interface RefreshAllowedMarketCreatorSiteSourcesError {
  sourceUrl: string
  message: string
}

export interface RefreshAllowedMarketCreatorSiteSourcesResult {
  scanned: number
  checked: number
  refreshed: number
  skippedFresh: number
  wallets: number
  errors: RefreshAllowedMarketCreatorSiteSourcesError[]
}

export function normalizeAllowedMarketCreatorWallets(wallets: Iterable<string>) {
  const deduped = new Set<string>()

  for (const wallet of wallets) {
    if (WALLET_ADDRESS_PATTERN.test(wallet)) {
      deduped.add(wallet.toLowerCase())
    }
  }

  return [...deduped].sort()
}

function shouldRefreshSiteSource(refreshedAt: Date | null, now: Date) {
  if (!refreshedAt) {
    return true
  }

  return now.getTime() - refreshedAt.getTime() >= SITE_SOURCE_REFRESH_INTERVAL_MS
}

function errorMessageFromUnknown(error: unknown) {
  return error instanceof Error ? error.message : DEFAULT_ERROR_MESSAGE
}

async function fetchCreatorWalletsFromSite(sourceUrl: string) {
  const normalizedSite = normalizeAllowedMarketCreatorSiteInput(sourceUrl)
  if ('error' in normalizedSite) {
    throw new Error(normalizedSite.error)
  }

  if (!normalizedSite.origin.startsWith('https://')) {
    throw new Error('Site URL must use https.')
  }

  const response = await fetch(normalizedSite.endpointUrl, {
    method: 'GET',
    cache: 'no-store',
    redirect: 'error',
    headers: {
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(12_000),
  })

  if (!response.ok) {
    throw new Error(`Site endpoint failed (${response.status}).`)
  }

  const payload = await response.json().catch(() => null)
  if (!isPublicAllowedMarketCreatorsResponse(payload)) {
    throw new Error('Site endpoint returned an invalid payload.')
  }

  const wallets = normalizeAllowedMarketCreatorWallets(payload.wallets)
  if (wallets.length === 0) {
    throw new Error('Site endpoint did not return any valid wallets.')
  }

  return {
    displayName: normalizedSite.displayName,
    sourceUrl: normalizedSite.origin,
    wallets,
  }
}

export async function refreshAllowedMarketCreatorSiteSources(
  options: RefreshAllowedMarketCreatorSiteSourcesOptions = {},
): Promise<RefreshAllowedMarketCreatorSiteSourcesResult> {
  const now = options.now ?? new Date()
  const result: RefreshAllowedMarketCreatorSiteSourcesResult = {
    scanned: 0,
    checked: 0,
    refreshed: 0,
    skippedFresh: 0,
    wallets: 0,
    errors: [],
  }

  const sourcesResult = await AllowedMarketCreatorRepository.listSiteSources()
  if (sourcesResult.error || !sourcesResult.data) {
    throw new Error(sourcesResult.error ?? 'Could not load allowed creator site sources.')
  }

  result.scanned = sourcesResult.data.length

  for (const source of sourcesResult.data) {
    if (!options.force && !shouldRefreshSiteSource(source.refreshedAt, now)) {
      result.skippedFresh += 1
      continue
    }

    result.checked += 1

    try {
      const remoteSource = await fetchCreatorWalletsFromSite(source.sourceUrl)
      const replaceResult = await AllowedMarketCreatorRepository.replaceSiteSource({
        sourceUrl: remoteSource.sourceUrl,
        displayName: remoteSource.displayName,
        walletAddresses: remoteSource.wallets,
      })

      if (replaceResult.error) {
        throw new Error(replaceResult.error)
      }

      result.refreshed += 1
      result.wallets += remoteSource.wallets.length
    }
    catch (error) {
      result.errors.push({
        sourceUrl: source.sourceUrl,
        message: errorMessageFromUnknown(error),
      })
    }
  }

  return result
}

export async function loadAllowedMarketCreatorWallets() {
  const { data, error } = await AllowedMarketCreatorRepository.listWallets()
  if (error || !data) {
    return {
      data: null,
      error: error ?? DEFAULT_ERROR_MESSAGE,
    }
  }

  return {
    data: normalizeAllowedMarketCreatorWallets(data),
    error: null,
  }
}
