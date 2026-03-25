'use client'

import type { PredictionResultsSortOption, PredictionResultsStatusOption } from '@/lib/prediction-results-filters'
import { ClockIcon, FlameIcon, HandFistIcon, SearchIcon, Settings2Icon, TrendingUpIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface PredictionResultsFiltersProps {
  className?: string
  searchValue: string
  sort: PredictionResultsSortOption
  status: PredictionResultsStatusOption
  onSearchValueChange: (value: string) => void
  onSortChange: (value: PredictionResultsSortOption) => void
  onStatusChange: (value: PredictionResultsStatusOption) => void
}

const SORT_ICONS = {
  'trending': TrendingUpIcon,
  'volume': FlameIcon,
  'ending-soon': ClockIcon,
  'competitive': HandFistIcon,
  'newest': TrendingUpIcon,
} as const

export default function PredictionResultsFilters({
  className,
  searchValue,
  sort,
  status,
  onSearchValueChange,
  onSortChange,
  onStatusChange,
}: PredictionResultsFiltersProps) {
  const t = useExtracted()
  const sortOptions: Array<{ value: PredictionResultsSortOption, label: string }> = [
    { value: 'trending', label: t('Trending') },
    { value: 'volume', label: t('Volume') },
    { value: 'newest', label: t('Newest') },
    { value: 'ending-soon', label: t('Ending Soon') },
    { value: 'competitive', label: t('Competitive') },
  ]
  const ActiveSortIcon = SORT_ICONS[sort] ?? Settings2Icon

  return (
    <div className={cn('flex flex-col gap-5', className)}>
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
          {t('Search')}
        </p>
        <div className="relative">
          <SearchIcon className="
            pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground
          "
          />
          <Input
            type="text"
            value={searchValue}
            onChange={event => onSearchValueChange(event.target.value)}
            placeholder={t('Search predictions')}
            data-testid="prediction-search-input"
            className="h-11 rounded-xl border-border/70 bg-background pl-10 shadow-none"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
          {t('Sort by')}
        </p>
        <Select value={sort} onValueChange={value => onSortChange(value as PredictionResultsSortOption)}>
          <SelectTrigger
            data-testid="prediction-sort-select"
            className="h-11 w-full rounded-xl border-border/70 bg-background px-3 shadow-none"
          >
            <SelectValue>
              <span className="flex items-center gap-2">
                <ActiveSortIcon className="size-4 text-muted-foreground" />
                <span>{sortOptions.find(option => option.value === sort)?.label ?? t('Trending')}</span>
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent align="start" position="popper" sideOffset={8}>
            {sortOptions.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
          {t('Event status')}
        </p>
        <div className="flex flex-wrap gap-2">
          {([
            { value: 'active', label: t('Active') },
            { value: 'resolved', label: t('Resolved') },
          ] as const).map(option => (
            <button
              key={option.value}
              type="button"
              data-testid={`prediction-status-${option.value}`}
              onClick={() => onStatusChange(option.value)}
              className={cn(
                `
                  inline-flex h-9 items-center rounded-full border px-3 text-sm font-medium transition-colors
                  focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50
                  focus-visible:outline-none
                `,
                status === option.value
                  ? 'border-transparent bg-foreground text-background'
                  : 'border-border/70 bg-background text-foreground hover:bg-accent',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
