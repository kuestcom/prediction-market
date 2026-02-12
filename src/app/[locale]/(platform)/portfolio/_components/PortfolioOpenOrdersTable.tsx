import type { RefObject } from 'react'
import type { PortfolioUserOpenOrder } from '@/app/[locale]/(platform)/portfolio/_types/PortfolioOpenOrdersTypes'
import { tableHeaderClass } from '@/lib/constants'
import { cn } from '@/lib/utils'
import PortfolioOpenOrdersRow from './PortfolioOpenOrdersRow'

interface PortfolioOpenOrdersTableProps {
  orders: PortfolioUserOpenOrder[]
  isLoading: boolean
  emptyText: string
  isFetchingNextPage: boolean
  loadMoreRef: RefObject<HTMLDivElement | null>
}

export default function PortfolioOpenOrdersTable({
  orders,
  isLoading,
  emptyText,
  isFetchingNextPage,
  loadMoreRef,
}: PortfolioOpenOrdersTableProps) {
  const hasOrders = orders.length > 0
  const colSpan = 8
  let body = null

  if (isLoading) {
    body = (
      <tr>
        <td colSpan={colSpan} className="p-0">
          <div className="space-y-3 px-2 py-3 sm:px-3">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="h-14 rounded-lg border bg-muted/30" />
            ))}
          </div>
        </td>
      </tr>
    )
  }
  else if (!hasOrders) {
    body = (
      <tr>
        <td colSpan={colSpan} className="py-12 text-center text-sm text-muted-foreground">
          {emptyText}
        </td>
      </tr>
    )
  }
  else {
    body = (
      <>
        {orders.map(order => (
          <PortfolioOpenOrdersRow key={order.id} order={order} />
        ))}
        {isFetchingNextPage && (
          <tr>
            <td colSpan={colSpan} className="py-3 text-center text-xs text-muted-foreground">
              Loading more...
            </td>
          </tr>
        )}
        <tr>
          <td colSpan={colSpan} className="p-0">
            <div ref={loadMoreRef} className="h-0" />
          </td>
        </tr>
      </>
    )
  }

  return (
    <div className="relative w-full overflow-x-auto">
      <table className="w-full min-w-[980px] table-fixed border-collapse">
        <thead>
          <tr className="border-b bg-background">
            <th className={cn(tableHeaderClass, 'w-[34%] text-left')}>Market</th>
            <th className={cn(tableHeaderClass, 'w-22 text-center')}>Side</th>
            <th className={cn(tableHeaderClass, 'w-28 text-left')}>Outcome</th>
            <th className={cn(tableHeaderClass, 'w-20 text-center')}>Price</th>
            <th className={cn(tableHeaderClass, 'w-32 text-center')}>Filled</th>
            <th className={cn(tableHeaderClass, 'w-28 text-center')}>Total</th>
            <th className={cn(tableHeaderClass, 'w-32 text-left sm:text-center')}>Expiration</th>
            <th className={cn(tableHeaderClass, 'w-16 text-right')}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {body}
        </tbody>
      </table>
    </div>
  )
}
