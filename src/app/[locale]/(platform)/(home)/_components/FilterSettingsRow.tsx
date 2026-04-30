'use client'

import type { LucideIcon } from 'lucide-react'
import type {
  FilterCheckboxKey,
  FilterSettings,
  FilterSettingsRowProps,
  FrequencyOption,
  SortOption,
  StatusOption,
} from '@/app/[locale]/(platform)/(home)/_components/filter-toolbar-settings'
import { ClockIcon, DropletIcon, FlameIcon, HandFistIcon, SparkleIcon, TrendingUpIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

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

export default function FilterSettingsRow({
  filters,
  onChange,
  onClear,
  hasActiveFilters,
  className,
  idPrefix = 'filter',
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

      {showFilterCheckboxes && filterCheckboxes.map(({ key, label }) => {
        const checkboxId = `${idPrefix}-${key}`

        return (
          <Label
            key={key}
            htmlFor={checkboxId}
            className={cn('flex shrink-0 items-center gap-2 text-xs font-medium text-foreground')}
          >
            <Checkbox
              id={checkboxId}
              checked={filters[key]}
              onCheckedChange={checked => onChange({
                [key]: Boolean(checked),
              } as Partial<FilterSettings>)}
            />
            <span className="whitespace-nowrap">{label}</span>
          </Label>
        )
      })}

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
