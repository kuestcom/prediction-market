'use client'

import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import type { FilterState } from '@/app/[locale]/(platform)/_providers/FilterProvider'
import { useAppKitAccount } from '@reown/appkit/react'
import { BookmarkIcon, ClockIcon, DropletIcon, FlameIcon, HandFistIcon, Settings2Icon, SparkleIcon, TrendingUpIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useCallback, useMemo, useState } from 'react'
import FilterToolbarSearchInput from '@/app/[locale]/(platform)/(home)/_components/FilterToolbarSearchInput'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useAppKit } from '@/hooks/useAppKit'
import { cn } from '@/lib/utils'

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

type SortOption = '24h-volume' | 'total-volume' | 'liquidity' | 'newest' | 'ending-soon' | 'competitive'
type FrequencyOption = FilterState['frequency']
type StatusOption = FilterState['status']

type FilterCheckboxKey = 'hideSports' | 'hideCrypto' | 'hideEarnings'

interface FilterSettings {
  sortBy: SortOption
  frequency: FrequencyOption
  status: StatusOption
  hideSports: boolean
  hideCrypto: boolean
  hideEarnings: boolean
}

const BASE_FILTER_SETTINGS = {
  sortBy: '24h-volume',
  frequency: 'all',
  status: 'active',
  hideSports: false,
  hideCrypto: false,
  hideEarnings: false,
} as const satisfies FilterSettings

function createDefaultFilters(overrides: Partial<FilterSettings> = {}): FilterSettings {
  return {
    ...BASE_FILTER_SETTINGS,
    ...overrides,
  }
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
  const [sortBy, setSortBy] = useState<SortOption>(BASE_FILTER_SETTINGS.sortBy)

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
    queueMicrotask(() => open())
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

interface FilterSettingsRowProps {
  filters: FilterSettings
  onChange: (updates: Partial<FilterSettings>) => void
  onClear: () => void
  hasActiveFilters: boolean
  className?: string
  showFilterCheckboxes?: boolean
}

function useFilterSettingsRowOptions() {
  const t = useExtracted()

  const sortOptions: ReadonlyArray<{ value: SortOption, label: string, icon: LucideIcon }> = useMemo(() => [
    { value: '24h-volume', label: t('24h Volume'), icon: TrendingUpIcon },
    { value: 'total-volume', label: t('Total Volume'), icon: FlameIcon },
    { value: 'liquidity', label: t('Liquidity'), icon: DropletIcon },
    { value: 'newest', label: t('Newest'), icon: SparkleIcon },
    { value: 'ending-soon', label: t('Ending Soon'), icon: ClockIcon },
    { value: 'competitive', label: t('Competitive'), icon: HandFistIcon },
  ], [t])

  const frequencyOptions: ReadonlyArray<{ value: FrequencyOption, label: string }> = useMemo(() => [
    { value: 'all', label: t('All') },
    { value: 'daily', label: t('Daily') },
    { value: 'weekly', label: t('Weekly') },
    { value: 'monthly', label: t('Monthly') },
  ], [t])

  const statusOptions: ReadonlyArray<{ value: StatusOption, label: string }> = useMemo(() => [
    { value: 'active', label: t('Active') },
    { value: 'resolved', label: t('Resolved') },
  ], [t])

  const filterCheckboxes: ReadonlyArray<{ key: FilterCheckboxKey, label: string }> = useMemo(() => [
    { key: 'hideSports', label: t('Hide sports?') },
    { key: 'hideCrypto', label: t('Hide crypto?') },
    { key: 'hideEarnings', label: t('Hide earnings?') },
  ], [t])

  return {
    clearFiltersLabel: t('Clear filters'),
    filterCheckboxes,
    frequencyLabel: t('Frequency:'),
    frequencyOptions,
    sortByLabel: t('Sort by:'),
    sortOptions,
    statusLabel: t('Status:'),
    statusOptions,
  }
}

function FilterSettingsRow({
  filters,
  onChange,
  onClear,
  hasActiveFilters,
  className,
  showFilterCheckboxes = true,
}: FilterSettingsRowProps) {
  const {
    clearFiltersLabel,
    filterCheckboxes,
    frequencyLabel,
    frequencyOptions,
    sortByLabel,
    sortOptions,
    statusLabel,
    statusOptions,
  } = useFilterSettingsRowOptions()

  return (
    <div
      className={cn(
        `
          flex w-full max-w-full min-w-0 flex-nowrap items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none]
          [&::-webkit-scrollbar]:hidden
        `,
        className,
      )}
    >
      <FilterSettingsSelect
        label={sortByLabel}
        value={filters.sortBy}
        options={sortOptions}
        showActiveIcon
        triggerClassName="min-w-[9.5rem]"
        onChange={value => onChange({ sortBy: value as SortOption })}
      />

      <FilterSettingsSelect
        label={frequencyLabel}
        value={filters.frequency}
        options={frequencyOptions}
        triggerClassName="min-w-[7rem]"
        onChange={value => onChange({ frequency: value as FrequencyOption })}
      />

      <FilterSettingsSelect
        label={statusLabel}
        value={filters.status}
        options={statusOptions}
        triggerClassName="min-w-[8rem]"
        onChange={value => onChange({ status: value as StatusOption })}
      />

      {showFilterCheckboxes && filterCheckboxes.map(({ key, label }) => (
        <Label
          key={key}
          htmlFor={`filter-${key}`}
          className={cn('flex shrink-0 items-center gap-2 text-xs font-medium text-foreground')}
        >
          <Checkbox
            id={`filter-${key}`}
            checked={filters[key]}
            onCheckedChange={checked => onChange({
              [key]: Boolean(checked),
            } as Partial<FilterSettings>)}
          />
          <span className="whitespace-nowrap">{label}</span>
        </Label>
      ))}

      {hasActiveFilters && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClear}
        >
          {clearFiltersLabel}
        </Button>
      )}
    </div>
  )
}

