'use client'

import type { ReactNode } from 'react'
import type { FilterSettings, FilterSettingsRowProps } from '@/app/[locale]/(platform)/(home)/_components/filter-toolbar-settings'
import type { FilterState } from '@/app/[locale]/(platform)/_providers/FilterProvider'
import { useAppKitAccount } from '@reown/appkit/react'
import { BookmarkIcon, Settings2Icon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import dynamic from 'next/dynamic'
import { useCallback, useMemo, useState } from 'react'
import { BASE_FILTER_SETTINGS, createDefaultFilters } from '@/app/[locale]/(platform)/(home)/_components/filter-toolbar-settings'
import FilterToolbarSearchInput from '@/app/[locale]/(platform)/(home)/_components/FilterToolbarSearchInput'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useAppKit } from '@/hooks/useAppKit'
import { cn } from '@/lib/utils'

const FilterSettingsRow = dynamic<FilterSettingsRowProps>(
  () => import('@/app/[locale]/(platform)/(home)/_components/FilterSettingsRow'),
)

interface FilterToolbarProps {
  filters: FilterState
  onFiltersChange: (filters: Partial<FilterState>) => void
  hideDesktopSecondaryNavigation?: boolean
  desktopTitle?: string
  secondaryNavigation?: ReactNode
  showFilterCheckboxes?: boolean
}

interface BookmarkToggleProps {
  isBookmarked: boolean
  isConnected: boolean
  onToggle: () => void
  onConnect: () => void
}

interface SettingsToggleProps {
  isActive: boolean
  isOpen: boolean
  onToggle: () => void
}

function useFilterToolbarState({
  filters,
  onFiltersChange,
}: {
  filters: FilterState
  onFiltersChange: (filters: Partial<FilterState>) => void
}) {
  const { open } = useAppKit()
  const { isConnected } = useAppKitAccount()
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [sortBy, setSortBy] = useState<FilterSettings['sortBy']>(BASE_FILTER_SETTINGS.sortBy)

  const filterSettings = useMemo(() => createDefaultFilters({
    sortBy,
    frequency: filters.frequency,
    status: filters.status,
    hideSports: filters.hideSports,
    hideCrypto: filters.hideCrypto,
    hideEarnings: filters.hideEarnings,
  }), [sortBy, filters.frequency, filters.status, filters.hideSports, filters.hideCrypto, filters.hideEarnings])

  const hasActiveFilters = useMemo(() => (
    filterSettings.sortBy !== BASE_FILTER_SETTINGS.sortBy
    || filterSettings.frequency !== BASE_FILTER_SETTINGS.frequency
    || filterSettings.status !== BASE_FILTER_SETTINGS.status
    || filterSettings.hideSports !== BASE_FILTER_SETTINGS.hideSports
    || filterSettings.hideCrypto !== BASE_FILTER_SETTINGS.hideCrypto
    || filterSettings.hideEarnings !== BASE_FILTER_SETTINGS.hideEarnings
    || filters.bookmarked
  ), [filterSettings, filters.bookmarked])

  const hasActiveSettingsFilters = useMemo(() => (
    filterSettings.sortBy !== BASE_FILTER_SETTINGS.sortBy
    || filterSettings.frequency !== BASE_FILTER_SETTINGS.frequency
    || filterSettings.status !== BASE_FILTER_SETTINGS.status
    || filterSettings.hideSports !== BASE_FILTER_SETTINGS.hideSports
    || filterSettings.hideCrypto !== BASE_FILTER_SETTINGS.hideCrypto
    || filterSettings.hideEarnings !== BASE_FILTER_SETTINGS.hideEarnings
  ), [filterSettings])

  const handleBookmarkToggle = useCallback(() => {
    onFiltersChange({ bookmarked: !filters.bookmarked })
  }, [filters.bookmarked, onFiltersChange])

  const handleConnect = useCallback(() => {
    void open()
  }, [open])

  const handleSettingsToggle = useCallback(() => {
    setIsSettingsOpen(prev => !prev)
  }, [])

  const handleFilterChange = useCallback((updates: Partial<FilterSettings>) => {
    if ('sortBy' in updates && updates.sortBy && updates.sortBy !== sortBy) {
      setSortBy(updates.sortBy)
    }

    const filterUpdates: Partial<FilterState> = {}

    if ('hideSports' in updates && updates.hideSports !== undefined && updates.hideSports !== filters.hideSports) {
      filterUpdates.hideSports = updates.hideSports
    }
    if ('hideCrypto' in updates && updates.hideCrypto !== undefined && updates.hideCrypto !== filters.hideCrypto) {
      filterUpdates.hideCrypto = updates.hideCrypto
    }
    if ('hideEarnings' in updates && updates.hideEarnings !== undefined && updates.hideEarnings !== filters.hideEarnings) {
      filterUpdates.hideEarnings = updates.hideEarnings
    }
    if ('frequency' in updates && updates.frequency !== undefined && updates.frequency !== filters.frequency) {
      filterUpdates.frequency = updates.frequency
    }
    if ('status' in updates && updates.status && updates.status !== filters.status) {
      filterUpdates.status = updates.status
    }

    if (Object.keys(filterUpdates).length > 0) {
      onFiltersChange(filterUpdates)
    }
  }, [filters.frequency, filters.hideSports, filters.hideCrypto, filters.hideEarnings, filters.status, onFiltersChange, sortBy])

  const handleClearFilters = useCallback(() => {
    const defaultFilters = createDefaultFilters()
    setSortBy(defaultFilters.sortBy)

    onFiltersChange({
      search: '',
      bookmarked: false,
      frequency: defaultFilters.frequency,
      status: defaultFilters.status,
      hideSports: defaultFilters.hideSports,
      hideCrypto: defaultFilters.hideCrypto,
      hideEarnings: defaultFilters.hideEarnings,
    })
  }, [onFiltersChange])

  const handleSearchChange = useCallback((search: string) => {
    onFiltersChange({ search })
  }, [onFiltersChange])

  return {
    filterSettings,
    handleBookmarkToggle,
    handleClearFilters,
    handleConnect,
    handleFilterChange,
    handleSearchChange,
    handleSettingsToggle,
    hasActiveFilters,
    hasActiveSettingsFilters,
    isConnected,
    isSettingsOpen,
  }
}

