import type { RefObject } from 'react'
import type { PublicPosition } from './PublicPositionItem'
import type { PositionsTotals, SortDirection, SortOption } from '@/app/[locale]/(platform)/[username]/_types/PublicPositionsTypes'
import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react'
import { formatCurrencyValue } from '@/app/[locale]/(platform)/[username]/_utils/PublicPositionsUtils'
import { tableHeaderClass } from '@/lib/constants'
import { formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import PublicPositionsError from './PublicPositionsError'
import PublicPositionsLoadingState from './PublicPositionsLoadingState'
import PublicPositionsRow from './PublicPositionsRow'

interface SortHeaderButtonProps {
  label: string
  sortKey: SortOption
  sortBy: SortOption
  sortDirection: SortDirection
  onSortHeaderClick: (value: SortOption) => void
}

function SortHeaderButton({
  label,
  sortKey,
  sortBy,
  sortDirection,
  onSortHeaderClick,
}: SortHeaderButtonProps) {
  const isActive = sortBy === sortKey
  const Icon = sortDirection === 'asc' ? ChevronUpIcon : ChevronDownIcon

  return (
    <button
      type="button"
      onClick={() => onSortHeaderClick(sortKey)}
      className={cn(
        `
          inline-flex items-center gap-1 rounded-md px-2 py-1 tracking-wide whitespace-nowrap uppercase
          transition-colors
          hover:bg-muted/70 hover:shadow-sm
        `,
        isActive && 'text-foreground',
      )}
    >
      <span>{label}</span>
      {isActive && <Icon className="size-3" aria-hidden />}
    </button>
  )
}

interface PublicPositionsTableProps {
  positions: PublicPosition[]
  totals: PositionsTotals
  isLoading: boolean
  hasInitialError: boolean
  isSearchActive: boolean
  searchQuery: string
  retryCount: number
  marketStatusFilter: 'active' | 'closed'
  sortBy: SortOption
  sortDirection: SortDirection
  onSortHeaderClick: (value: SortOption) => void
  onRetry: () => void
  onRefreshPage: () => void
  onShareClick: (position: PublicPosition) => void
  onSellClick?: (position: PublicPosition) => void
  loadMoreRef: RefObject<HTMLDivElement | null>
}

export default function PublicPositionsTable({
  positions,
  totals,
  isLoading,
  hasInitialError,
  isSearchActive,
  searchQuery,
  retryCount,
  marketStatusFilter,
  sortBy,
  sortDirection,
  onSortHeaderClick,
  onRetry,
  onRefreshPage,
  onShareClick,
  onSellClick,
  loadMoreRef,
}: PublicPositionsTableProps) {
  const hasPositions = positions.length > 0

  return (
    <div className="relative w-full overflow-x-auto">
      <table className="w-full min-w-[1000px] table-fixed border-collapse">
        <thead>
          <tr className="border-b">
            <th className={cn(tableHeaderClass, 'w-[32%] text-left')}>
              <SortHeaderButton
                label="Market"
                sortKey="alpha"
                sortBy={sortBy}
                sortDirection={sortDirection}
                onSortHeaderClick={onSortHeaderClick}
              />
            </th>
            <th className={cn(tableHeaderClass, 'w-[14%] text-center')}>
              <SortHeaderButton
                label="Avg → Now"
                sortKey="latestPrice"
                sortBy={sortBy}
                sortDirection={sortDirection}
                onSortHeaderClick={onSortHeaderClick}
              />
            </th>
            <th className={cn(tableHeaderClass, 'w-[11%] text-center')}>
              <SortHeaderButton
                label="Trade"
                sortKey="trade"
                sortBy={sortBy}
                sortDirection={sortDirection}
                onSortHeaderClick={onSortHeaderClick}
              />
            </th>
            <th className={cn(tableHeaderClass, 'w-[11%] text-center')}>
              <SortHeaderButton
                label="To win"
                sortKey="payout"
                sortBy={sortBy}
                sortDirection={sortDirection}
                onSortHeaderClick={onSortHeaderClick}
              />
            </th>
            <th className={cn(tableHeaderClass, 'w-[12%] text-right')}>
              <div className="flex justify-end">
                <SortHeaderButton
                  label="Value"
                  sortKey="currentValue"
                  sortBy={sortBy}
                  sortDirection={sortDirection}
                  onSortHeaderClick={onSortHeaderClick}
                />
              </div>
            </th>
            <th className={cn(tableHeaderClass, 'w-35 text-right')}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>

        {hasPositions && (
          <>
            <tbody className="divide-y divide-border/60">
              {positions.map(position => (
                <PublicPositionsRow
                  key={position.id}
                  position={position}
                  onShareClick={onShareClick}
                  onSellClick={onSellClick}
                />
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t text-sm font-semibold">
                <td className="px-2 py-3 text-left sm:px-3">Total</td>
                <td className="px-2 py-3 text-center text-muted-foreground sm:px-3" />
                <td className="px-2 py-3 text-center tabular-nums sm:px-3">
                  {formatCurrencyValue(totals.trade)}
                </td>
                <td className="px-2 py-3 text-center tabular-nums sm:px-3">
                  {formatCurrencyValue(totals.toWin)}
                </td>
                <td className="px-2 py-3 text-right tabular-nums sm:px-3">
                  {formatCurrencyValue(totals.value)}
                  <div className={cn('text-xs', totals.diff >= 0 ? 'text-yes' : 'text-no')}>
                    {`${totals.diff >= 0 ? '+' : ''}${formatCurrency(Math.abs(totals.diff))}`}
                    {' '}
                    (
                    {totals.pct.toFixed(2)}
                    %)
                  </div>
                </td>
                <td className="px-2 py-3 sm:px-3" />
              </tr>
            </tfoot>
          </>
        )}
      </table>

      {hasInitialError && (
        <PublicPositionsError
          isSearchActive={isSearchActive}
          searchQuery={searchQuery}
          retryCount={retryCount}
          isLoading={isLoading}
          onRetry={onRetry}
          onRefreshPage={onRefreshPage}
        />
      )}

      {isLoading && (
        <PublicPositionsLoadingState
          skeletonCount={5}
          isSearchActive={isSearchActive}
          searchQuery={searchQuery}
          marketStatusFilter={marketStatusFilter}
          retryCount={retryCount}
        />
      )}

      {!isLoading && !hasPositions && !hasInitialError && (
        <div className="py-12 text-center text-sm text-muted-foreground">
          {marketStatusFilter === 'active' ? 'No positions found.' : 'No closed positions found.'}
        </div>
      )}

      <div ref={loadMoreRef} className="h-0" />
    </div>
  )
}
