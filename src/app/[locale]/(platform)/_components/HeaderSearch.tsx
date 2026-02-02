'use client'

import { SearchIcon, XIcon } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { SearchResults } from '@/app/[locale]/(platform)/_components/SearchResults'
import { Input } from '@/components/ui/input'
import { useSearch } from '@/hooks/useSearch'

export default function HeaderSearch() {
  const searchRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { query, handleQueryChange, results, isLoading, showResults, clearSearch, hideResults, activeTab, setActiveTab } = useSearch()
  const showDropdown = showResults || isLoading.events || isLoading.profiles
  const inputBaseClass = showDropdown ? 'bg-background' : 'bg-input'
  const inputBorderClass = showDropdown ? 'border-border' : 'border-transparent'
  const inputHoverClass = showDropdown ? 'hover:bg-background' : 'hover:bg-[color:var(--input-hover)]'
  const inputFocusClass = 'focus:bg-background focus-visible:bg-background'
  const sitename = `${process.env.NEXT_PUBLIC_SITE_NAME || 'events and profiles'}`.toLowerCase()

  useEffect(() => {
    function handleSlashShortcut(event: KeyboardEvent) {
      if (event.key !== '/') {
        return
      }

      const target = event.target as HTMLElement | null
      const tagName = target?.tagName?.toLowerCase()
      const isEditable = tagName === 'input' || tagName === 'textarea' || target?.isContentEditable

      if (event.metaKey || event.ctrlKey || event.altKey || isEditable) {
        return
      }

      event.preventDefault()
      inputRef.current?.focus()
    }

    window.addEventListener('keydown', handleSlashShortcut)
    return () => {
      window.removeEventListener('keydown', handleSlashShortcut)
    }
  }, [])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        hideResults()
      }
    }

    if (showResults) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [showResults, hideResults])

  return (
    <div
      className="relative mx-2 hidden flex-1 sm:ms-4 sm:me-0 sm:flex sm:max-w-xl"
      ref={searchRef}
      data-testid="header-search-container"
    >
      <SearchIcon className="absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="text"
        ref={inputRef}
        data-testid="header-search-input"
        placeholder={`Search ${sitename}`}
        value={query}
        onChange={e => handleQueryChange(e.target.value)}
        className={`
          h-10 w-full pr-12 pl-9 shadow-none transition-colors
          ${inputBorderClass}
          ${inputBaseClass}
          ${showDropdown ? 'rounded-b-none' : ''}
          ${inputHoverClass}
          focus-visible:border-border ${inputFocusClass} focus-visible:ring-0 focus-visible:ring-offset-0
        `}
      />
      {query.length > 0
        ? (
            <button
              type="button"
              className={`
                absolute top-1/2 right-2 hidden -translate-y-1/2 items-center justify-center rounded-sm p-1
                text-muted-foreground transition-colors
                hover:text-foreground
                sm:inline-flex
              `}
              onClick={() => {
                clearSearch()
                inputRef.current?.focus()
              }}
              aria-label="Clear search"
            >
              <XIcon className="size-4" />
            </button>
          )
        : (
            <span className={`
              absolute top-1/2 right-3 hidden -translate-y-1/2 font-mono text-xs text-muted-foreground
              sm:inline-flex
            `}
            >
              /
            </span>
          )}
      {(showResults || isLoading.events || isLoading.profiles) && (
        <SearchResults
          results={results}
          isLoading={isLoading}
          activeTab={activeTab}
          query={query}
          onResultClick={clearSearch}
          onTabChange={setActiveTab}
        />
      )}
    </div>
  )
}
