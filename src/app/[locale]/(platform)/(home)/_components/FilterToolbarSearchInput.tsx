'use client'

import type { ChangeEvent, KeyboardEvent, RefObject } from 'react'

import { SearchIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface FilterToolbarSearchInputProps {
  collapsible?: boolean
  search: string
  onSearchChange: (search: string) => void
}

export default function FilterToolbarSearchInput({
  collapsible = false,
  search,
  onSearchChange,
}: FilterToolbarSearchInputProps) {
  const t = useExtracted()
  const [isOpen, setIsOpen] = useState(!collapsible || Boolean(search.trim()))
  const searchShellRef = useRef<HTMLDivElement | null>(null)
  const shouldRestoreFocusRef = useRef(false)
  const closeSearch = useCallback(() => {
    shouldRestoreFocusRef.current = true
    setIsOpen(false)
  }, [])
  const searchTriggerRef = useCallback((button: HTMLButtonElement | null) => {
    if (button && shouldRestoreFocusRef.current) {
      shouldRestoreFocusRef.current = false
      button.focus()
    }
  }, [])

  useEffect(() => {
    if (!collapsible || !isOpen) {
      return undefined
    }

    function handleClick(event: MouseEvent) {
      const target = event.target
      if (!(target instanceof Node) || searchShellRef.current?.contains(target)) {
        return
      }

      const currentInputValue = searchShellRef.current?.querySelector<HTMLInputElement>(
        '[data-testid="filter-search-input"]',
      )?.value
      const normalizedInputValue =
        currentInputValue === undefined ? search : currentInputValue.trim() ? currentInputValue : ''

      if (normalizedInputValue.trim()) {
        return
      }

      if (normalizedInputValue !== search) {
        onSearchChange(normalizedInputValue)
      }

      closeSearch()
    }

    window.addEventListener('click', handleClick)
    return () => window.removeEventListener('click', handleClick)
  }, [closeSearch, collapsible, isOpen, onSearchChange, search])

  if (collapsible && !isOpen) {
    const openSearchLabel = t('Open search')

    return (
      <Button
        ref={searchTriggerRef}
        type="button"
        variant="ghost"
        size="icon"
        title={openSearchLabel}
        aria-label={openSearchLabel}
        aria-expanded={false}
        data-testid="filter-search-trigger"
        onClick={() => setIsOpen(true)}
      >
        <SearchIcon />
      </Button>
    )
  }

  return (
    <FilterToolbarSearchInputField
      autoFocus={collapsible && !search.trim()}
      shellRef={searchShellRef}
      search={search}
      onSearchChange={onSearchChange}
      onEscape={(currentInputValue, clearInput) => {
        if (!collapsible) {
          if (!currentInputValue.trim() && currentInputValue !== search) {
            onSearchChange('')
          }

          return !currentInputValue.trim()
        }

        if (currentInputValue.trim()) {
          clearInput()
          onSearchChange('')
          return true
        }

        if (currentInputValue !== search) {
          onSearchChange('')
        }

        closeSearch()
        return true
      }}
    />
  )
}

interface FilterToolbarSearchInputFieldProps {
  autoFocus?: boolean
  search: string
  shellRef?: RefObject<HTMLDivElement | null>
  onSearchChange: (search: string) => void
  onEscape?: (currentInputValue: string, clearInput: () => void) => boolean
}

interface SearchDebounceTimeoutRef {
  current: ReturnType<typeof setTimeout> | null
}

function clearPendingSearchDebounce(debounceTimeoutRef: SearchDebounceTimeoutRef) {
  if (debounceTimeoutRef.current) {
    clearTimeout(debounceTimeoutRef.current)
    debounceTimeoutRef.current = null
  }
}

function useFilterToolbarSearchInputFieldState({
  onEscape,
  search,
  onSearchChange,
}: FilterToolbarSearchInputFieldProps) {
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSubmittedSearchRef = useRef(search)
  const t = useExtracted()

  const inputRef = useCallback(
    function syncInputRef(inputElement: HTMLInputElement | null) {
      if (!inputElement) {
        clearPendingSearchDebounce(debounceTimeoutRef)
        return
      }

      if (search === lastSubmittedSearchRef.current) {
        return
      }

      clearPendingSearchDebounce(debounceTimeoutRef)
      inputElement.value = search
      lastSubmittedSearchRef.current = search
    },
    [search],
  )

  const handleInputChange = useCallback(
    function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
      const nextSearch = event.target.value
      lastSubmittedSearchRef.current = nextSearch

      clearPendingSearchDebounce(debounceTimeoutRef)

      debounceTimeoutRef.current = setTimeout(() => {
        debounceTimeoutRef.current = null
        onSearchChange(nextSearch)
      }, 150)
    },
    [onSearchChange],
  )

  const handleEscape = useCallback(
    function handleEscape(event: KeyboardEvent<HTMLInputElement>) {
      const inputElement = event.currentTarget
      const shouldCancelPendingSearch = onEscape?.(inputElement.value, () => {
        inputElement.value = ''
        lastSubmittedSearchRef.current = ''
      })

      if (shouldCancelPendingSearch) {
        clearPendingSearchDebounce(debounceTimeoutRef)
      }
    },
    [onEscape],
  )

  return {
    handleEscape,
    inputRef,
    handleInputChange,
    searchPlaceholder: t('Search'),
  }
}

function FilterToolbarSearchInputField({
  autoFocus = false,
  onEscape,
  shellRef,
  search,
  onSearchChange,
}: FilterToolbarSearchInputFieldProps) {
  const { handleEscape, inputRef, handleInputChange, searchPlaceholder } = useFilterToolbarSearchInputFieldState({
    onEscape,
    search,
    onSearchChange,
  })

  return (
    <div ref={shellRef} className="relative w-full md:w-44 lg:w-52 xl:w-56">
      <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        type="text"
        data-testid="filter-search-input"
        placeholder={searchPlaceholder}
        defaultValue={search}
        autoFocus={autoFocus}
        onChange={handleInputChange}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            handleEscape(event)
          }
        }}
        className={cn(
          `border-transparent bg-secondary pl-10 shadow-none transition-colors hover:bg-secondary focus-visible:border-border focus-visible:bg-background focus-visible:ring-0 focus-visible:ring-offset-0`,
        )}
      />
    </div>
  )
}
