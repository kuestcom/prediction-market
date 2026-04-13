'use client'

import type { ChangeEvent } from 'react'
import { SearchIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useCallback, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'

interface FilterToolbarSearchInputProps {
  search: string
  onSearchChange: (search: string) => void
}

export default function FilterToolbarSearchInput({ search, onSearchChange }: FilterToolbarSearchInputProps) {
  return (
    <FilterToolbarSearchInputField
      search={search}
      onSearchChange={onSearchChange}
    />
  )
}

interface FilterToolbarSearchInputFieldProps {
  search: string
  onSearchChange: (search: string) => void
}

function useFilterToolbarSearchInputFieldState({
  search,
  onSearchChange,
}: FilterToolbarSearchInputFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSubmittedSearchRef = useRef(search)
  const t = useExtracted()

  useEffect(function clearPendingSearchDebounceEffect() {
    function clearPendingSearchDebounce() {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
    }

    return clearPendingSearchDebounce
  }, [])

  const handleInputChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const nextSearch = event.target.value
    lastSubmittedSearchRef.current = nextSearch

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }

    debounceTimeoutRef.current = setTimeout(() => {
      debounceTimeoutRef.current = null
      onSearchChange(nextSearch)
    }, 150)
  }, [onSearchChange])

  useEffect(function syncInputValueFromExternalSearchEffect() {
    if (search === lastSubmittedSearchRef.current) {
      return
    }

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
      debounceTimeoutRef.current = null
    }

    const inputElement = inputRef.current

    if (!inputElement) {
      return
    }

    inputElement.value = search
    lastSubmittedSearchRef.current = search
  }, [search])

  return {
    inputRef,
    handleInputChange,
    searchPlaceholder: t('Search'),
  }
}

function FilterToolbarSearchInputField({
  search,
  onSearchChange,
}: FilterToolbarSearchInputFieldProps) {
  const {
    inputRef,
    handleInputChange,
    searchPlaceholder,
  } = useFilterToolbarSearchInputFieldState({ search, onSearchChange })

  return (
    <div className="relative w-full md:w-44 lg:w-52 xl:w-56">
      <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        type="text"
        data-testid="filter-search-input"
        placeholder={searchPlaceholder}
        defaultValue={search}
        onChange={handleInputChange}
        className={`
          border-transparent bg-accent pl-10 shadow-none transition-colors
          hover:bg-secondary
          focus-visible:border-border focus-visible:bg-background focus-visible:ring-0 focus-visible:ring-offset-0
        `}
      />
    </div>
  )
}
