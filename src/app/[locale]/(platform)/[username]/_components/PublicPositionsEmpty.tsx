'use client'

import { SearchIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface PublicPositionsEmptyProps {
  searchQuery?: string
  minAmountFilter?: string
  marketStatusFilter?: 'active' | 'closed'
  onClearSearch?: () => void
  onClearAmountFilter?: () => void
}

export default function PublicPositionsEmpty({
  searchQuery,
  minAmountFilter,
  marketStatusFilter = 'active',
  onClearSearch,
  onClearAmountFilter,
}: PublicPositionsEmptyProps) {
  const isSearchActive = searchQuery && searchQuery.trim().length > 0
  const isAmountFilterActive = minAmountFilter && minAmountFilter !== 'All'

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="px-8 py-16 text-center">
        <div className="mx-auto max-w-md space-y-4">
          <div className={cn(
            'mx-auto flex size-12 items-center justify-center rounded-full',
            isSearchActive
              ? 'bg-orange-100 dark:bg-orange-900/30'
              : 'bg-muted',
          )}
          >
            {isSearchActive
              ? (
                  <SearchIcon className="size-6 text-orange-600 dark:text-orange-400" />
                )
              : (
                  <svg
                    className="size-6 text-muted-foreground"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                )}
          </div>

          <div className="space-y-3">
            {isSearchActive && (
              <div className={`
                inline-flex items-center gap-2 rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-800
                dark:bg-orange-900/30 dark:text-orange-300
              `}
              >
                <SearchIcon className="size-3" />
                Searching for "
                {searchQuery}
                "
              </div>
            )}

            <h3 className="text-base font-semibold text-foreground">
              {isSearchActive
                ? `No results found`
                : isAmountFilterActive
                  ? 'No positions match your filter'
                  : marketStatusFilter === 'active'
                    ? 'No active positions'
                    : 'No closed positions'}
            </h3>

            <p className="text-sm/relaxed text-muted-foreground">
              {isSearchActive
                ? `No positions found matching "${searchQuery}". The search looks through market titles to find relevant positions.`
                : isAmountFilterActive
                  ? `No positions found with a minimum value of $${minAmountFilter}. This user may have smaller positions or no activity in this range.`
                  : marketStatusFilter === 'active'
                    ? 'This user doesn\'t have any positions in active markets. Positions will appear here when they trade in markets that are still open.'
                    : 'This user doesn\'t have any positions in closed markets. Positions from resolved or inactive markets will appear here.'}
            </p>

            {isSearchActive && (
              <div className="mt-6 space-y-3">
                <div className={`
                  rounded-lg border border-orange-200 bg-orange-50 p-4
                  dark:border-orange-800 dark:bg-orange-900/20
                `}
                >
                  <div className="space-y-3">
                    <p className="text-sm text-orange-800 dark:text-orange-200">
                      <strong>Search suggestions:</strong>
                    </p>
                    <ul className="space-y-1 text-xs text-orange-700 dark:text-orange-300">
                      <li>• Try different keywords (e.g., "election", "sports", "crypto")</li>
                      <li>• Use shorter, more general terms</li>
                      <li>• Check spelling and try alternative words</li>
                    </ul>
                    {onClearSearch && (
                      <Button
                        type="button"
                        onClick={onClearSearch}
                        size="sm"
                        variant="outline"
                        className={`
                          mt-3 w-full border-orange-300 text-orange-800
                          hover:bg-orange-100
                          dark:border-orange-700 dark:text-orange-200
                          dark:hover:bg-orange-900/40
                        `}
                      >
                        <XIcon className="mr-2 size-3" />
                        Clear search and show all positions
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {!isSearchActive && isAmountFilterActive && (
              <div className="mt-6 rounded-lg bg-muted/50 p-4">
                <p className="text-sm text-muted-foreground">
                  <strong>Filter active:</strong>
                  {' '}
                  Showing only positions with minimum value of $
                  {minAmountFilter}
                  .
                </p>
                {onClearAmountFilter && (
                  <Button
                    type="button"
                    onClick={onClearAmountFilter}
                    size="sm"
                    variant="outline"
                    className="mt-3 w-full"
                  >
                    Show all amounts
                  </Button>
                )}
              </div>
            )}

            {!isSearchActive && !isAmountFilterActive && (
              <div className="mt-6 rounded-lg bg-muted/50 p-4">
                <p className="text-sm text-muted-foreground">
                  {marketStatusFilter === 'active'
                    ? 'Active positions show current holdings in markets that are still open for trading. When this user trades in active markets, their positions will appear here.'
                    : 'Closed positions show holdings from markets that have been resolved or are no longer active. Historical trading positions will appear here.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
