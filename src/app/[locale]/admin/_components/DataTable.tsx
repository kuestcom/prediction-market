'use client'

import type { ColumnDef, SortingState, VisibilityState } from '@tanstack/react-table'
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { useExtracted } from 'next-intl'
import { useCallback, useMemo, useState } from 'react'
import { DataTableToolbar } from '@/app/[locale]/admin/_components/DataTableToolbar'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { tableHeaderClass } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { DataTablePagination } from './DataTablePagination'

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  totalCount: number
  searchPlaceholder?: string
  enableSelection?: boolean
  enablePagination?: boolean
  enableColumnVisibility?: boolean
  isLoading?: boolean
  error?: string | null
  emptyMessage?: string
  emptyDescription?: string
  onRetry?: () => void
  // Server-side state handlers
  search: string
  onSearchChange: (search: string) => void
  sortBy: string | null
  sortOrder: 'asc' | 'desc' | null
  onSortChange: (column: string | null, order: 'asc' | 'desc' | null) => void
  pageIndex: number
  pageSize: number
  onPageChange: (pageIndex: number) => void
  onPageSizeChange: (pageSize: number) => void
}

export function DataTable<TData, TValue>({
  columns,
  data,
  totalCount,
  searchPlaceholder,
  enableSelection = false,
  enablePagination = true,
  enableColumnVisibility = true,
  isLoading = false,
  error = null,
  emptyMessage,
  emptyDescription,
  onRetry,
  search,
  onSearchChange,
  sortBy,
  sortOrder,
  onSortChange,
  pageIndex,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: DataTableProps<TData, TValue>) {
  const t = useExtracted()
  const resolvedSearchPlaceholder = searchPlaceholder ?? t('Search...')
  const resolvedEmptyMessage = emptyMessage ?? t('No entries found')
  const resolvedEmptyDescription = emptyDescription ?? t('There are no entries to display yet.')
  const [rowSelection, setRowSelection] = useState({})

  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})

  const sorting: SortingState = useMemo(() => {
    const dbToColumnMapping: Record<string, string> = {
      username: 'user',
      email: 'email',
      created_at: 'created',
    }

    const columnId = sortBy ? (dbToColumnMapping[sortBy] || sortBy) : null
    return columnId ? [{ id: columnId, desc: sortOrder === 'desc' }] : []
  }, [sortBy, sortOrder])

  const handleSortingChange = useCallback((updaterOrValue: any) => {
    const newSorting = typeof updaterOrValue === 'function' ? updaterOrValue(sorting) : updaterOrValue

    if (newSorting.length === 0) {
      onSortChange(null, null)
    }
    else {
      const sort = newSorting[0]
      onSortChange(sort.id, sort.desc ? 'desc' : 'asc')
    }
  }, [sorting, onSortChange])

  const table = useReactTable({
    data,
    columns,
    pageCount: Math.ceil(totalCount / pageSize),
    manualPagination: true,
    manualSorting: true,
    onSortingChange: handleSortingChange,
    getCoreRowModel: getCoreRowModel(),
    onColumnVisibilityChange: Array.isArray(columnVisibility) ? columnVisibility[1] : setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnVisibility: Array.isArray(columnVisibility) ? columnVisibility[0] : columnVisibility,
      rowSelection,
      pagination: {
        pageIndex,
        pageSize,
      },
    },
  })

  if (error) {
    return (
      <div className="space-y-4">
        <DataTableToolbar
          search={search}
          onSearchChange={onSearchChange}
          searchPlaceholder={resolvedSearchPlaceholder}
          table={table}
          enableColumnVisibility={enableColumnVisibility}
          enableSelection={enableSelection}
          isLoading={isLoading}
        />
        <div className="rounded-md border">
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
            <div className="mb-4 text-muted-foreground">
              <svg
                className="mx-auto size-12 text-muted-foreground"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <h3 className="mb-2 text-lg font-medium text-foreground">{t('Something went wrong')}</h3>
            <p className="mb-4 text-sm text-muted-foreground">{error}</p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className={`
                  inline-flex items-center rounded-md border border-transparent bg-primary px-4 py-2 text-sm font-medium
                  text-white shadow-sm
                  hover:bg-primary/90
                  focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:outline-none
                `}
              >
                {t('Try again')}
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <DataTableToolbar
        search={search}
        onSearchChange={onSearchChange}
        searchPlaceholder={resolvedSearchPlaceholder}
        table={table}
        enableColumnVisibility={enableColumnVisibility}
        enableSelection={enableSelection}
        isLoading={isLoading}
      />
      <div className="overflow-x-auto rounded-md border">
        <Table className="w-full">
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} colSpan={header.colSpan} className={cn(tableHeaderClass, 'px-1 sm:px-2')}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading
              ? (
                  Array.from({ length: 10 }).map((_, index) => (
                    <TableRow key={`skeleton-${index}`}>
                      {columns.map((column, colIndex) => (
                        <TableCell key={`skeleton-${index}-${colIndex}`} className="px-1 sm:px-2">
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )
              : table.getRowModel().rows?.length
                ? (
                    table.getRowModel().rows.map(row => (
                      <TableRow
                        key={row.id}
                        data-state={row.getIsSelected() && 'selected'}
                      >
                        {row.getVisibleCells().map(cell => (
                          <TableCell key={cell.id} className="px-1 sm:px-2">
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  )
                : (
                    <TableRow>
                      <TableCell
                        colSpan={columns.length}
                        className="h-24 text-center"
                      >
                        {totalCount === 0
                          ? (
                              <div className="flex flex-col items-center justify-center py-8">
                                <div className="mb-2 text-muted-foreground">
                                  <svg
                                    className="mx-auto size-8"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    aria-hidden="true"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                                    />
                                  </svg>
                                </div>
                                <h3 className="mb-1 text-sm font-medium text-foreground">{resolvedEmptyMessage}</h3>
                                <p className="text-xs text-muted-foreground">{resolvedEmptyDescription}</p>
                              </div>
                            )
                          : (
                              <div className="flex flex-col items-center justify-center py-8">
                                <div className="mb-2 text-muted-foreground">
                                  <svg
                                    className="mx-auto size-8"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    aria-hidden="true"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                    />
                                  </svg>
                                </div>
                                <h3 className="mb-1 text-sm font-medium text-foreground">{t('No results found')}</h3>
                                <p className="text-xs text-muted-foreground">
                                  {t('Try adjusting your search or filter to find what you\'re looking for.')}
                                </p>
                              </div>
                            )}
                      </TableCell>
                    </TableRow>
                  )}
          </TableBody>
        </Table>
      </div>
      {enablePagination && (
        <DataTablePagination
          table={table}
          totalCount={totalCount}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </div>
  )
}
