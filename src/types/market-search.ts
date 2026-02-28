export interface MarketSearchResult {
  id: string
  slug: string
  question: string
  probability: number
  closeTime: string
  volumeUsdc: number
  active: boolean
  category?: string
}

export interface UseMarketSearchOptions {
  minLength?: number
  debounceMs?: number
  limit?: number
}

export interface UseMarketSearchReturn {
  results: MarketSearchResult[]
  isLoading: boolean
  error: string | null
  clear: () => void
}
