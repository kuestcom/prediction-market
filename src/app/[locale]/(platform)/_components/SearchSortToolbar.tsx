import type { ReactNode } from 'react'
import { SearchIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface SearchSortToolbarProps {
  searchQuery: string
  searchPlaceholder: string
  controls: ReactNode
  action?: ReactNode
  stackOnMobile?: boolean
  onSearchChange: (value: string) => void
}

interface SearchSortSelectProps {
  value: string
  ariaLabel: string
  icon: ReactNode
  children: ReactNode
  onValueChange: (value: string) => void
}

export default function SearchSortToolbar({
  searchQuery,
  searchPlaceholder,
  controls,
  action,
  stackOnMobile = false,
  onSearchChange,
}: SearchSortToolbarProps) {
  return (
    <div className="space-y-3 px-2 pt-2 sm:px-3">
      <div className={cn(
        stackOnMobile
          ? 'flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3'
          : 'flex items-center gap-2 sm:gap-3',
      )}
      >
        <div className={cn(
          stackOnMobile
            ? 'flex min-w-0 items-center gap-2 sm:flex-1 sm:gap-3'
            : 'relative min-w-0 flex-1',
        )}
        >
          <SearchInput
            value={searchQuery}
            placeholder={searchPlaceholder}
            onChange={onSearchChange}
          />
          {stackOnMobile && controls}
        </div>

        {stackOnMobile
          ? action
          : (
              <div className="flex shrink-0 items-center gap-2">
                {controls}
                {action}
              </div>
            )}
      </div>
    </div>
  )
}

export function SearchSortSelect({
  value,
  ariaLabel,
  icon,
  children,
  onValueChange,
}: SearchSortSelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        aria-label={ariaLabel}
        className={cn(`
          w-9 justify-center gap-0 px-0
          *:data-[slot=select-value]:hidden
          sm:w-fit sm:justify-between sm:gap-1.5 sm:px-2.5
          sm:*:data-[slot=select-value]:flex
          dark:bg-transparent
          [&>svg:last-of-type]:hidden
        `)}
      >
        {icon}
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {children}
      </SelectContent>
    </Select>
  )
}

function SearchInput({
  value,
  placeholder,
  onChange,
}: {
  value: string
  placeholder: string
  onChange: (value: string) => void
}) {
  return (
    <div className="relative min-w-0 flex-1">
      <SearchIcon className="
        pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground
        sm:left-3
      "
      />
      <Input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={event => onChange(event.target.value)}
        className="w-full min-w-0 pr-3 pl-8 text-sm sm:pl-9"
      />
    </div>
  )
}
