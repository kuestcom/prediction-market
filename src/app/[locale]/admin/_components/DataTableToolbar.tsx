'use client'

import type { Table } from '@tanstack/react-table'
import type { ReactNode } from 'react'
import { XIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useDebounce } from '@/hooks/useDebounce'
import { cn } from '@/lib/utils'
import { DataTableViewOptions } from './DataTableViewOptions'

interface DataTableToolbarProps<TData> {
  table: Table<TData>
  search: string
  onSearchChange: (search: string) => void
  searchPlaceholder?: string
  enableColumnVisibility?: boolean
  enableSelection?: boolean
  leftContent?: ReactNode
  rightContent?: ReactNode
  searchInputClassName?: string
  searchLeadingIcon?: ReactNode
}

export function DataTableToolbar<TData>({
  table,
  search,
  onSearchChange,
  searchPlaceholder,
  enableColumnVisibility = true,
  enableSelection = false,
  leftContent,
  rightContent,
  searchInputClassName,
  searchLeadingIcon,
}: DataTableToolbarProps<TData>) {
  const t = useExtracted()
  const [searchInput, setSearchInput] = useState(search)
  const debouncedSearchInput = useDebounce(searchInput, 300)

  useEffect(() => {
    setSearchInput(search)
  }, [search])

  useEffect(() => {
    if (debouncedSearchInput !== searchInput || debouncedSearchInput === search) {
      return
    }

    onSearchChange(debouncedSearchInput)
  }, [debouncedSearchInput, onSearchChange, search, searchInput])

  const resolvedSearchPlaceholder = searchPlaceholder ?? t('Search...')
  const isFiltered = searchInput.length > 0
  const selectedRowsCount = table.getFilteredSelectedRowModel().rows.length

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2">
        <div className="relative">
          {searchLeadingIcon && (
            <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground">
              {searchLeadingIcon}
            </span>
          )}
          <Input
            placeholder={resolvedSearchPlaceholder}
            value={searchInput}
            onChange={event => setSearchInput(event.target.value)}
            className={cn(
              'h-8 w-37.5 lg:w-62.5',
              searchLeadingIcon && 'pl-8',
              searchInputClassName,
            )}
          />
        </div>
        {leftContent}
        {isFiltered && (
          <Button
            variant="ghost"
            onClick={() => {
              setSearchInput('')
              onSearchChange('')
            }}
            className="h-9 px-2 lg:px-3"
          >
            {t('Reset')}
            <XIcon className="ml-2 size-4" />
          </Button>
        )}
      </div>
      <div className="flex items-center space-x-2">
        {enableSelection && selectedRowsCount > 0 && (
          <div className="flex-1 text-sm text-muted-foreground">
            {t('{selected} of {total} row(s) selected.', {
              selected: String(selectedRowsCount),
              total: String(table.getFilteredRowModel().rows.length),
            })}
          </div>
        )}
        {rightContent}
        {enableColumnVisibility && <DataTableViewOptions table={table} />}
      </div>
    </div>
  )
}
