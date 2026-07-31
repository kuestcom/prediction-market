'use client'

import type { LucideIcon } from 'lucide-react'

import { Clock3Icon, FlameIcon, SearchIcon, SparkleIcon, TrendingUpIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'

import type { PredictionResultsSortOption, PredictionResultsStatusOption } from '@/lib/prediction-results-filters'

import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
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
  const sortOptions: Array<{
    value: PredictionResultsSortOption
    icon: LucideIcon
    label: string
  }> = [
    { value: 'trending', icon: TrendingUpIcon, label: t('Trending') },
    { value: 'volume', icon: FlameIcon, label: t('Volume') },
    { value: 'newest', icon: SparkleIcon, label: t('Newest') },
    { value: 'ending-soon', icon: Clock3Icon, label: t('Ending Soon') },
  ]
  const statusOptions: Array<{
    value: PredictionResultsStatusOption
    label: string
  }> = [
    { value: 'active', label: t('Active') },
    { value: 'resolved', label: t('Resolved') },
    { value: 'all', label: t('All') },
  ]

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="relative">
        <SearchIcon
          className={cn(`pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground`)}
        />
        <Input
          type="text"
          value={searchValue}
          onChange={(event) => onSearchValueChange(event.target.value)}
          placeholder={t('Search predictions')}
          data-testid="prediction-search-input"
          className={cn(
            `h-12 rounded-none border-0 bg-transparent px-10 shadow-none focus-visible:ring-2 focus-visible:ring-ring/30`,
          )}
        />
      </div>

      <div className="border-t border-border/70" />

      <div className="flex flex-col gap-2 p-3">
        <p className="text-[13px] font-medium tracking-[-0.09px] text-muted-foreground">{t('Sort by')}</p>
        <ToggleGroup
          data-testid="prediction-sort-select"
          aria-label={t('Sort by')}
          value={[sort]}
          onValueChange={(values) => {
            const nextSort = values[0] as PredictionResultsSortOption | undefined
            if (nextSort) {
              onSortChange(nextSort)
            }
          }}
          spacing={2}
          className="flex flex-wrap justify-start"
        >
          {sortOptions.map((option) => {
            const Icon = option.icon
            const isActive = option.value === sort

            return (
              <ToggleGroupItem
                key={option.value}
                value={option.value}
                className={cn(
                  `inline-flex h-8 items-center gap-2 rounded-md px-3 text-[13px] font-medium tracking-[-0.09px] transition-colors focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none`,
                  'data-pressed:bg-muted data-pressed:text-foreground',
                  isActive ? 'bg-muted text-foreground' : 'bg-background text-foreground hover:bg-muted/80',
                )}
              >
                <Icon className="size-4" />
                <span>{option.label}</span>
              </ToggleGroupItem>
            )
          })}
        </ToggleGroup>
      </div>

      <div className="border-t border-border/70" />

      <div className="flex flex-col gap-2 p-3">
        <p className="text-[13px] font-medium tracking-[-0.09px] text-muted-foreground">{t('Event status')}</p>
        <ToggleGroup
          aria-label={t('Event status')}
          value={[status]}
          onValueChange={(values) => {
            const nextStatus = values[0] as PredictionResultsStatusOption | undefined
            if (nextStatus) {
              onStatusChange(nextStatus)
            }
          }}
          spacing={2}
          className="flex flex-wrap justify-start"
        >
          {statusOptions.map((option) => {
            const isActive = option.value === status

            return (
              <ToggleGroupItem
                key={option.value}
                value={option.value}
                data-testid={`prediction-status-${option.value}`}
                className={cn(
                  `inline-flex h-8 items-center rounded-md px-3 text-[13px] font-medium tracking-[-0.09px] transition-colors focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none`,
                  'data-pressed:bg-muted data-pressed:text-foreground',
                  isActive ? 'bg-muted text-foreground' : 'bg-background text-foreground hover:bg-muted/80',
                )}
              >
                {option.label}
              </ToggleGroupItem>
            )
          })}
        </ToggleGroup>
      </div>
    </div>
  )
}
