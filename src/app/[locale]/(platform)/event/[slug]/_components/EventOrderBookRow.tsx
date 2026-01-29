import type { OrderBookLevel, OrderBookUserOrder } from '@/app/[locale]/(platform)/event/[slug]/_types/EventOrderBookTypes'
import { CircleXIcon, Clock4Icon, Loader2Icon } from 'lucide-react'
import { formatOrderBookPrice, formatTooltipShares } from '@/app/[locale]/(platform)/event/[slug]/_utils/EventOrderBookUtils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatSharesLabel, usdFormatter } from '@/lib/formatters'
import { cn } from '@/lib/utils'

interface EventOrderBookRowProps {
  level: OrderBookLevel
  maxTotal: number
  showBadge?: 'ask' | 'bid'
  onSelect?: (level: OrderBookLevel) => void
  userOrder?: OrderBookUserOrder | null
  isCancelling?: boolean
  onCancelUserOrder?: (orderId: string) => void
}

export default function EventOrderBookRow({
  level,
  maxTotal,
  showBadge,
  onSelect,
  userOrder,
  isCancelling,
  onCancelUserOrder,
}: EventOrderBookRowProps) {
  const isAsk = level.side === 'ask'
  const backgroundClass = isAsk ? 'bg-no/25 dark:bg-no/20' : 'bg-yes/25 dark:bg-yes/20'
  const hoverClass = isAsk ? 'hover:bg-no/10' : 'hover:bg-yes/10'
  const priceClass = isAsk ? 'text-no' : 'text-yes'
  const widthPercent = maxTotal > 0 ? (level.total / maxTotal) * 100 : 0
  const barWidth = Math.min(100, Math.max(8, widthPercent))

  return (
    <div
      className={
        `
          relative grid h-9 cursor-pointer grid-cols-[40%_20%_20%_20%] items-center pr-4 pl-0 transition-colors
          ${hoverClass}
        `
      }
      onClick={() => onSelect?.(level)}
    >
      <div className="flex h-full items-center">
        <div className="relative size-full overflow-hidden">
          <div
            className={`absolute inset-0 left-0 ${backgroundClass}`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
      </div>
      <div className="flex h-full items-center justify-center px-4">
        <div className="flex items-center gap-1">
          <div className="flex size-5 items-center justify-center">
            {userOrder && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      if (!isCancelling) {
                        onCancelUserOrder?.(userOrder.id)
                      }
                    }}
                    disabled={isCancelling}
                    className={cn(
                      'group inline-flex size-5 items-center justify-center text-base transition-colors',
                      userOrder.side === 'ask' ? 'text-no' : 'text-yes',
                      isCancelling && 'cursor-not-allowed opacity-60',
                    )}
                  >
                    {isCancelling
                      ? <Loader2Icon className="size-3 animate-spin" />
                      : (
                          <>
                            <Clock4Icon className="size-3 group-hover:hidden" />
                            <CircleXIcon className="hidden size-3 group-hover:block" />
                          </>
                        )}
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="left"
                  className="w-48 p-3 text-left"
                >
                  <div className="flex items-center justify-between text-sm font-semibold">
                    <span>Filled</span>
                    <span>
                      {formatTooltipShares(userOrder.filledShares)}
                      {' '}
                      /
                      {' '}
                      {formatTooltipShares(userOrder.totalShares)}
                    </span>
                  </div>
                  <div
                    className={cn(
                      'mt-2 h-1.5 w-full overflow-hidden rounded-full',
                      userOrder.side === 'ask' ? 'bg-no/10' : 'bg-yes/10',
                    )}
                  >
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        userOrder.side === 'ask' ? 'bg-no' : 'bg-yes',
                      )}
                      style={{ width: `${Math.min(100, Math.max(0, (userOrder.filledShares / userOrder.totalShares) * 100))}%` }}
                    />
                  </div>
                  <div className="mt-2 text-xs font-medium text-muted-foreground">
                    {formatTooltipShares(Math.max(userOrder.totalShares - userOrder.filledShares, 0))}
                    {' '}
                    remaining
                  </div>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <span className={`text-sm font-medium ${priceClass}`}>
            {formatOrderBookPrice(level.priceCents)}
          </span>
        </div>
      </div>
      <div className="flex h-full items-center justify-center px-2 sm:px-3">
        <span className="text-sm font-medium text-foreground">
          {formatSharesLabel(level.shares)}
        </span>
      </div>
      <div className="flex h-full items-center justify-center px-2 sm:px-3">
        <span className="text-sm font-medium text-foreground">
          {usdFormatter.format(level.total)}
        </span>
      </div>
      {showBadge && (
        <span
          className={
            `
              absolute top-1/2 left-2 -translate-y-1/2 rounded-sm px-1.5 py-0.5 text-2xs font-semibold uppercase
              sm:left-3
              ${showBadge === 'ask' ? 'bg-no text-white' : 'bg-yes text-white'}
            `
          }
        >
          {showBadge === 'ask' ? 'Asks' : 'Bids'}
        </span>
      )}
    </div>
  )
}
