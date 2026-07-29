'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { tableHeaderClass } from '@/lib/constants'

interface DataTableSkeletonProps {
  columnCount?: number
  rowCount?: number
  searchable?: boolean
  showPagination?: boolean
}

export function DataTableSkeleton({
  columnCount = 5,
  rowCount = 10,
  searchable = true,
  showPagination = true,
}: DataTableSkeletonProps) {
  return (
    <div className="space-y-4">
      {searchable && (
        <div className="flex items-center justify-between">
          <div className="flex flex-1 items-center space-x-2">
            <Skeleton className="h-8 w-62.5" />
            <Skeleton className="h-8 w-17.5" />
          </div>
          <Skeleton className="h-8 w-17.5" />
        </div>
      )}

      <div className="overflow-x-auto rounded-md border">
        <Table className="min-w-full">
          <TableHeader>
            <TableRow>
              {Array.from({ length: columnCount }).map((_, i) => (
                <TableHead key={`skeleton-col-${i}`} className={`${tableHeaderClass} whitespace-nowrap`}>
                  <Skeleton className="h-4 w-20" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: rowCount }).map((_, rowIndex) => (
              <TableRow key={`row-${rowIndex}`}>
                {Array.from({ length: columnCount }).map((_, cellIndex) => (
                  <TableCell key={`cell-${cellIndex}`} className="whitespace-nowrap">
                    {cellIndex === 0 ? (
                      <Skeleton className="size-4" />
                    ) : cellIndex === 1 ? (
                      <div className="flex min-w-50 items-start gap-3">
                        <Skeleton className="size-10 shrink-0 rounded-full" />
                        <div className="flex min-w-0 flex-col gap-1">
                          <Skeleton className="h-4 w-30" />
                          <Skeleton className="h-3 w-15" />
                        </div>
                      </div>
                    ) : cellIndex === 2 ? (
                      <div className="min-w-20">
                        <Skeleton className="size-4" />
                      </div>
                    ) : cellIndex === 3 ? (
                      <div className="min-w-25">
                        <Skeleton className="h-4 w-20" />
                      </div>
                    ) : (
                      <div className="min-w-25 text-right">
                        <Skeleton className="ml-auto h-4 w-20" />
                      </div>
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {showPagination && (
        <div className="flex items-center justify-between px-2">
          <div className="flex-1 text-sm text-muted-foreground">
            <Skeleton className="h-4 w-25" />
          </div>
          <div className="flex items-center space-x-6 lg:space-x-8">
            <div className="flex items-center space-x-2">
              <Skeleton className="h-4 w-25" />
              <Skeleton className="h-8 w-17.5" />
            </div>
            <div className="flex items-center space-x-2">
              <Skeleton className="h-4 w-25" />
            </div>
            <div className="flex items-center space-x-2">
              <Skeleton className="size-8" />
              <Skeleton className="size-8" />
              <Skeleton className="size-8" />
              <Skeleton className="size-8" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
