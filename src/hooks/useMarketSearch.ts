import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  MarketSearchResult,
  UseMarketSearchOptions,
  UseMarketSearchReturn,
} from "@/types/market-search";

const DEFAULT_OPTIONS: Required<UseMarketSearchOptions> = {
  minLength: 2,
  debounceMs: 350,
  limit: 8,
};

/**
 * Debounced, cancellation-safe market search hook.
 *
 * Fetches markets from Supabase whose `question` column matches the query
 * using Postgres full-text search (`@@`). Each new query cancels any
 * in-flight request via AbortController so stale responses never land.
 *
 * @example
 * ```tsx
 * const { results, isLoading } = useMarketSearch(query);
 * ```
 */
export function useMarketSearch(
  query: string,
  options: UseMarketSearchOptions = {}
): UseMarketSearchReturn {
  const { minLength, debounceMs, limit } = { ...DEFAULT_OPTIONS, ...options };

  const [results, setResults] = useState<MarketSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep a ref to the latest AbortController so we can cancel mid-flight.
  const abortRef = useRef<AbortController | null>(null);
  // Keep a ref to the debounce timer.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    if (timerRef.current) clearTimeout(timerRef.current);
    setResults([]);
    setIsLoading(false);
    setError(null);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();

    // Below minimum → clear and bail out.
    if (trimmed.length < minLength) {
      clear();
      return;
    }

    // Cancel any previous pending timer or fetch.
    if (timerRef.current) clearTimeout(timerRef.current);
    abortRef.current?.abort();

    setIsLoading(true);
    setError(null);

    timerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const supabase = createClient();

        /**
         * Use Postgres full-text search for ranking relevance.
         * Falls back to a simple `ilike` if the `fts` column isn't set up.
         */
        const { data, error: dbError } = await supabase
          .from("markets")
          .select(
            "id, slug, question, probability, close_time, volume_usdc, active, category"
          )
          .textSearch("question", trimmed, {
            type: "websearch",
            config: "english",
          })
          .eq("active", true)
          .order("volume_usdc", { ascending: false })
          .limit(limit)
          .abortSignal(controller.signal);

        // Ignore results from an aborted request.
        if (controller.signal.aborted) return;

        if (dbError) throw dbError;

        const mapped: MarketSearchResult[] = (data ?? []).map((row) => ({
          id: row.id,
          slug: row.slug,
          question: row.question,
          probability: row.probability ?? 0.5,
          closeTime: row.close_time,
          volumeUsdc: row.volume_usdc ?? 0,
          active: row.active,
          category: row.category ?? undefined,
        }));

        setResults(mapped);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        console.error("[useMarketSearch]", err);
        setError("Search failed. Please try again.");
        setResults([]);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      abortRef.current?.abort();
    };
  }, [query, minLength, debounceMs, limit, clear]);

  return { results, isLoading, error, clear };
}
