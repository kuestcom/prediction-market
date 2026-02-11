'use client'

import type { Table } from '@tanstack/react-table'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
} from 'lucide-react'
import { useExtracted } from 'next-intl'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface DataTablePaginationProps<TData> {
  table: Table<TData>
  totalCount?: number
  onPageChange?: (pageIndex: number) => void
  onPageSizeChange?: (pageSize: number) => void
}

export function DataTablePagination<TData>({
  table,
  totalCount,
  onPageChange,
  onPageSizeChange,
}: DataTablePaginationProps<TData>) {
  const t = useExtracted()
  const pageIndex = table.getState().pagination.pageIndex
  const pageSize = table.getState().pagination.pageSize
  const pageCount = table.getPageCount()
  const isServerSide = totalCount !== undefined

  function handlePageChange(newPageIndex: number) {
    if (onPageChange) {
      onPageChange(newPageIndex)
    }
    else {
      table.setPageIndex(newPageIndex)
    }
  }

  function handlePageSizeChange(newPageSize: string) {
    const size = Number.parseInt(newPageSize)
    if (onPageSizeChange) {
      onPageSizeChange(size)
    }
    else {
      table.setPageSize(size)
    }
  }

  const canPreviousPage = pageIndex > 0
  const canNextPage = pageIndex < pageCount - 1

  return (
    <div className="flex flex-col space-y-2 px-2 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
      <div className={`
        flex flex-col space-y-1 text-sm text-muted-foreground
        sm:flex-row sm:items-center sm:space-y-0 sm:space-x-4
      `}
      >
        <div>
          {t('{selected} of {total} row(s) selected.', {
            selected: String(table.getFilteredSelectedRowModel().rows.length),
            total: String(isServerSide ? totalCount : table.getFilteredRowModel().rows.length),
          })}
        </div>
        {isServerSide && (
          <div>
            {t('Showing {from} to {to} of {total} entries.', {
              from: String(totalCount ? pageIndex * pageSize + 1 : 0),
              to: String(Math.min((pageIndex + 1) * pageSize, totalCount!)),
              total: String(totalCount),
            })}
          </div>
        )}
      </div>
      <div className="flex items-center space-x-6 lg:space-x-8">
        <div className="flex items-center space-x-2">
          <p className="text-sm font-medium">{t('Rows per page')}</p>
          <Select
            value={`${pageSize}`}
            onValueChange={handlePageSizeChange}
          >
            <SelectTrigger className="h-8 w-17.5">
              <SelectValue placeholder={pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              {[10, 25, 50, 100].map(size => (
                <SelectItem key={size} value={`${size}`}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex w-25 items-center justify-center text-sm font-medium whitespace-nowrap">
          {t('Page {page} of {pageCount}', {
            page: String(pageIndex + 1),
            pageCount: String(pageCount),
          })}
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            className="hidden size-8 p-0 lg:flex"
            onClick={() => handlePageChange(0)}
            disabled={!canPreviousPage}
          >
            <span className="sr-only">{t('Go to first page')}</span>
            <ChevronsLeftIcon className="size-4" />
          </Button>
          <Button
            variant="outline"
            className="size-8 p-0"
            onClick={() => handlePageChange(pageIndex - 1)}
            disabled={!canPreviousPage}
          >
            <span className="sr-only">{t('Go to previous page')}</span>
            <ChevronLeftIcon className="size-4" />
          </Button>
          <Button
            variant="outline"
            className="size-8 p-0"
            onClick={() => handlePageChange(pageIndex + 1)}
            disabled={!canNextPage}
          >
            <span className="sr-only">{t('Go to next page')}</span>
            <ChevronRightIcon className="size-4" />
          </Button>
          <Button
            variant="outline"
            className="hidden size-8 p-0 lg:flex"
            onClick={() => handlePageChange(pageCount - 1)}
            disabled={!canNextPage}
          >
            <span className="sr-only">{t('Go to last page')}</span>
            <ChevronsRightIcon className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
