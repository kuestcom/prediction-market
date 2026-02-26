'use client'

import type { Table } from '@tanstack/react-table'
import type { ReactNode } from 'react'
import { XIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { DataTableViewOptions } from './DataTableViewOptions'

interface DataTableToolbarProps<TData> {
  table: Table<TData>
  search: string
  onSearchChange: (search: string) => void
  searchPlaceholder?: string
  enableColumnVisibility?: boolean
  enableSelection?: boolean
  isLoading?: boolean
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
  isLoading = false,
  leftContent,
  rightContent,
  searchInputClassName,
  searchLeadingIcon,
}: DataTableToolbarProps<TData>) {
  const t = useExtracted()
  const resolvedSearchPlaceholder = searchPlaceholder ?? t('Search...')
  const isFiltered = search.length > 0
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
            value={search}
            onChange={event => onSearchChange(event.target.value)}
            className={cn(
              'h-8 w-37.5 lg:w-62.5',
              searchLeadingIcon && 'pl-8',
              searchInputClassName,
            )}
            disabled={isLoading}
          />
        </div>
        {leftContent}
        {isFiltered && (
          <Button
            variant="ghost"
            onClick={() => onSearchChange('')}
            className="h-9 px-2 lg:px-3"
            disabled={isLoading}
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
