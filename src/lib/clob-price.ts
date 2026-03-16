import { normalizeMarketPrice } from '@/lib/market-chance'

export function normalizeClobMarketPrice(value: number | string | null | undefined) {
  if (typeof value === 'string' && value.trim() === '') {
    return null
  }

  return normalizeMarketPrice(value)
}
