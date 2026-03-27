import type { ReactNode } from 'react'
import type { PortfolioOpenOrdersSort } from '@/app/[locale]/(platform)/portfolio/_types/PortfolioOpenOrdersTypes'
import { ArrowDownNarrowWideIcon, SearchIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface PortfolioOpenOrdersFiltersProps {
  searchQuery: string
  onSearchChange: (value: string) => void
  sortBy: PortfolioOpenOrdersSort
  onSortChange: (value: PortfolioOpenOrdersSort) => void
  action?: ReactNode
}

export default function PortfolioOpenOrdersFilters({
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  action,
}: PortfolioOpenOrdersFiltersProps) {
  return (
    <div className="space-y-3 px-2 pt-2 sm:px-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <div className="flex min-w-0 items-center gap-2 sm:flex-1 sm:gap-3">
          <div className="relative min-w-0 flex-1">
            <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground sm:left-3" />
            <Input
              type="text"
              placeholder="Search open orders..."
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              className="w-full min-w-0 pr-3 pl-8 text-sm sm:pl-9"
            />
          </div>

          <Select value={sortBy} onValueChange={value => onSortChange(value as PortfolioOpenOrdersSort)}>
            <SelectTrigger
              aria-label="Sort open orders"
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
              <SelectItem value="market">Market</SelectItem>
              <SelectItem value="filled">Filled Quantity</SelectItem>
              <SelectItem value="total">Total Quantity</SelectItem>
              <SelectItem value="date">Order Date</SelectItem>
              <SelectItem value="resolving">Resolving Soonest</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {action}
      </div>
    </div>
  )
}
