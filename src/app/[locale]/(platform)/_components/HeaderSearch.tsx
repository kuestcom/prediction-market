'use client'

import type { Route } from 'next'
import type { ReactNode } from 'react'
import { SearchIcon, XIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { SearchResults } from '@/app/[locale]/(platform)/_components/SearchResults'
import { Input } from '@/components/ui/input'
import { useSearch } from '@/hooks/useSearch'
import { useSiteIdentity } from '@/hooks/useSiteIdentity'
import { useRouter } from '@/i18n/navigation'
import { buildPredictionResultsPath } from '@/lib/prediction-search'
import { cn } from '@/lib/utils'

interface HeaderSearchProps {
  autoFocus?: boolean
  emptyState?: ReactNode
  onNavigate?: () => void
}

export default function HeaderSearch({
  autoFocus = false,
  emptyState,
  onNavigate,
}: HeaderSearchProps) {
  const searchRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const {
    query,
    handleQueryChange,
    results,
    isLoading,
    showResults,
    clearSearch,
    hideResults,
    showSearchResults,
    activeTab,
    setActiveTab,
  } = useSearch()
  const [isResultsDismissed, setIsResultsDismissed] = useState(false)
  const showDropdown = (showResults || isLoading.events || isLoading.profiles) && !isResultsDismissed
  const inputBaseClass = showDropdown ? 'bg-background' : 'bg-accent'
  const inputBorderClass = showDropdown ? 'border-border' : 'border-transparent'
  const inputHoverClass = showDropdown ? 'hover:bg-background' : 'hover:bg-secondary'
  const inputFocusClass = 'focus:bg-background focus-visible:bg-background'
  const site = useSiteIdentity()
  const sitename = `${site.name || 'events and profiles'}`.toLowerCase()
  const t = useExtracted()
  const shouldShowEmptyState = Boolean(emptyState) && query.trim().length === 0 && !showDropdown

  function navigateToPredictionResults() {
    const nextPath = buildPredictionResultsPath(query)

    if (!nextPath) {
      return
    }

    clearSearch()
    onNavigate?.()
    router.push(nextPath as Route)
  }

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
    function handlePointerDown(event: PointerEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsResultsDismissed(true)
        hideResults()
        inputRef.current?.blur()
      }
    }

    if (showDropdown) {
      document.addEventListener('pointerdown', handlePointerDown)
      return () => {
        document.removeEventListener('pointerdown', handlePointerDown)
      }
    }
  }, [showDropdown, hideResults])

  return (
    <div className="w-full lg:max-w-[600px] lg:min-w-[400px]">
      <div
        className="relative w-full"
        ref={searchRef}
        data-testid="header-search-container"
      >
        <SearchIcon className="absolute top-1/2 left-4 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          ref={inputRef}
          autoFocus={autoFocus}
          data-testid="header-search-input"
          placeholder={`${t('Search')} ${sitename}`}
          value={query}
          onChange={(e) => {
            setIsResultsDismissed(false)
            handleQueryChange(e.target.value)
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || event.nativeEvent.isComposing) {
              return
            }

            event.preventDefault()
            navigateToPredictionResults()
          }}
          onFocus={() => {
            setIsResultsDismissed(false)
            showSearchResults()
          }}
          className={cn(
            'h-12 w-full pr-12 pl-11 shadow-none transition-colors lg:h-10',
            inputBorderClass,
            inputBaseClass,
            { 'rounded-b-none': showDropdown },
            inputHoverClass,
            'focus-visible:border-border',
            inputFocusClass,
            'focus-visible:ring-0 focus-visible:ring-offset-0',
          )}
        />
        {query.length > 0
          ? (
              <button
                type="button"
                className={`
                  absolute top-1/2 right-3 inline-flex -translate-y-1/2 items-center justify-center rounded-sm p-1
                  text-muted-foreground transition-colors
                  hover:text-foreground
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
                lg:inline-flex
              `}
              >
                /
              </span>
            )}
        {showDropdown && (
          <SearchResults
            results={results}
            isLoading={isLoading}
            activeTab={activeTab}
            query={query}
            onResultClick={() => {
              clearSearch()
              onNavigate?.()
            }}
            onTabChange={setActiveTab}
          />
        )}
      </div>

      {shouldShowEmptyState ? emptyState : null}
    </div>
  )
}
