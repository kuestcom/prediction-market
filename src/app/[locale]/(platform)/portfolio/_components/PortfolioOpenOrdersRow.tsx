import type { Route } from 'next'
import type { PortfolioUserOpenOrder } from '@/app/[locale]/(platform)/portfolio/_types/PortfolioOpenOrdersTypes'
import { XIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import Image from 'next/image'
import {
  formatCents,
  formatExpirationLabel,
  getOrderFilledShares,
  getOrderTotalShares,
  microToUnit,
} from '@/app/[locale]/(platform)/portfolio/_utils/PortfolioOpenOrdersUtils'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useOutcomeLabel } from '@/hooks/useOutcomeLabel'
import { Link } from '@/i18n/navigation'
import { formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'

interface PortfolioOpenOrdersRowProps {
  order: PortfolioUserOpenOrder
}

export default function PortfolioOpenOrdersRow({ order }: PortfolioOpenOrdersRowProps) {
  const t = useExtracted()
  const normalizeOutcomeLabel = useOutcomeLabel()
  const totalShares = getOrderTotalShares(order)
  const filledShares = getOrderFilledShares(order)
  const totalValue = order.side === 'buy'
    ? microToUnit(order.maker_amount)
    : microToUnit(order.taker_amount)
  const filledLabel = `${filledShares.toLocaleString(undefined, { maximumFractionDigits: 3 })} / ${totalShares.toLocaleString(undefined, { maximumFractionDigits: 3 })}`
  const outcomeText = normalizeOutcomeLabel(order.outcome.text || (order.outcome.index === 0 ? 'Yes' : 'No'))
    || (order.outcome.index === 0 ? 'Yes' : 'No')
  const outcomeIsYes = order.outcome.index === 0
  const outcomeColor = outcomeIsYes ? 'bg-yes/15 text-yes' : 'bg-no/15 text-no'
  const priceLabel = formatCents(order.price)
  const expirationLabel = formatExpirationLabel(order)
  const marketIcon = order.market.icon_url || undefined
  const eventSlug = order.market.event_slug || order.market.slug
  const marketSlug = order.market.event_slug ? order.market.slug : null
  const eventHref = (marketSlug ? `/event/${eventSlug}/${marketSlug}` : `/event/${eventSlug}`) as Route

  return (
    <tr className="border-b transition-colors hover:bg-muted/50">
      <td className="max-w-0 px-2 py-3 sm:px-3">
        <div className="flex min-w-0 items-start gap-3">
          <Link
            href={eventHref}
            className="relative size-12 shrink-0 overflow-hidden rounded-sm bg-muted"
          >
            {marketIcon
              ? (
                  <Image
                    src={marketIcon}
                    alt={order.market.title}
                    fill
                    sizes="48px"
                    className="object-cover"
                  />
                )
              : (
                  <div className="grid size-full place-items-center text-2xs text-muted-foreground">
                    No image
                  </div>
                )}
          </Link>
          <div className="min-w-0 flex-1 space-y-1">
            <Link
              href={eventHref}
              className="block max-w-full truncate text-sm font-semibold underline-offset-2 hover:underline"
              title={order.market.title}
            >
              {order.market.title}
            </Link>
          </div>
        </div>
      </td>

      <td className="px-2 py-3 text-center text-sm font-semibold sm:px-3">
        {order.side === 'buy' ? t('Buy') : t('Sell')}
      </td>

      <td className="px-2 py-3 text-left text-sm font-semibold sm:px-3">
        <span className={cn('inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-sm font-semibold md:text-sm', outcomeColor)}>
          {outcomeText}
        </span>
      </td>

      <td className="px-2 py-3 text-center text-sm font-semibold sm:px-3">
        {priceLabel}
      </td>

      <td className="px-2 py-3 text-center text-sm font-semibold sm:px-3">
        {filledLabel}
      </td>

      <td className="px-2 py-3 text-center text-sm font-semibold sm:px-3">
        {formatCurrency(totalValue)}
      </td>

      <td className="px-2 py-3 text-left text-xs font-medium text-muted-foreground sm:px-3">
        {expirationLabel}
      </td>

      <td className="px-2 py-3 text-right sm:px-3">
        <div className="flex justify-end">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label="Cancel"
              >
                <XIcon className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Cancel</TooltipContent>
          </Tooltip>
        </div>
      </td>
    </tr>
  )
}
