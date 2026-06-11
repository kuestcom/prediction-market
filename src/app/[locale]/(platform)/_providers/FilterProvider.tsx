'use client'

import type { ReactNode } from 'react'
import type { EventListSortBy } from '@/lib/event-list-filters'
import { createContext, use, useCallback, useMemo, useState } from 'react'

export interface FilterState {
  search: string
  tag: string
  mainTag: string
  bookmarked: boolean
  frequency: 'all' | 'daily' | 'weekly' | 'monthly'
  sortBy: EventListSortBy
  status: 'active' | 'resolved'
  hideSports: boolean
  hideCrypto: boolean
  hideEarnings: boolean
}

interface FilterContextType {
  filters: FilterState
  updateFilters: (updates: Partial<FilterState>) => void
}

const FilterContext = createContext<FilterContextType | null>(null)

interface FilterProviderProps {
  children: ReactNode
  initialTag?: string
}

export const DEFAULT_FILTERS: FilterState = {
  search: '',
  tag: 'trending',
  mainTag: 'trending',
  bookmarked: false,
  frequency: 'all',
  sortBy: 'volume_24h',
  status: 'active',
  hideSports: false,
  hideCrypto: false,
  hideEarnings: false,
}

function useFilterContextValue(initialTag: string | undefined): FilterContextType {
  const [filters, setFilters] = useState<FilterState>({
    ...DEFAULT_FILTERS,
    ...(initialTag && { tag: initialTag, mainTag: initialTag }),
  })

  const updateFilters = useCallback((updates: Partial<FilterState>) => {
    setFilters(prev => ({ ...prev, ...updates }))
  }, [])

  return useMemo(() => ({ filters, updateFilters }), [filters, updateFilters])
}

export function FilterProvider({ children, initialTag }: FilterProviderProps) {
  const filterContextValue = useFilterContextValue(initialTag)

  return (
    <FilterContext value={filterContextValue}>
      {children}
    </FilterContext>
  )
}

export function useFilters() {
  const context = use(FilterContext)
  if (!context) {
    return {
      filters: DEFAULT_FILTERS,
      updateFilters: () => {},
    }
  }
  return context
}
