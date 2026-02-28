'use client'

import type { MarketSearchResult as IMarketSearchResult } from '@/types/market-search'
import { TrendingUp } from 'lucide-react'

interface MarketSearchResultProps {
  result: IMarketSearchResult
  isActive: boolean
  onSelect: (result: IMarketSearchResult) => void
  index: number
}

/**
 * A single row inside the search results listbox.
 * Uses `onPointerDown` + `preventDefault` so the input doesn't lose focus
 * on click — then fires `onSelect` on `onClick` once the event is committed.
 */
export function MarketSearchResult({
  result,
  isActive,
  onSelect,
  index,
}: MarketSearchResultProps) {
  const pct = Math.round(result.probability * 100)

  // Colour the probability badge: green > 60 %, amber 40–60 %, red < 40 %.
  const badgeColour
    = pct > 60
      ? 'bg-emerald-900/60 text-emerald-400'
      : pct < 40
        ? 'bg-red-900/60 text-red-400'
        : 'bg-amber-900/60 text-amber-400'

  return (
    <li
      id={`market-search-result-${index}`}
      role="option"
      aria-selected={isActive}
      data-index={index}
      onPointerDown={e => e.preventDefault()}
      onClick={() => onSelect(result)}
      className={`
        flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors
        ${isActive ? 'bg-gray-800' : 'hover:bg-gray-800/50'}
      `}
    >
      {/* Trending icon placeholder — swap for category icon if desired */}
      <span className="shrink-0 text-gray-500">
        <TrendingUp className="size-4" aria-hidden="true" />
      </span>

      {/* Market question */}
      <span className="flex-1 truncate text-sm text-gray-100">
        {result.question}
      </span>

      {/* Probability badge */}
      <span
        className={`shrink-0 rounded-sm px-1.5 py-0.5 text-xs font-semibold tabular-nums ${badgeColour}`}
        title={`${pct}% YES probability`}
      >
        {pct}
        %
      </span>
    </li>
  )
}
