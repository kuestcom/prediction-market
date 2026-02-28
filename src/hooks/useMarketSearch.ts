import type {
  MarketSearchResult,
  UseMarketSearchOptions,
  UseMarketSearchReturn,
} from '@/types/market-search'
import { useCallback, useEffect, useRef, useState } from 'react'

const DEFAULT_OPTIONS: Required<UseMarketSearchOptions> = {
  minLength: 2,
  debounceMs: 350,
  limit: 8,
}

export function useMarketSearch(
  query: string,
  options: UseMarketSearchOptions = {},
): UseMarketSearchReturn {
  const { minLength, debounceMs, limit } = { ...DEFAULT_OPTIONS, ...options }

  const [results, setResults] = useState<MarketSearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clear = useCallback(() => {
    abortRef.current?.abort()
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    setResults([])
    setIsLoading(false)
    setError(null)
  }, [])

  useEffect(() => {
    const trimmed = query.trim()

    if (trimmed.length < minLength) {
      clear()
      return
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    abortRef.current?.abort()

    setIsLoading(true)
    setError(null)

    timerRef.current = setTimeout(async () => {
      const controller = new AbortController()
      abortRef.current = controller

      try {
        const url = `/api/markets/search?q=${encodeURIComponent(trimmed)}&limit=${limit}`
        const res = await fetch(url, { signal: controller.signal })

        if (controller.signal.aborted) {
          return
        }

        if (!res.ok) {
          throw new Error(res.statusText)
        }

        const data: MarketSearchResult[] = await res.json()
        setResults(data)
      }
      catch (err) {
        if ((err as Error).name === 'AbortError') {
          return
        }
        setError('Search failed. Please try again.')
        setResults([])
      }
      finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }, debounceMs)

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
      abortRef.current?.abort()
    }
  }, [query, minLength, debounceMs, limit, clear])

  return { results, isLoading, error, clear }
}
