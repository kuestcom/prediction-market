'use client'

import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'

import { useLeaderboardTranslations } from '@/app/[locale]/(platform)/leaderboard/_utils/leaderboardTranslations'
import { cn } from '@/lib/utils'

interface LeaderboardPaginationProps {
  hasItems: boolean
  hasNextPage: boolean
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

export default function LeaderboardPagination({
  hasItems,
  hasNextPage,
  page,
  setPageValue,
}: LeaderboardPaginationProps) {
  const { translateNextPage, translatePreviousPage } = useLeaderboardTranslations()

  if (!hasItems) {
    return null
  }

  const pageWindowStart = Math.max(1, page - 3)
  const pageWindowEnd = page + (hasNextPage ? 1 : 0)
  const pageNumbers = Array.from({ length: pageWindowEnd - pageWindowStart + 1 }, (_, index) => pageWindowStart + index)

  return (
    <div className="mt-4 flex items-center justify-center gap-2">
      <button
        type="button"
        onClick={() => setPageValue((prev) => Math.max(1, prev - 1))}
        className={paginationChevronClass(page === 1)}
        disabled={page === 1}
        aria-label={translatePreviousPage()}
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
      {hasNextPage && <span className="text-sm text-muted-foreground">{'\u2026'}</span>}
      <button
        type="button"
        onClick={() => {
          if (hasNextPage) {
            setPageValue((prev) => prev + 1)
          }
        }}
        className={paginationChevronClass(!hasNextPage)}
        disabled={!hasNextPage}
        aria-label={translateNextPage()}
      >
        <ChevronRightIcon className="size-4" />
      </button>
    </div>
  )
}
