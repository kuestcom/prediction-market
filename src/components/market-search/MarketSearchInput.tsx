'use client'

import { Search, X } from 'lucide-react'
import { useEffect, useRef } from 'react'

interface MarketSearchInputProps {
  value: string
  onChange: (value: string) => void
  onClear: () => void
  isLoading: boolean
}

/**
 * Controlled search input. Auto-focuses on mount and clears on Escape
 * (the parent dialog handles Escape to close; this only clears the text).
 */
export function MarketSearchInput({
  value,
  onChange,
  onClear,
  isLoading,
}: MarketSearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Small rAF delay lets the dialog animation complete before focusing.
    const id = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <div className="flex items-center gap-3 border-b border-gray-800 px-4 py-3">
      {/* Icon — spinner while loading, magnifier otherwise */}
      <span className="shrink-0 text-gray-400">
        {isLoading
          ? (
              <svg
                className="size-4 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                />
              </svg>
            )
          : (
              <Search className="size-4" aria-hidden="true" />
            )}
      </span>

      <input
        ref={inputRef}
        id="market-search-input"
        type="search"
        role="combobox"
        aria-autocomplete="list"
        aria-controls="market-search-listbox"
        aria-label="Search markets"
        autoComplete="off"
        spellCheck={false}
        placeholder="Search markets…"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="flex-1 bg-transparent text-sm text-gray-100 placeholder-gray-500 outline-none"
      />

      {value.length > 0 && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          className="shrink-0 rounded-sm p-1 text-gray-500 transition-colors hover:bg-gray-800 hover:text-gray-300"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}
