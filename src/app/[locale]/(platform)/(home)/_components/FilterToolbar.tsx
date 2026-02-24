'use client'

import type { LucideIcon } from 'lucide-react'
import type { FilterState } from '@/app/[locale]/(platform)/_providers/FilterProvider'
import { useAppKitAccount } from '@reown/appkit/react'
import { BookmarkIcon, ClockIcon, DropletIcon, FlameIcon, HandFistIcon, Settings2Icon, SparklesIcon, TrendingUpIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useCallback, useEffect, useMemo, useState } from 'react'
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

export default function FilterToolbar({ filters, onFiltersChange }: FilterToolbarProps) {
  const { open } = useAppKit()
  const { isConnected } = useAppKitAccount()
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isNavigationTagsReady, setIsNavigationTagsReady] = useState(false)
  const [filterSettings, setFilterSettings] = useState<FilterSettings>(() => createDefaultFilters({
    frequency: filters.frequency,
    status: filters.status,
    hideSports: filters.hideSports,
    hideCrypto: filters.hideCrypto,
    hideEarnings: filters.hideEarnings,
  }))

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

  useEffect(() => {
    setIsNavigationTagsReady(true)
  }, [])

  useEffect(() => {
    setFilterSettings((prev) => {
      if (
        prev.frequency === filters.frequency
        && prev.status === filters.status
        && prev.hideSports === filters.hideSports
        && prev.hideCrypto === filters.hideCrypto
        && prev.hideEarnings === filters.hideEarnings
      ) {
        return prev
      }

      return {
        ...prev,
        frequency: filters.frequency,
        status: filters.status,
        hideSports: filters.hideSports,
        hideCrypto: filters.hideCrypto,
        hideEarnings: filters.hideEarnings,
      }
    })
  }, [filters.frequency, filters.hideSports, filters.hideCrypto, filters.hideEarnings, filters.status])

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
    setFilterSettings((prev) => {
      const next = { ...prev, ...updates }

      const hideSportsChanged = 'hideSports' in updates && updates.hideSports !== undefined && updates.hideSports !== prev.hideSports
      const hideCryptoChanged = 'hideCrypto' in updates && updates.hideCrypto !== undefined && updates.hideCrypto !== prev.hideCrypto
      const hideEarningsChanged = 'hideEarnings' in updates && updates.hideEarnings !== undefined && updates.hideEarnings !== prev.hideEarnings

      if (hideSportsChanged || hideCryptoChanged || hideEarningsChanged) {
        const filterUpdates: Partial<FilterState> = {}
        if (hideSportsChanged) {
          filterUpdates.hideSports = updates.hideSports
        }
        if (hideCryptoChanged) {
          filterUpdates.hideCrypto = updates.hideCrypto
        }
        if (hideEarningsChanged) {
          filterUpdates.hideEarnings = updates.hideEarnings
        }
        onFiltersChange(filterUpdates)
      }
      if ('frequency' in updates && updates.frequency !== undefined && updates.frequency !== prev.frequency) {
        onFiltersChange({ frequency: updates.frequency })
      }
      if ('status' in updates && updates.status && updates.status !== prev.status) {
        onFiltersChange({ status: updates.status })
      }

      return next
    })
  }, [onFiltersChange])

  const handleClearFilters = useCallback(() => {
    const defaultFilters = createDefaultFilters()
    setFilterSettings(defaultFilters)

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

  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      <div className="flex w-full min-w-0 flex-col gap-3 md:flex-row md:items-center md:gap-4">
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
          />
        )}

        <Separator orientation="vertical" className="order-4 hidden shrink-0 md:order-2 md:flex" />

        <div
          id="navigation-tags"
          data-teleport-ready={isNavigationTagsReady ? 'true' : 'false'}
          className="order-3 max-w-full min-w-0 flex-1 overflow-hidden md:order-1 md:flex md:items-center"
        />
      </div>

      {isSettingsOpen && (
        <FilterSettingsRow
          className="hidden md:flex"
          filters={filterSettings}
          onChange={handleFilterChange}
          onClear={handleClearFilters}
          hasActiveFilters={hasActiveFilters}
        />
      )}
    </div>
  )
}

function BookmarkToggle({ isBookmarked, isConnected, onToggle, onConnect }: BookmarkToggleProps) {
  const t = useExtracted()

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      title={isBookmarked ? t('Show all items') : t('Show only bookmarked items')}
      aria-label={isBookmarked ? t('Remove bookmark filter') : t('Filter by bookmarks')}
      aria-pressed={isBookmarked}
      onClick={isConnected ? onToggle : onConnect}
    >
      <BookmarkIcon className={cn(`size-6 md:size-5`, { 'fill-primary text-primary': isBookmarked })} />
    </Button>
  )
}

function SettingsToggle({ isActive, isOpen, onToggle }: SettingsToggleProps) {
  const t = useExtracted()

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        { 'bg-accent': isOpen || isActive },
      )}
      title={t('Open filters')}
      aria-label={t('Open filters')}
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
}

function FilterSettingsRow({ filters, onChange, onClear, hasActiveFilters, className }: FilterSettingsRowProps) {
  const t = useExtracted()

  const SORT_OPTIONS: ReadonlyArray<{ value: SortOption, label: string, icon: LucideIcon }> = useMemo(() => [
    { value: '24h-volume', label: t('24h Volume'), icon: TrendingUpIcon },
    { value: 'total-volume', label: t('Total Volume'), icon: FlameIcon },
    { value: 'liquidity', label: t('Liquidity'), icon: DropletIcon },
    { value: 'newest', label: t('Newest'), icon: SparklesIcon },
    { value: 'ending-soon', label: t('Ending Soon'), icon: ClockIcon },
    { value: 'competitive', label: t('Competitive'), icon: HandFistIcon },
  ], [t])

  const FREQUENCY_OPTIONS: ReadonlyArray<{ value: FrequencyOption, label: string }> = useMemo(() => [
    { value: 'all', label: t('All') },
    { value: 'daily', label: t('Daily') },
    { value: 'weekly', label: t('Weekly') },
    { value: 'monthly', label: t('Monthly') },
  ], [t])

  const STATUS_OPTIONS: ReadonlyArray<{ value: StatusOption, label: string }> = useMemo(() => [
    { value: 'active', label: t('Active') },
    { value: 'resolved', label: t('Resolved') },
  ], [t])

  const FILTER_CHECKBOXES: ReadonlyArray<{ key: FilterCheckboxKey, label: string }> = useMemo(() => [
    { key: 'hideSports', label: t('Hide sports?') },
    { key: 'hideCrypto', label: t('Hide crypto?') },
    { key: 'hideEarnings', label: t('Hide earnings?') },
  ], [t])

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
        label={t('Sort by:')}
        value={filters.sortBy}
        options={SORT_OPTIONS}
        showActiveIcon
        triggerClassName="min-w-[9.5rem]"
        onChange={value => onChange({ sortBy: value as SortOption })}
      />

      <FilterSettingsSelect
        label={t('Frequency:')}
        value={filters.frequency}
        options={FREQUENCY_OPTIONS}
        triggerClassName="min-w-[7rem]"
        onChange={value => onChange({ frequency: value as FrequencyOption })}
      />

      <FilterSettingsSelect
        label={t('Status:')}
        value={filters.status}
        options={STATUS_OPTIONS}
        triggerClassName="min-w-[8rem]"
        onChange={value => onChange({ status: value as StatusOption })}
      />

      {FILTER_CHECKBOXES.map(({ key, label }) => (
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
          {t('Clear filters')}
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
