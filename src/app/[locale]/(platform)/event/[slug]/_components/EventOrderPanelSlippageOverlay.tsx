import type { OrderSide } from '@/types'
import { TriangleAlert } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useId } from 'react'
import { Button } from '@/components/ui/button'
import { ORDER_SIDE } from '@/lib/constants'
import { formatCentsLabel, formatCurrency, formatSharesLabel } from '@/lib/formatters'
import { cn } from '@/lib/utils'

interface EventOrderPanelSlippageOverlayProps {
  side: OrderSide
  avgPriceCents: number
  filledShares: number
  totalValue: number
  isSubmitting: boolean
  onConfirm: () => void
  onEdit: () => void
}

export default function EventOrderPanelSlippageOverlay({
  side,
  avgPriceCents,
  filledShares,
  totalValue,
  isSubmitting,
  onConfirm,
  onEdit,
}: EventOrderPanelSlippageOverlayProps) {
  const t = useExtracted()
  const titleId = useId()
  const isSell = side === ORDER_SIDE.SELL
  const rows = [
    {
      label: t('Avg'),
      value: formatCentsLabel(avgPriceCents, { fallback: '—' }),
    },
    {
      label: t('Shares'),
      value: formatSharesLabel(filledShares, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    },
    {
      label: isSell ? t('Receive') : t('Cost'),
      value: formatCurrency(totalValue),
    },
  ]

  return (
    <div
      className={cn(`
        relative z-30 col-start-1 row-start-1 flex min-h-full items-center justify-center rounded-xl bg-card/85 p-4
        backdrop-blur-md backdrop-saturate-150
      `)}
      role="dialog"
      aria-labelledby={titleId}
    >
      <div className="grid w-full max-w-[18rem] gap-5">
        <div className="grid justify-items-center gap-4">
          <h2 id={titleId} className="text-center text-xl font-semibold text-foreground">
            {t('Major Price Slippage')}
          </h2>

          <div className="flex size-24 items-center justify-center rounded-full bg-muted">
            <TriangleAlert className="size-11 text-orange-500" strokeWidth={2.25} aria-hidden="true" />
          </div>

          <p className="text-center text-sm font-medium text-foreground">
            {t('Major price change due to order size')}
          </p>
        </div>

        <div className="grid overflow-hidden">
          {rows.map((row, index) => (
            <div
              key={row.label}
              className={cn(
                'flex items-center justify-between gap-4 py-3 text-sm',
                index > 0 && 'border-t border-muted',
              )}
            >
              <span className="font-medium text-muted-foreground">{row.label}</span>
              <span className="font-semibold text-foreground">{row.value}</span>
            </div>
          ))}
        </div>

        <div className="grid gap-3">
          <Button
            type="button"
            className="h-12 w-full rounded-md text-base font-semibold"
            disabled={isSubmitting}
            onClick={onConfirm}
          >
            {isSell ? t('Confirm Sell') : t('Confirm Buy')}
          </Button>
          <Button
            type="button"
            className="h-12 w-full rounded-md bg-muted text-base font-semibold text-foreground hover:bg-muted/80"
            disabled={isSubmitting}
            onClick={onEdit}
          >
            {t('Edit Order')}
          </Button>
        </div>
      </div>
    </div>
  )
}
