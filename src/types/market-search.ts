/**
 * Shared types for the market search command palette.
 * Mirrors the Supabase `markets` table shape — extend as columns are added.
 */

export interface MarketSearchResult {
    id: string;
    slug: string;
    question: string;
    /** Probability of the YES outcome, 0–1 */
    probability: number;
    /** ISO-8601 close timestamp */
    closeTime: string;
    /** Total USDC volume in the market */
    volumeUsdc: number;
    /** Whether the market is still open for trading */
    active: boolean;
    /** Optional category tag (e.g. "Crypto", "Sports") */
    category?: string;
  }
  
  export interface UseMarketSearchOptions {
    /** Minimum query length before a fetch is triggered. Default: 2 */
    minLength?: number;
    /** Debounce delay in ms. Default: 350 */
    debounceMs?: number;
    /** Maximum results to return. Default: 8 */
    limit?: number;
  }
  
  export interface UseMarketSearchReturn {
    results: MarketSearchResult[];
    isLoading: boolean;
    error: string | null;
    /** Reset results and clear any pending request */
    clear: () => void;
  }
  