interface FilterSettingsSelectOption {
  value: string
  label: string
  icon?: LucideIcon
}

interface FilterSettingsSelectProps {
  label: string
  value: string
  options: ReadonlyArray<FilterSettingsSelectOption>
  showActiveIcon?: boolean
  triggerClassName?: string
  onChange: (value: string) => void
}

function FilterSettingsSelect({
  label,
  value,
  options,
  showActiveIcon = false,
  triggerClassName,
  onChange,
}: FilterSettingsSelectProps) {
  const activeOption = options.find(option => option.value === value)
  const ActiveIcon = showActiveIcon ? activeOption?.icon : undefined

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        aria-label={label}
        size="sm"
        className={cn(
          `
            h-12 shrink-0 cursor-pointer gap-3 rounded-full border border-border/80 bg-background px-4 text-sm
            font-semibold text-foreground shadow-none transition-colors
            hover:bg-muted/25
            focus-visible:ring-0 focus-visible:ring-offset-0
            data-[state=open]:bg-muted/25
            [&>svg]:size-4 [&>svg]:text-foreground/80
          `,
          triggerClassName,
        )}
      >
        <span className="flex min-w-0 items-center gap-2.5 truncate">
          {ActiveIcon && <ActiveIcon className="size-4 shrink-0 text-foreground" />}
          <span className="truncate">{activeOption?.label ?? ''}</span>
        </span>
      </SelectTrigger>
      <SelectContent
        align="start"
        position="popper"
        side="bottom"
        sideOffset={8}
        className="p-1"
      >
        {options.map((option) => {
          const OptionIcon = option.icon

          return (
            <SelectItem
              key={option.value}
              value={option.value}
              className="my-0.5 cursor-pointer rounded-lg py-2 pl-2.5 text-sm font-medium"
            >
              <span className="flex items-center gap-2">
                {OptionIcon && <OptionIcon className="size-4 text-muted-foreground" />}
                <span>{option.label}</span>
              </span>
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}
