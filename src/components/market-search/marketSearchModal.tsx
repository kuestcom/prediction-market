"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { useMarketSearch } from "@/hooks/useMarketSearch";
import { MarketSearchInput } from "./MarketSearchInput";
import { MarketSearchResult } from "./MarketSearchResult";
import type { MarketSearchResult as IMarketSearchResult } from "@/types/market-search";

interface MarketSearchModalProps {
  /** Controlled open state */
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Cmd+K command palette for searching markets.
 *
 * Accessibility:
 * - Uses the native `<dialog>` element for built-in focus management.
 * - Result list is a `role="listbox"` with `aria-activedescendant` tracking.
 * - Keyboard: ↑↓ navigate, Enter selects, Escape closes.
 *
 * Responsiveness:
 * - Desktop: centred modal, max-width 560px.
 * - Mobile (< sm): full-width sheet anchored to the top.
 */
export function MarketSearchModal({ open, onOpenChange }: MarketSearchModalProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [, startTransition] = useTransition();

  const { results, isLoading, error, clear } = useMarketSearch(query);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();

  // ── Open / close the native dialog ───────────────────────────────────────

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) dialog.showModal();
    } else {
      if (dialog.open) dialog.close();
      setQuery("");
      clear();
      setActiveIndex(0);
    }
  }, [open, clear]);

  // Keep activeIndex in bounds when results change.
  useEffect(() => {
    setActiveIndex(0);
  }, [results]);

  // Handle native `close` event (Escape key on the dialog element itself).
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handler = () => onOpenChange(false);
    dialog.addEventListener("close", handler);
    return () => dialog.removeEventListener("close", handler);
  }, [onOpenChange]);

  // ── Keyboard navigation ───────────────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!results.length) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setActiveIndex((i) => (i + 1) % results.length);
          break;
        case "ArrowUp":
          e.preventDefault();
          setActiveIndex((i) => (i - 1 + results.length) % results.length);
          break;
        case "Enter":
          e.preventDefault();
          if (results[activeIndex]) handleSelect(results[activeIndex]);
          break;
        default:
          break;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [results, activeIndex]
  );

  // ── Select a result ───────────────────────────────────────────────────────

  const handleSelect = useCallback(
    (result: IMarketSearchResult) => {
      onOpenChange(false);
      startTransition(() => {
        router.push(`/markets/${result.slug}`);
      });
    },
    [onOpenChange, router]
  );

  // ── Backdrop click closes the modal ──────────────────────────────────────

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === dialogRef.current) onOpenChange(false);
    },
    [onOpenChange]
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      aria-label="Market search"
      aria-modal="true"
      className={`
        m-0 w-full max-w-none border-0 bg-transparent p-0 text-white
        backdrop:bg-black/60 backdrop:backdrop-blur-sm
        sm:mx-auto sm:mt-24 sm:max-w-[560px] sm:rounded-xl
        open:flex open:flex-col
      `}
    >
      {/* Inner panel */}
      <div
        role="combobox"
        aria-expanded={results.length > 0}
        aria-haspopup="listbox"
        onKeyDown={handleKeyDown}
        className="flex flex-col overflow-hidden rounded-xl border border-gray-700 bg-gray-900 shadow-2xl"
      >
        {/* Input */}
        <MarketSearchInput
          value={query}
          onChange={(val) => {
            setQuery(val);
          }}
          onClear={() => {
            setQuery("");
            clear();
          }}
          isLoading={isLoading}
        />

        {/* Results */}
        {results.length > 0 && (
          <ul
            id="market-search-listbox"
            role="listbox"
            aria-label="Markets"
            aria-activedescendant={
              activeIndex >= 0
                ? `market-search-result-${activeIndex}`
                : undefined
            }
            className="max-h-72 overflow-y-auto py-1"
          >
            {results.map((result, i) => (
              <MarketSearchResult
                key={result.id}
                result={result}
                isActive={i === activeIndex}
                onSelect={handleSelect}
                index={i}
              />
            ))}
          </ul>
        )}

        {/* Error state */}
        {error && (
          <p role="alert" className="px-4 py-3 text-sm text-red-400">
            {error}
          </p>
        )}

        {/* Empty state — only show when query is long enough and not loading */}
        {query.trim().length >= 2 && !isLoading && !error && results.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-gray-500">
            No markets found for &ldquo;{query}&rdquo;
          </p>
        )}

        {/* Footer hint */}
        <div className="flex items-center gap-3 border-t border-gray-800 px-4 py-2 text-xs text-gray-600">
          <span><kbd className="font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono">↵</kbd> open</span>
          <span><kbd className="font-mono">Esc</kbd> close</span>
        </div>
      </div>
    </dialog>
  );
}