export default function FilterToolbar({
  filters,
  onFiltersChange,
  hideDesktopSecondaryNavigation = false,
  desktopTitle,
  secondaryNavigation,
  showFilterCheckboxes = true,
}: FilterToolbarProps) {
  const {
    filterSettings,
    handleBookmarkToggle,
    handleClearFilters,
    handleConnect,
    handleFilterChange,
    handleSearchChange,
    handleSettingsToggle,
    hasActiveFilters,
    hasActiveSettingsFilters,
    isConnected,
    isSettingsOpen,
  } = useFilterToolbarState({
    filters,
    onFiltersChange,
  })

  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      <div className="flex w-full min-w-0 flex-col gap-3 md:flex-row md:items-center md:gap-4">
        {desktopTitle && (
          <h1 className="order-0 hidden text-xl font-semibold tracking-tight text-foreground lg:block">
            {desktopTitle}
          </h1>
        )}

        <div className="order-1 flex w-full min-w-0 items-center gap-3 md:order-3 md:ml-auto md:w-auto md:min-w-0">
          <div className="min-w-0 flex-1">
            <FilterToolbarSearchInput
              search={filters.search}
              onSearchChange={handleSearchChange}
            />
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <SettingsToggle
              isActive={isSettingsOpen || hasActiveSettingsFilters}
              isOpen={isSettingsOpen}
              onToggle={handleSettingsToggle}
            />

            <BookmarkToggle
              isBookmarked={filters.bookmarked}
              isConnected={isConnected}
              onToggle={handleBookmarkToggle}
              onConnect={handleConnect}
            />
          </div>
        </div>

        {isSettingsOpen && (
          <FilterSettingsRow
            className="order-2 flex w-full items-center overflow-x-auto px-1 md:hidden"
            filters={filterSettings}
            onChange={handleFilterChange}
            onClear={handleClearFilters}
            hasActiveFilters={hasActiveFilters}
            idPrefix="filter-mobile"
            showFilterCheckboxes={showFilterCheckboxes}
          />
        )}

        {secondaryNavigation && (
          <>
            <Separator
              orientation="vertical"
              className={cn('order-4 hidden shrink-0 md:order-2 md:flex', hideDesktopSecondaryNavigation && 'lg:hidden')}
            />

            <div
              className={cn(
                'order-3 max-w-full min-w-0 flex-1 overflow-hidden md:order-1 md:flex md:items-center',
                hideDesktopSecondaryNavigation && 'lg:hidden',
              )}
            >
              {secondaryNavigation}
            </div>
          </>
        )}
      </div>

      {isSettingsOpen && (
        <FilterSettingsRow
          className="hidden md:flex"
          filters={filterSettings}
          onChange={handleFilterChange}
          onClear={handleClearFilters}
          hasActiveFilters={hasActiveFilters}
          idPrefix="filter-desktop"
          showFilterCheckboxes={showFilterCheckboxes}
        />
      )}
    </div>
  )
}

function useBookmarkToggleLabels(isBookmarked: boolean) {
  const t = useExtracted()

  return {
    ariaLabel: isBookmarked ? t('Remove bookmark filter') : t('Filter by bookmarks'),
    title: isBookmarked ? t('Show all items') : t('Show only bookmarked items'),
  }
}

function BookmarkToggle({ isBookmarked, isConnected, onToggle, onConnect }: BookmarkToggleProps) {
  const { ariaLabel, title } = useBookmarkToggleLabels(isBookmarked)

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      title={title}
      aria-label={ariaLabel}
      aria-pressed={isBookmarked}
      onClick={isConnected ? onToggle : onConnect}
    >
      <BookmarkIcon className={cn(`size-6 md:size-5`, { 'fill-primary text-primary': isBookmarked })} />
    </Button>
  )
}

function useSettingsToggleLabel() {
  const t = useExtracted()
  return t('Open filters')
}

function SettingsToggle({ isActive, isOpen, onToggle }: SettingsToggleProps) {
  const openFiltersLabel = useSettingsToggleLabel()

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        { 'bg-accent': isOpen || isActive },
      )}
      title={openFiltersLabel}
      aria-label={openFiltersLabel}
      aria-pressed={isActive}
      aria-expanded={isOpen}
      onClick={onToggle}
    >
      <Settings2Icon className="size-6 md:size-5" />
    </Button>
  )
}
