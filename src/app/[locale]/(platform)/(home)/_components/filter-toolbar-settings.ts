import type { FilterState } from '@/app/[locale]/(platform)/_providers/FilterProvider'

export type SortOption = '24h-volume' | 'total-volume' | 'liquidity' | 'newest' | 'ending-soon' | 'competitive'
export type FrequencyOption = FilterState['frequency']
export type StatusOption = FilterState['status']
export type FilterCheckboxKey = 'hideSports' | 'hideCrypto' | 'hideEarnings'

export interface FilterSettings {
  sortBy: SortOption
  frequency: FrequencyOption
  status: StatusOption
  hideSports: boolean
  hideCrypto: boolean
  hideEarnings: boolean
}

export interface FilterSettingsRowProps {
  filters: FilterSettings
  onChange: (updates: Partial<FilterSettings>) => void
  onClear: () => void
  hasActiveFilters: boolean
  className?: string
  idPrefix?: string
  showFilterCheckboxes?: boolean
}

export const BASE_FILTER_SETTINGS = {
  sortBy: '24h-volume',
  frequency: 'all',
  status: 'active',
  hideSports: false,
  hideCrypto: false,
  hideEarnings: false,
} as const satisfies FilterSettings

export function createDefaultFilters(overrides: Partial<FilterSettings> = {}): FilterSettings {
  return {
    ...BASE_FILTER_SETTINGS,
    ...overrides,
  }
}
