'use client'

import type { LeaderboardFilters } from '@/app/[locale]/(platform)/leaderboard/_utils/leaderboardFilters'
import { SearchIcon } from 'lucide-react'
import { LIST_ROW_COLUMNS } from '@/app/[locale]/(platform)/leaderboard/_utils/leaderboardApi'
import {
  CATEGORY_OPTIONS,
  ORDER_OPTIONS,
  PERIOD_OPTIONS,
} from '@/app/[locale]/(platform)/leaderboard/_utils/leaderboardFilters'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface LeaderboardFiltersBarProps {
  filters: LeaderboardFilters
  categoryLabel: string
  searchInput: string
  onSearchInputChange: (value: string) => void
  onUpdateFilters: (next: LeaderboardFilters) => void
}

function headerButtonClass(isActive: boolean) {
  return cn(
    'flex h-full items-center justify-end text-right text-sm font-medium transition-colors',
    isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
  )
}

function headerButtonTextClass(isActive: boolean) {
  return cn(
    'relative inline-flex w-fit items-center',
    isActive
    && 'after:absolute after:inset-x-0 after:-bottom-[calc(0.875rem-1px)] after:h-px after:bg-foreground',
  )
}

export default function LeaderboardFiltersBar({
  filters,
  categoryLabel,
  searchInput,
  onSearchInputChange,
  onUpdateFilters,
}: LeaderboardFiltersBarProps) {
  const selectedPeriod = filters.period

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="inline-flex flex-wrap overflow-hidden rounded-lg border border-border">
          {PERIOD_OPTIONS.map((option, index) => {
            const isActive = option.value === selectedPeriod
            const isFirst = index === 0
            const isLast = index === PERIOD_OPTIONS.length - 1

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onUpdateFilters({ ...filters, period: option.value })}
                className={cn(
                  'h-10 px-4 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-muted text-foreground'
                    : 'bg-background text-muted-foreground hover:bg-muted/40',
                  { 'border-r border-border': !isLast },
                  { 'rounded-l-lg': isFirst },
                  { 'rounded-r-lg': isLast },
                )}
              >
                {option.label}
              </button>
            )
          })}
        </div>

        <Select
          value={filters.category}
          onValueChange={value => onUpdateFilters({ ...filters, category: value as LeaderboardFilters['category'] })}
        >
          <SelectTrigger className={cn(`
            h-10 min-w-40 bg-transparent px-4 text-sm font-medium text-foreground
            hover:bg-transparent
            data-[size=default]:h-10
            dark:bg-transparent
            dark:hover:bg-transparent
          `)}
          >
            <SelectValue className="line-clamp-1">{categoryLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent position="popper" align="end">
            {CATEGORY_OPTIONS.map(option => (
              <SelectItem key={option.value} value={option.value} className="py-3 text-sm">
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="border-t border-border/80" />
      <div
        className={cn(
          `
            relative grid items-center gap-4 px-3 pt-3 pb-3.5 text-sm text-muted-foreground
            after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-border/80 after:content-['']
          `,
          LIST_ROW_COLUMNS,
        )}
      >
        <div className="relative w-full">
          <SearchIcon className={cn(`
            pointer-events-none absolute top-1/2 left-0 size-4 -translate-y-1/2 text-muted-foreground
          `)}
          />
          <input
            type="text"
            value={searchInput}
            onChange={event => onSearchInputChange(event.target.value)}
            placeholder="Search by name"
            aria-label="Search by name"
            className={cn(`
              h-7 w-full bg-transparent pr-2 pl-6 text-sm text-foreground
              placeholder:text-muted-foreground
              focus:ring-0 focus:outline-none
            `)}
          />
        </div>
        <div className="flex items-center justify-end md:hidden">
          <Select
            value={filters.order}
            onValueChange={value => onUpdateFilters({ ...filters, order: value as LeaderboardFilters['order'] })}
          >
            <SelectTrigger
              className={cn(`
                h-7 border-0 bg-transparent px-0 text-sm font-medium text-muted-foreground shadow-none
                hover:bg-transparent
                data-[size=default]:h-7
                dark:bg-transparent
                dark:hover:bg-transparent
              `)}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="end">
              {ORDER_OPTIONS.map(option => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                  className="py-3 text-sm data-highlighted:bg-muted data-highlighted:text-foreground"
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2 hidden items-center justify-end gap-3 md:flex">
          <button
            type="button"
            onClick={() => onUpdateFilters({ ...filters, order: 'profit' })}
            className={cn('flex-1', headerButtonClass(filters.order === 'profit'))}
          >
            <span className={headerButtonTextClass(filters.order === 'profit')}>
              {ORDER_OPTIONS[0].label}
            </span>
          </button>
          <span className="text-muted-foreground">|</span>
          <button
            type="button"
            onClick={() => onUpdateFilters({ ...filters, order: 'volume' })}
            className={cn('flex-1', headerButtonClass(filters.order === 'volume'))}
          >
            <span className={headerButtonTextClass(filters.order === 'volume')}>
              {ORDER_OPTIONS[1].label}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
