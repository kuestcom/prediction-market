'use client'

import type { Table } from '@tanstack/react-table'
import { XIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DataTableViewOptions } from './DataTableViewOptions'

interface DataTableToolbarProps<TData> {
  table: Table<TData>
  search: string
  onSearchChange: (search: string) => void
  searchPlaceholder?: string
  enableColumnVisibility?: boolean
  enableSelection?: boolean
  isLoading?: boolean
}

export function DataTableToolbar<TData>({
  table,
  search,
  onSearchChange,
  searchPlaceholder,
  enableColumnVisibility = true,
  enableSelection = false,
  isLoading = false,
}: DataTableToolbarProps<TData>) {
  const t = useExtracted()
  const resolvedSearchPlaceholder = searchPlaceholder ?? t('Search...')
  const isFiltered = search.length > 0
  const selectedRowsCount = table.getFilteredSelectedRowModel().rows.length

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2">
        <Input
          placeholder={resolvedSearchPlaceholder}
          value={search}
          onChange={event => onSearchChange(event.target.value)}
          className="h-8 w-37.5 lg:w-62.5"
          disabled={isLoading}
        />
        {isFiltered && (
          <Button
            variant="ghost"
            onClick={() => onSearchChange('')}
            className="h-8 px-2 lg:px-3"
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
        {enableColumnVisibility && <DataTableViewOptions table={table} />}
      </div>
    </div>
  )
}
