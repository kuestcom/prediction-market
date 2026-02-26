'use client'

import type { NormalizedBookLevel } from '@/lib/order-panel-utils'
import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Drawer, DrawerContent } from '@/components/ui/drawer'
import { useIsMobile } from '@/hooks/useIsMobile'
import { ORDER_SIDE } from '@/lib/constants'
import { formatCentsLabel, formatCurrency, formatSharesLabel } from '@/lib/formatters'
import { calculateMarketFill } from '@/lib/order-panel-utils'
import { cn } from '@/lib/utils'

interface SellPositionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  outcomeLabel: string
  outcomeShortLabel: string
  outcomeIconUrl?: string | null
  fallbackIconUrl?: string | null
  shares: number
  filledShares: number | null
  avgPriceCents: number | null
  receiveAmount: number | null
  sellBids?: NormalizedBookLevel[]
  onCashOut: (shares: number) => void
  onEditOrder: (shares: number) => void
  onSharesChange?: (shares: number) => void
}

export default function SellPositionModal({
  open,
  onOpenChange,
  outcomeLabel,
  outcomeShortLabel,
  outcomeIconUrl,
  fallbackIconUrl,
  shares,
  filledShares,
  avgPriceCents,
  receiveAmount,
  sellBids = [],
  onCashOut,
  onEditOrder,
  onSharesChange,
}: SellPositionModalProps) {
  const progressStops = [0, 25, 50, 75, 100]
  const isMobile = useIsMobile()
  const [sellPercent, setSellPercent] = useState(100)

  useEffect(() => {
    if (open) {
      setSellPercent(100)
    }
  }, [open])

  const iconUrl = outcomeIconUrl || fallbackIconUrl || ''
  const safeShares = Number.isFinite(shares) ? shares : 0
  const safeFilledShares = Number.isFinite(filledShares) ? filledShares : null
  const selectedShares = useMemo(() => {
    if (!(safeShares > 0) || sellPercent <= 0) {
      return 0
    }
    const scaled = Number(((safeShares * sellPercent) / 100).toFixed(4))
    return Number.isFinite(scaled) && scaled > 0 ? scaled : 0
  }, [safeShares, sellPercent])

  useEffect(() => {
    if (!open) {
      return
    }
    onSharesChange?.(selectedShares)
  }, [onSharesChange, open, selectedShares])

  const sellPreview = useMemo(() => {
    if (!(selectedShares > 0)) {
      return {
        filledShares: 0,
        avgPriceCents: 0,
        receiveAmount: 0,
      }
    }

    if (sellBids.length > 0) {
      const fill = calculateMarketFill(ORDER_SIDE.SELL, selectedShares, sellBids, [])
      return {
        filledShares: fill.filledShares,
        avgPriceCents: fill.avgPriceCents ?? null,
        receiveAmount: fill.totalCost,
      }
    }

    const fallbackFilledShares = safeFilledShares != null ? Math.min(safeFilledShares, selectedShares) : selectedShares
    const ratio = safeShares > 0 ? selectedShares / safeShares : 0
    const fallbackReceive = typeof receiveAmount === 'number' && Number.isFinite(receiveAmount)
      ? Number((receiveAmount * ratio).toFixed(4))
      : 0
    const fallbackAvgPriceCents = typeof avgPriceCents === 'number' && Number.isFinite(avgPriceCents)
      ? avgPriceCents
      : null

    return {
      filledShares: fallbackFilledShares,
      avgPriceCents: fallbackAvgPriceCents,
      receiveAmount: fallbackReceive,
    }
  }, [avgPriceCents, receiveAmount, safeFilledShares, safeShares, selectedShares, sellBids])

  const hasPartialFill = sellPreview.filledShares > 0 && sellPreview.filledShares + 1e-6 < selectedShares
  const sharesLabel = formatSharesLabel(selectedShares)
  const filledSharesLabel = formatSharesLabel(sellPreview.filledShares)
  const avgPriceDollars = typeof sellPreview.avgPriceCents === 'number' && Number.isFinite(sellPreview.avgPriceCents)
    ? sellPreview.avgPriceCents / 100
    : null
  const avgPriceLabel = formatCentsLabel(avgPriceDollars, { fallback: selectedShares <= 0 ? '0¢' : '—' })
  const receiveLabel = formatCurrency(sellPreview.receiveAmount, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  const canCashOut = sellPreview.filledShares > 0 && sellPreview.receiveAmount > 0

  const body = (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        {iconUrl
          ? (
              <Image
                src={iconUrl}
                alt={outcomeLabel}
                width={64}
                height={64}
                className="size-16 rounded-md object-cover"
              />
            )
          : (
              <div className={`
                flex size-16 items-center justify-center rounded-md bg-muted text-sm font-semibold text-muted-foreground
              `}
              >
                {outcomeLabel.slice(0, 1)}
              </div>
            )}
        <div className="min-w-0 text-left">
          <div className="text-xl font-semibold text-foreground">
            Sell
            {' '}
            {outcomeLabel}
          </div>
          <div className="line-clamp-2 text-sm text-muted-foreground">
            {outcomeShortLabel}
          </div>
        </div>
      </div>

      <div className="space-y-1 text-left">
        <div className="text-lg font-semibold text-foreground">
          Receive
          {' '}
          <span className="text-yes">{receiveLabel}</span>
        </div>
        <div className="text-sm text-muted-foreground">
          Selling
          {' '}
          {hasPartialFill ? `${filledSharesLabel} of ${sharesLabel}` : sharesLabel}
          {' '}
          shares @
          {' '}
          {avgPriceLabel}
        </div>
      </div>

      <div className="space-y-5">
        <div className="space-y-2 px-3">
          <div className="relative h-5 w-full">
            <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-muted-foreground" />
            <div
              className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-primary"
              style={{ width: `${sellPercent}%` }}
            />
            {progressStops.map((stop) => {
              const isFilled = sellPercent >= stop
              return (
                <span
                  key={stop}
                  className={cn(
                    'absolute top-1/2 block size-2 -translate-1/2 rounded-full',
                    isFilled ? 'bg-primary' : 'bg-muted-foreground',
                  )}
                  style={{ left: `${stop}%` }}
                />
              )
            })}
            <span
              className={`
                absolute top-1/2 block size-5 -translate-1/2 rounded-full border-2 border-primary bg-primary shadow-sm
              `}
              style={{ left: `${sellPercent}%` }}
            />
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={sellPercent}
              onInput={event => setSellPercent(Number(event.currentTarget.value))}
              aria-label="Sell percentage"
              className="absolute inset-0 size-full cursor-pointer opacity-0"
            />
          </div>
          <div className="relative h-4 text-xs font-semibold">
            {progressStops.map(stop => (
              <span
                key={`label-${stop}`}
                className={cn(
                  'absolute top-0 -translate-x-1/2',
                  sellPercent >= stop ? 'text-primary' : 'text-muted-foreground',
                )}
                style={{ left: `${stop}%` }}
              >
                {stop}
                %
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-11 border-border/70 bg-transparent text-sm font-semibold text-foreground hover:bg-muted/40"
            onClick={() => onEditOrder(selectedShares)}
          >
            Edit order
          </Button>
          <Button
            type="button"
            className="h-11 border-0 bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            onClick={() => onCashOut(selectedShares)}
            disabled={!canCashOut}
          >
            Cash out
            {' '}
            {receiveLabel}
          </Button>
        </div>
      </div>
    </div>
  )

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh] w-full bg-background px-4 pt-4 pb-6">
          {body}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-88 bg-background p-6">
        {body}
      </DialogContent>
    </Dialog>
  )
}
