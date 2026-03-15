import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { AllowedMarketCreatorRepository } from '@/lib/db/queries/allowed-market-creators'
import { SettingsRepository } from '@/lib/db/queries/settings'

const WALLET_ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/

export function parseLegacyAllowedMarketCreatorWallets(value: string | null | undefined) {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) {
    return [] as string[]
  }

  const deduped = new Set<string>()
  for (const entry of trimmed.split(/[\n,]+/)) {
    const wallet = entry.trim()
    if (!WALLET_ADDRESS_PATTERN.test(wallet)) {
      continue
    }

    deduped.add(wallet.toLowerCase())
  }

  return [...deduped]
}

export function mergeAllowedMarketCreatorWallets(...walletGroups: Array<Iterable<string>>) {
  const deduped = new Set<string>()

  for (const walletGroup of walletGroups) {
    for (const wallet of walletGroup) {
      if (WALLET_ADDRESS_PATTERN.test(wallet)) {
        deduped.add(wallet.toLowerCase())
      }
    }
  }

  return [...deduped].sort()
}

export async function loadAllowedMarketCreatorWallets() {
  const [{ data: persistedWallets, error: persistedError }, { data: settings, error: settingsError }] = await Promise.all([
    AllowedMarketCreatorRepository.listWallets(),
    SettingsRepository.getSettings(),
  ])

  if (persistedError || !persistedWallets) {
    return {
      data: null,
      error: persistedError ?? DEFAULT_ERROR_MESSAGE,
    }
  }

  if (settingsError || !settings) {
    return {
      data: null,
      error: settingsError ?? DEFAULT_ERROR_MESSAGE,
    }
  }

  const legacyWallets = parseLegacyAllowedMarketCreatorWallets(settings.general?.market_creators?.value)

  return {
    data: mergeAllowedMarketCreatorWallets(persistedWallets, legacyWallets),
    error: null,
  }
}
