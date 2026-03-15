import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { AllowedMarketCreatorRepository } from '@/lib/db/queries/allowed-market-creators'

const WALLET_ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/

export function normalizeAllowedMarketCreatorWallets(wallets: Iterable<string>) {
  const deduped = new Set<string>()

  for (const wallet of wallets) {
    if (WALLET_ADDRESS_PATTERN.test(wallet)) {
      deduped.add(wallet.toLowerCase())
    }
  }

  return [...deduped].sort()
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
