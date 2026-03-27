import type { ActivitySort, ActivityTypeFilter } from '@/app/[locale]/(platform)/profile/_types/PublicActivityTypes'
import { ArrowDownNarrowWideIcon, DownloadIcon, ListFilterIcon, SearchIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface PublicActivityFiltersProps {
  searchQuery: string
  onSearchChange: (value: string) => void
  typeFilter: ActivityTypeFilter
  onTypeChange: (value: ActivityTypeFilter) => void
  sortFilter: ActivitySort
  onSortChange: (value: ActivitySort) => void
  onExport: () => void
  disableExport: boolean
}

export default function PublicActivityFilters({
  searchQuery,
  onSearchChange,
  typeFilter,
  onTypeChange,
  sortFilter,
  onSortChange,
  onExport,
  disableExport,
}: PublicActivityFiltersProps) {
  return (
    <div className="space-y-3 px-2 pt-2 sm:px-3">
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground sm:left-3" />
          <Input
            type="text"
            placeholder="Search activity..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="w-full min-w-0 pr-3 pl-8 text-sm sm:pl-9"
          />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Select value={typeFilter} onValueChange={value => onTypeChange(value as ActivityTypeFilter)}>
            <SelectTrigger
              aria-label="Filter activity type"
              className="
                w-9 justify-center gap-0 px-0
                *:data-[slot=select-value]:hidden
                sm:w-fit sm:justify-between sm:gap-1.5 sm:px-2.5
                sm:*:data-[slot=select-value]:flex
                dark:bg-transparent
                [&>svg:last-of-type]:hidden
              "
            >
              <ListFilterIcon className="size-4 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="trades">Trades</SelectItem>
              <SelectItem value="buy">Buy</SelectItem>
              <SelectItem value="merge">Merge</SelectItem>
              <SelectItem value="redeem">Redeem</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortFilter} onValueChange={value => onSortChange(value as ActivitySort)}>
            <SelectTrigger
              aria-label="Sort activity"
              className="
                w-9 justify-center gap-0 px-0
                *:data-[slot=select-value]:hidden
                sm:w-fit sm:justify-between sm:gap-1.5 sm:px-2.5
                sm:*:data-[slot=select-value]:flex
                dark:bg-transparent
                [&>svg:last-of-type]:hidden
              "
            >
              <ArrowDownNarrowWideIcon className="size-4 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
              <SelectItem value="value">Value</SelectItem>
              <SelectItem value="shares">Shares</SelectItem>
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onExport}
            disabled={disableExport}
            className="rounded-md dark:bg-transparent"
            aria-label="Export activity"
          >
            <DownloadIcon className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
