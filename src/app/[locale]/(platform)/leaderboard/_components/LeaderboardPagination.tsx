'use client'

import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

interface LeaderboardPaginationProps {
  page: number
  setPageValue: (nextPage: number | ((currentPage: number) => number)) => void
}

function paginationButtonClass(isActive: boolean) {
  return cn(
    'flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm font-medium transition-colors',
    isActive ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted',
  )
}

function paginationChevronClass(isDisabled: boolean) {
  return cn(
    'flex size-8 items-center justify-center text-muted-foreground transition-opacity',
    isDisabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer hover:text-foreground',
  )
}

export default function LeaderboardPagination({ page, setPageValue }: LeaderboardPaginationProps) {
  const pageWindowStart = Math.max(1, page - 3)
  const pageNumbers = Array.from({ length: 6 }, (_, index) => pageWindowStart + index)

  return (
    <div className="mt-4 flex items-center justify-center gap-2">
      <button
        type="button"
        onClick={() => setPageValue((prev) => Math.max(1, prev - 1))}
        className={paginationChevronClass(page === 1)}
        disabled={page === 1}
        aria-label="Previous page"
      >
        <ChevronLeftIcon className="size-4" />
      </button>
      {pageNumbers.map((pageNumber) => (
        <button
          key={`leaderboard-page-${pageNumber}`}
          type="button"
          onClick={() => setPageValue(pageNumber)}
          className={paginationButtonClass(pageNumber === page)}
          aria-current={pageNumber === page ? 'page' : undefined}
        >
          {pageNumber}
        </button>
      ))}
      <span className="text-sm text-muted-foreground">{'\u2026'}</span>
      <button
        type="button"
        onClick={() => setPageValue((prev) => prev + 1)}
        className={paginationChevronClass(false)}
        aria-label="Next page"
      >
        <ChevronRightIcon className="size-4" />
      </button>
    </div>
  )
}
