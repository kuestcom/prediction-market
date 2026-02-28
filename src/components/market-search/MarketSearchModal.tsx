'use client'

import type { MarketSearchResult } from '@/types/market-search'
import { Search, TrendingUp, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { useMarketSearch } from '@/hooks/useMarketSearch'

interface MarketSearchModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MarketSearchModal({ open, onOpenChange }: MarketSearchModalProps) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [, startTransition] = useTransition()

  const { results, isLoading, error, clear } = useMarketSearch(query)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    if (!open) {
      setQuery('')
      setActiveIndex(0)
      clear()
    }
  }, [open, clear])

  useEffect(() => {
    setActiveIndex(0)
  }, [results])

  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => inputRef.current?.focus())
      return () => cancelAnimationFrame(id)
    }
  }, [open])

  const handleSelect = useCallback(
    (result: MarketSearchResult) => {
      onOpenChange(false)
      startTransition(() => {
        router.push(`/markets/${result.slug}`)
      })
    },
    [onOpenChange, router],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!results.length) {
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex(i => (i + 1) % results.length)
      }
      else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex(i => (i - 1 + results.length) % results.length)
      }
      else if (e.key === 'Enter') {
        e.preventDefault()
        if (results[activeIndex]) {
          handleSelect(results[activeIndex])
        }
      }
    },
    [results, activeIndex, handleSelect],
  )

  const showEmpty
    = query.trim().length >= 2 && !isLoading && !error && results.length === 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="overflow-hidden p-0 shadow-2xl sm:max-w-[560px]"
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            role="combobox"
            aria-autocomplete="list"
            aria-controls="market-search-listbox"
            aria-expanded={results.length > 0}
            aria-activedescendant={
              results.length > 0 ? `market-result-${activeIndex}` : undefined
            }
            aria-label="Search markets"
            autoComplete="off"
            spellCheck={false}
            placeholder="Search markets…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {query.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setQuery('')
                clear()
              }}
              aria-label="Clear search"
              className="
                shrink-0 rounded-sm p-1 text-muted-foreground transition-colors
                hover:bg-accent hover:text-accent-foreground
              "
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {results.length > 0 && (
          <ul
            id="market-search-listbox"
            role="listbox"
            aria-label="Markets"
            className="max-h-72 overflow-y-auto py-1"
          >
            {results.map((result, i) => {
              const pct = Math.round(result.probability * 100)
              const badgeClass
                = pct > 60
                  ? 'text-emerald-500'
                  : pct < 40
                    ? 'text-destructive'
                    : 'text-amber-500'

              return (
                <li
                  key={result.id}
                  id={`market-result-${i}`}
                  role="option"
                  aria-selected={i === activeIndex}
                  onPointerDown={e => e.preventDefault()}
                  onClick={() => handleSelect(result)}
                  className={`flex cursor-pointer items-center gap-3 px-4 py-3 text-sm transition-colors ${
                    i === activeIndex ? 'bg-accent' : 'hover:bg-accent/50'
                  }`}
                >
                  <TrendingUp className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="flex-1 truncate">{result.question}</span>
                  <span className={`shrink-0 font-medium tabular-nums ${badgeClass}`}>
                    {pct}
                    %
                  </span>
                </li>
              )
            })}
          </ul>
        )}

        {error && (
          <p role="alert" className="px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}

        {showEmpty && (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            No markets found for &ldquo;
            {query}
            &rdquo;
          </p>
        )}

        <div className="flex items-center gap-4 border-t px-4 py-2 text-xs text-muted-foreground">
          <span>
            <kbd className="rounded-sm border bg-muted px-1 font-mono text-xs">↑↓</kbd>
            {' '}
            navigate
          </span>
          <span>
            <kbd className="rounded-sm border bg-muted px-1 font-mono text-xs">↵</kbd>
            {' '}
            open
          </span>
          <span>
            <kbd className="rounded-sm border bg-muted px-1 font-mono text-xs">Esc</kbd>
            {' '}
            close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
