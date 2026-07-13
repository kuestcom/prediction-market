import type { OrderSide } from '@/types'
import { InfoIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import Image from 'next/image'
import { useState } from 'react'
import { useKuestFeeRate } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useKuestFeeRate'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ORDER_SIDE } from '@/lib/constants'
import { formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'

interface EventOrderPanelEarningsProps {
  isMobile: boolean
  side: OrderSide
  sellAmountLabel: string
  avgSellPriceLabel: string
  avgBuyPriceLabel: string
  avgSellPriceCents: number | null
  avgBuyPriceCents: number | null
  buyPayout: number
  buyProfit: number
  buyChangePct: number
  buyMultiplier: number
  outcomeTokenId: string | null
  operatorFeeBps: number
  feeBaseAmount: number
}

export default function EventOrderPanelEarnings({
  isMobile,
  side,
  sellAmountLabel,
  avgSellPriceLabel,
  avgBuyPriceLabel,
  avgSellPriceCents,
  avgBuyPriceCents,
  buyPayout,
  buyProfit,
  buyChangePct,
  buyMultiplier,
  outcomeTokenId,
  operatorFeeBps,
  feeBaseAmount,
}: EventOrderPanelEarningsProps) {
  const t = useExtracted()
  const [isPriceTooltipOpen, setIsPriceTooltipOpen] = useState(false)
  const kuestFeeRateQuery = useKuestFeeRate(outcomeTokenId, { enabled: isPriceTooltipOpen })
  const buyToWinLabel = formatCurrency(Math.max(0, buyPayout))
  const buyProfitLabel = formatCurrency(buyProfit)
  const buyChangeLabel = `${buyChangePct >= 0 ? '+' : '-'}${Math.abs(buyChangePct).toFixed(0)}%`
  const buyMultiplierLabel = `${Math.max(0, buyMultiplier).toFixed(2)}x`

  const mobileEarningsLabel = side === ORDER_SIDE.SELL ? sellAmountLabel : buyToWinLabel
  const desktopEarningsLabel = side === ORDER_SIDE.SELL ? sellAmountLabel : buyToWinLabel
  const shouldShowMoneyIcon = true
  const effectivePriceCents = side === ORDER_SIDE.SELL ? avgSellPriceCents : avgBuyPriceCents
  const effectivePriceDollars = typeof effectivePriceCents === 'number' && Number.isFinite(effectivePriceCents)
    ? effectivePriceCents / 100
    : null
  const decimalOdds = effectivePriceDollars && effectivePriceDollars > 0 ? 1 / effectivePriceDollars : null
  const americanOdds = (() => {
    if (!decimalOdds || decimalOdds <= 0) {
      return null
    }
    if (decimalOdds === 1) {
      return null
    }
    if (decimalOdds >= 2) {
      return (decimalOdds - 1) * 100
    }
    return -100 / (decimalOdds - 1)
  })()
  const sellProfitLabel = formatCurrency(0)
  const sellChangeLabel = '+0%'
  const sellMultiplierLabel = decimalOdds != null ? `${decimalOdds.toFixed(3)}x` : '—'
  const totalFeeBps = kuestFeeRateQuery.data == null
    ? null
    : kuestFeeRateQuery.data + operatorFeeBps
  const totalFeeLabel = totalFeeBps == null
    ? '—'
    : formatCurrency(Math.max(0, feeBaseAmount) * totalFeeBps / 10_000)
  const avgPriceLabel = t('Avg. price {price}', {
    price: side === ORDER_SIDE.SELL ? avgSellPriceLabel : avgBuyPriceLabel,
  })

  function getWholeDigitCount(value: string) {
    const numericValue = Number.parseFloat(value.replace(/[^0-9.]/g, ''))
    if (!Number.isFinite(numericValue)) {
      return 1
    }
    const wholePart = Math.floor(Math.abs(numericValue))
    return Math.max(1, wholePart.toString().length)
  }

  const mobileDigitCount = getWholeDigitCount(mobileEarningsLabel)
  const desktopDigitCount = getWholeDigitCount(desktopEarningsLabel)
  const mobileEarningsClass = cn(
    'font-bold text-yes',
    mobileDigitCount >= 9 ? 'text-lg' : mobileDigitCount >= 7 ? 'text-xl' : 'text-2xl',
    side === ORDER_SIDE.SELL && 'inline-flex items-center justify-center gap-2',
  )
  const desktopEarningsClass = cn(
    'font-bold text-yes',
    desktopDigitCount >= 9 ? 'text-xl' : desktopDigitCount >= 7 ? 'text-2xl' : 'text-3xl',
    side === ORDER_SIDE.SELL && 'flex items-center gap-2',
  )

  return (
    <div className={cn(`${isMobile ? 'mb-4 text-center' : 'mb-4'}`)}>
      {!isMobile && <hr className="mb-3 border" />}
      <div className={cn('flex', isMobile ? 'flex-col' : 'items-center justify-between')}>
        <div className={cn({ 'mb-1': isMobile })}>
          <div className={cn(
            'flex items-center gap-1 font-bold text-foreground',
            isMobile ? 'justify-center text-lg' : 'text-sm',
          )}
          >
            {side === ORDER_SIDE.SELL ? t('You\'ll receive') : t('To win')}
            {shouldShowMoneyIcon && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex cursor-help items-center">
                    <Image
                      src="/images/trade/money.svg"
                      alt=""
                      width={20}
                      height={14}
                      className={cn(isMobile ? 'h-5 w-8' : 'ml-1 h-4 w-6')}
                    />
                  </span>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className={cn(`
                    w-52 border border-border bg-background px-4 py-3 text-sm font-semibold text-muted-foreground
                    shadow-xl
                  `)}
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <span>{t('Profit')}</span>
                      <span className="text-base font-bold text-yes">
                        {side === ORDER_SIDE.SELL
                          ? sellProfitLabel
                          : (buyProfit >= 0 ? `+${buyProfitLabel}` : buyProfitLabel)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>{t('Change')}</span>
                      <span className="text-base font-bold text-yes">
                        {side === ORDER_SIDE.SELL ? sellChangeLabel : buyChangeLabel}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>{t('Multiplier')}</span>
                      <span className="text-base font-bold text-yes">
                        {side === ORDER_SIDE.SELL ? sellMultiplierLabel : buyMultiplierLabel}
                      </span>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            )}
            {isMobile && (
              <span className={mobileEarningsClass}>
                {mobileEarningsLabel}
              </span>
            )}
          </div>
          <div
            className={cn(
              'text-muted-foreground',
              isMobile ? 'text-center text-sm' : 'text-xs',
            )}
          >
            <span>
              {avgPriceLabel}
            </span>
            {effectivePriceDollars && (
              <Tooltip open={isPriceTooltipOpen} onOpenChange={setIsPriceTooltipOpen}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      `
                        ml-1 inline-flex size-4 items-center justify-center rounded-sm text-muted-foreground
                        transition-colors
                      `,
                      'hover:text-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none',
                    )}
                  >
                    <InfoIcon className="size-3" aria-hidden />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className="w-56 overflow-hidden rounded-2xl border border-border bg-card p-0"
                >
                  <div className="flex flex-col gap-2 rounded-2xl border border-border bg-background px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span>{t('Price')}</span>
                      <span className="text-base font-bold">
                        {(effectivePriceCents ?? 0).toFixed(1)}
                        ¢
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>{t('American')}</span>
                      <span className="text-base font-bold">
                        {americanOdds != null ? `${americanOdds >= 0 ? '+' : ''}${americanOdds.toFixed(1)}` : '—'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>{t('Decimal')}</span>
                      <span className="text-base font-bold">
                        {decimalOdds != null ? `${decimalOdds.toFixed(3)}x` : '—'}
                      </span>
                    </div>
                  </div>
                  <div className="p-3 text-center text-xs font-semibold whitespace-nowrap text-muted-foreground">
                    {t('Price includes a fee of {fee}', { fee: totalFeeLabel })}
                  </div>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
        {!isMobile && (
          <div className={desktopEarningsClass}>{desktopEarningsLabel}</div>
        )}
      </div>
    </div>
  )
}
