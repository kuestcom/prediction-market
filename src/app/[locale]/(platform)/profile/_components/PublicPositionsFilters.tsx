import type { SortOption } from '@/app/[locale]/(platform)/profile/_types/PublicPositionsTypes'
import { ArrowDownNarrowWideIcon, MergeIcon, SearchIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface PublicPositionsFiltersProps {
  searchQuery: string
  sortBy: SortOption
  onSearchChange: (query: string) => void
  onSortChange: (value: SortOption) => void
  showMergeButton: boolean
  onMergeClick: () => void
}

export default function PublicPositionsFilters({
  searchQuery,
  sortBy,
  onSearchChange,
  onSortChange,
  showMergeButton,
  onMergeClick,
}: PublicPositionsFiltersProps) {
  return (
    <div className="space-y-3 px-2 pt-2 sm:px-3">
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground sm:left-3" />
          <Input
            type="text"
            placeholder="Search markets..."
            value={searchQuery}
            onChange={event => onSearchChange(event.target.value)}
            className="w-full min-w-0 pr-3 pl-8 text-sm sm:pl-9"
          />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Select value={sortBy} onValueChange={value => onSortChange(value as SortOption)}>
            <SelectTrigger
              aria-label="Sort positions"
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
              <SelectItem value="currentValue">Current value</SelectItem>
              <SelectItem value="trade">Trade</SelectItem>
              <SelectItem value="pnlPercent">Profit &amp; Loss %</SelectItem>
              <SelectItem value="pnlValue">Profit &amp; Loss $</SelectItem>
              <SelectItem value="shares">Shares</SelectItem>
              <SelectItem value="alpha">Alphabetically</SelectItem>
              <SelectItem value="endingSoon">Ending soon</SelectItem>
              <SelectItem value="payout">Payout</SelectItem>
              <SelectItem value="latestPrice">Latest Price</SelectItem>
              <SelectItem value="avgCost">Average cost per share</SelectItem>
            </SelectContent>
          </Select>

          {showMergeButton && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="rounded-md dark:bg-transparent"
                  onClick={onMergeClick}
                  aria-label="Merge positions"
                >
                  <MergeIcon className="size-4 rotate-90" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Merge</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  )
}
