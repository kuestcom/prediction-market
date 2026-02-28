import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useMarketSearch } from "@/hooks/useMarketSearch";

// ── Supabase mock ─────────────────────────────────────────────────────────────

const mockSelect = vi.fn();
const mockTextSearch = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockAbortSignal = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      select: mockSelect.mockReturnThis(),
      textSearch: mockTextSearch.mockReturnThis(),
      eq: mockEq.mockReturnThis(),
      order: mockOrder.mockReturnThis(),
      limit: mockLimit.mockReturnThis(),
      abortSignal: mockAbortSignal,
    }),
  }),
}));

const MOCK_MARKETS = [
  {
    id: "1",
    slug: "will-btc-reach-100k",
    question: "Will BTC reach $100k by end of 2025?",
    probability: 0.72,
    close_time: "2025-12-31T00:00:00Z",
    volume_usdc: 500000,
    active: true,
    category: "Crypto",
  },
  {
    id: "2",
    slug: "will-eth-flip-btc",
    question: "Will ETH flip BTC in market cap?",
    probability: 0.18,
    close_time: "2025-06-30T00:00:00Z",
    volume_usdc: 120000,
    active: true,
    category: "Crypto",
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveWith(data: typeof MOCK_MARKETS | null, error: unknown = null) {
  mockAbortSignal.mockResolvedValueOnce({ data, error });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("useMarketSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("returns empty results for a query shorter than minLength", async () => {
    const { result } = renderHook(() => useMarketSearch("bt"));
    expect(result.current.results).toHaveLength(0);
    expect(result.current.isLoading).toBe(false);
    expect(mockAbortSignal).not.toHaveBeenCalled();
  });

  it("shows loading state while debounce is pending", async () => {
    resolveWith(MOCK_MARKETS);
    const { result } = renderHook(() => useMarketSearch("btc"));

    // After first render, loading should be true (timer not fired yet).
    expect(result.current.isLoading).toBe(true);
    expect(result.current.results).toHaveLength(0);
  });

  it("returns mapped results after debounce fires", async () => {
    resolveWith(MOCK_MARKETS);
    const { result } = renderHook(() => useMarketSearch("crypto", { debounceMs: 350 }));

    vi.advanceTimersByTime(350);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.results).toHaveLength(2);
    });

    expect(result.current.results[0]).toMatchObject({
      id: "1",
      slug: "will-btc-reach-100k",
      probability: 0.72,
      volumeUsdc: 500000,
      category: "Crypto",
    });
  });

  it("sets error state on Supabase error", async () => {
    resolveWith(null, { message: "DB error" });
    const { result } = renderHook(() => useMarketSearch("fail", { debounceMs: 0 }));

    vi.advanceTimersByTime(0);

    await waitFor(() => {
      expect(result.current.error).toBe("Search failed. Please try again.");
      expect(result.current.results).toHaveLength(0);
    });
  });

  it("clear() resets all state", async () => {
    resolveWith(MOCK_MARKETS);
    const { result } = renderHook(() => useMarketSearch("crypto", { debounceMs: 0 }));

    vi.advanceTimersByTime(0);
    await waitFor(() => expect(result.current.results).toHaveLength(2));

    result.current.clear();
    await waitFor(() => {
      expect(result.current.results).toHaveLength(0);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  it("cancels previous request when query changes before debounce fires", async () => {
    const { rerender } = renderHook(
      ({ query }: { query: string }) => useMarketSearch(query, { debounceMs: 350 }),
      { initialProps: { query: "btc" } }
    );

    // Change query before 350 ms elapses.
    rerender({ query: "eth" });

    // Original timer should have been cleared; only one fetch fires.
    resolveWith(MOCK_MARKETS);
    vi.advanceTimersByTime(350);

    await waitFor(() => expect(mockAbortSignal).toHaveBeenCalledTimes(1));
  });
});
