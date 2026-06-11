import type { RefObject } from 'react'
import type { LimitExpirationOption } from '@/lib/orders/expiration'
import type { OrderSide } from '@/types'
import { ChevronDownIcon, InfoIcon, TriangleAlertIcon } from 'lucide-react'
import { useExtracted, useLocale } from 'next-intl'
import Image from 'next/image'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import EventLimitExpirationCalendar from '@/app/[locale]/(platform)/event/[slug]/_components/EventLimitExpirationCalendar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { NumberInput } from '@/components/ui/number-input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useBalance } from '@/hooks/useBalance'
import { useIsMobile } from '@/hooks/useIsMobile'
import { formatDisplayAmount, getAmountSizeClass, MAX_AMOUNT_INPUT, sanitizeNumericInput } from '@/lib/amount-input'
import { ORDER_SIDE } from '@/lib/constants'
import { formatAmountInputValue, formatCurrency, formatDollarValueLabel, formatSharesLabel } from '@/lib/formatters'
import { MIN_LIMIT_ORDER_SHARES } from '@/lib/orders/validation'
import { cn } from '@/lib/utils'
import { usePortfolioValueVisibility } from '@/stores/usePortfolioValueVisibility'

const QUICK_BUTTON_CLASS = `
  h-8 rounded-md bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground transition-colors
  hover:bg-muted/80
`

const BUY_CHIPS = [-100, -10, 10, 100]

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function resolveDraftExpirationFromNow() {
  const nextDate = new Date(Date.now())
  nextDate.setMinutes(nextDate.getMinutes() + 30, 0, 0)
  return nextDate
}

interface EventOrderPanelLimitControlsProps {
  side: OrderSide
  limitPrice: string
  limitShares: string
  limitExpirationOption: LimitExpirationOption
  limitExpirationTimestamp: number | null
  isLimitOrder: boolean
  matchingShares?: number | null
  availableShares: number
  showLimitMinimumWarning: boolean
  shouldShakeShares?: boolean
  limitSharesRef?: RefObject<HTMLInputElement | null>
  onLimitPriceChange: (value: string) => void
  onLimitSharesChange: (value: string) => void
  onLimitExpirationOptionChange: (value: LimitExpirationOption) => void
  onLimitExpirationTimestampChange: (value: number | null) => void
  onAmountUpdateFromLimit: (value: string) => void
}

function useLimitControlsDerived(limitPrice: string, limitShares: string, side: OrderSide) {
  const limitPriceNumber = useMemo(
    () => Number.parseFloat(limitPrice) || 0,
    [limitPrice],
  )

  const limitSharesNumber = useMemo(
    () => Number.parseFloat(limitShares) || 0,
    [limitShares],
  )

  const totalValue = useMemo(() => {
    const total = (limitPriceNumber * limitSharesNumber) / 100
    return Number.isFinite(total) ? total : 0
  }, [limitPriceNumber, limitSharesNumber])

  const potentialWin = useMemo(() => {
    if (limitSharesNumber <= 0) {
      return 0
    }

    if (side === ORDER_SIDE.SELL) {
      const total = (limitPriceNumber * limitSharesNumber) / 100
      return Number.isFinite(total) ? total : 0
    }

    return Number.isFinite(limitSharesNumber) ? limitSharesNumber : 0
  }, [limitPriceNumber, limitSharesNumber, side])

  return { limitPriceNumber, limitSharesNumber, totalValue, potentialWin }
}

function useExpirationModal(limitExpirationTimestamp: number | null, locale: string) {
  const [isExpirationModalOpen, setIsExpirationModalOpen] = useState(false)
  const [draftExpiration, setDraftExpiration] = useState<Date | null>(null)
  const customExpirationLabel = useMemo(() => {
    if (!limitExpirationTimestamp) {
      return null
    }
    const date = new Date(limitExpirationTimestamp * 1000)
    return date.toLocaleString(locale, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }, [limitExpirationTimestamp, locale])

  return { isExpirationModalOpen, setIsExpirationModalOpen, draftExpiration, setDraftExpiration, customExpirationLabel }
}

export default function EventOrderPanelLimitControls({
  side,
  limitPrice,
  limitShares,
  limitExpirationOption,
  limitExpirationTimestamp,
  isLimitOrder,
  matchingShares,
  availableShares,
  showLimitMinimumWarning,
  shouldShakeShares,
  limitSharesRef,
  onLimitPriceChange,
  onLimitSharesChange,
  onLimitExpirationOptionChange,
  onLimitExpirationTimestampChange,
  onAmountUpdateFromLimit,
}: EventOrderPanelLimitControlsProps) {
  const t = useExtracted()
  const isMobile = useIsMobile()
  const { balance } = useBalance()
  const areValuesHidden = usePortfolioValueVisibility(state => state.isHidden)
  const { limitPriceNumber, limitSharesNumber, totalValue, potentialWin } = useLimitControlsDerived(limitPrice, limitShares, side)

  const effectivePriceDollars = Number.isFinite(limitPriceNumber) && limitPriceNumber > 0
    ? limitPriceNumber / 100
    : null
  const decimalOdds = effectivePriceDollars ? 1 / effectivePriceDollars : null
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

  const maxSharesForSide = MAX_AMOUNT_INPUT

  const locale = useLocale()
  const totalValueLabel = formatDollarValueLabel(totalValue, { fallback: '0¢' })
  const safeTotalValueLabel = totalValueLabel.trim() ? totalValueLabel : '0'
  const americanOddsLabel = americanOdds != null
    ? `${americanOdds >= 0 ? '+' : ''}${americanOdds.toFixed(1)}`
    : '0'
  const decimalOddsLabel = decimalOdds != null ? decimalOdds.toFixed(3) : '0'
  const potentialWinLabel = formatCurrency(potentialWin)
  const showMinimumSharesWarning = showLimitMinimumWarning && isLimitOrder && limitSharesNumber < MIN_LIMIT_ORDER_SHARES
  const formattedBalanceText = Number.isFinite(balance?.raw)
    ? (balance?.raw ?? 0).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0.00'
  const maxLabel = t('Max')
  const matchingSharesLabel = matchingShares && matchingShares > 0
    ? formatSharesLabel(matchingShares)
    : null
  const [isExpirationMenuOpen, setIsExpirationMenuOpen] = useState(false)
  const { isExpirationModalOpen, setIsExpirationModalOpen, draftExpiration, setDraftExpiration, customExpirationLabel } = useExpirationModal(limitExpirationTimestamp, locale)
  const expirationOptions = useMemo(() => [
    { value: 'never' as const, label: t('Never') },
    { value: '5m' as const, label: '5m' },
    { value: '1h' as const, label: '1h' },
    { value: '12h' as const, label: '12h' },
    { value: '24h' as const, label: '24h' },
    { value: 'end-of-day' as const, label: t('End of day') },
    { value: 'custom' as const, label: t('Custom') },
  ], [t])
  const selectedExpirationLabel = useMemo(() => {
    switch (limitExpirationOption) {
      case 'never':
        return t('Never')
      case 'end-of-day':
        return t('End of day')
      case 'custom':
        return customExpirationLabel ?? t('Custom')
      default:
        return limitExpirationOption
    }
  }, [customExpirationLabel, limitExpirationOption, t])

  function syncAmount(priceValue: number, sharesValue: number) {
    if (!isLimitOrder) {
      return
    }

    const nextAmount = (priceValue * sharesValue) / 100
    onAmountUpdateFromLimit(formatAmountInputValue(nextAmount))
  }

  function handleLimitSharesInputChange(rawValue: string) {
    const cleaned = sanitizeNumericInput(rawValue)

    if (cleaned === '') {
      onLimitSharesChange('')
      syncAmount(limitPriceNumber, 0)
      return
    }

    const numericValue = Number.parseFloat(cleaned)
    if (Number.isNaN(numericValue)) {
      onLimitSharesChange('')
      syncAmount(limitPriceNumber, 0)
      return
    }

    if (numericValue > maxSharesForSide) {
      const clamped = Math.min(numericValue, maxSharesForSide)
      onLimitSharesChange(formatAmountInputValue(clamped))
      syncAmount(limitPriceNumber, clamped)
      return
    }

    // Preserve the raw decimal typing state (e.g. `1.`) and normalize on blur.
    onLimitSharesChange(cleaned)
    syncAmount(limitPriceNumber, numericValue)
  }

  function handleLimitSharesBlur(rawValue: string) {
    const cleaned = sanitizeNumericInput(rawValue)
    const numericValue = Number.parseFloat(cleaned)

    if (!cleaned || Number.isNaN(numericValue)) {
      onLimitSharesChange('')
      syncAmount(limitPriceNumber, 0)
      return
    }

    const clamped = Math.min(numericValue, maxSharesForSide)
    onLimitSharesChange(formatAmountInputValue(clamped))
    syncAmount(limitPriceNumber, clamped)
  }

  function updateLimitPrice(nextValue: number) {
    const clampedValue = clamp(Number.isNaN(nextValue) ? 0 : nextValue, 0, 99.9)
    const nextPrice = clampedValue.toFixed(1)
    onLimitPriceChange(nextPrice)
    syncAmount(clampedValue, Number.parseFloat(limitShares) || 0)
  }

  function updateLimitShares(nextValue: number, roundingMode: 'round' | 'floor' = 'round') {
    const numericValue = Number.isNaN(nextValue) ? 0 : nextValue
    const clampedValue = clamp(numericValue, 0, maxSharesForSide)
    onLimitSharesChange(formatAmountInputValue(clampedValue, { roundingMode }))
    syncAmount(Number.parseFloat(limitPrice) || 0, clampedValue)
  }

  const formattedLimitShares = formatDisplayAmount(limitShares)
  const limitSharesSizeClass = getAmountSizeClass(limitShares, {
    large: 'text-lg',
    medium: 'text-base',
    small: 'text-sm',
  })

  function resolveInitialDraftExpiration() {
    if (limitExpirationTimestamp) {
      const currentExpiration = new Date(limitExpirationTimestamp * 1000)
      if (currentExpiration.getTime() > Date.now()) {
        return currentExpiration
      }
    }

    return resolveDraftExpirationFromNow()
  }

  function openExpirationModal() {
    setDraftExpiration(resolveInitialDraftExpiration())
    setIsExpirationModalOpen(true)
  }

  function handleExpirationModalChange(open: boolean) {
    setIsExpirationModalOpen(open)
  }

  function handleApplyExpiration() {
    if (!draftExpiration) {
      return
    }

    if (draftExpiration.getTime() <= Date.now()) {
      toast.error(t('Expiration must be in future. Try again'))
      return
    }

    const timestampSeconds = Math.floor(draftExpiration.getTime() / 1000)
    onLimitExpirationOptionChange('custom')
    onLimitExpirationTimestampChange(timestampSeconds)
    setIsExpirationModalOpen(false)
  }

  function handleExpirationOptionSelect(nextOption: LimitExpirationOption) {
    setIsExpirationMenuOpen(false)

    if (nextOption === 'custom') {
      openExpirationModal()
      return
    }

    onLimitExpirationOptionChange(nextOption)
  }

  return (
    <div className="mt-4 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-lg font-medium text-foreground">
            {t('Limit Price')}
          </span>
          {isLimitOrder && side === ORDER_SIDE.BUY && (
            <span className="text-xs text-muted-foreground">
              {t('Balance')}
              {' '}
              {areValuesHidden ? '****' : `$${formattedBalanceText}`}
            </span>
          )}
        </div>

        <NumberInput
          value={limitPriceNumber}
          onChange={updateLimitPrice}
        />
      </div>

      <div className="my-4 border-b border-border" />

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <span
            className={cn(
              'text-lg font-medium text-foreground',
              { 'animate-order-shake': shouldShakeShares },
            )}
          >
            {t('Shares')}
          </span>
          <div className="flex w-1/2 items-center justify-end gap-2">
            <Input
              ref={limitSharesRef}
              placeholder="0"
              inputMode="decimal"
              value={formattedLimitShares}
              onChange={event => handleLimitSharesInputChange(event.target.value)}
              onBlur={event => handleLimitSharesBlur(event.target.value)}
              className={cn(
                'h-10 bg-transparent! text-right font-bold',
                limitSharesSizeClass,
                { 'animate-order-shake': shouldShakeShares },
              )}
            />
          </div>
        </div>
        {side === ORDER_SIDE.SELL
          ? (
              <div className="ml-auto flex h-8 w-1/2 justify-end gap-2">
                {['25%', '50%', 'max'].map((value) => {
                  const label = value === 'max' ? maxLabel : value
                  return (
                    <button
                      type="button"
                      key={value}
                      className={QUICK_BUTTON_CLASS}
                      onClick={() => {
                        if (availableShares <= 0) {
                          return
                        }

                        if (value === 'max') {
                          updateLimitShares(availableShares, 'floor')
                          return
                        }

                        const percent = Number.parseInt(label.replace('%', ''), 10) / 100
                        const calculatedShares = Number.parseFloat((availableShares * percent).toFixed(2))
                        updateLimitShares(calculatedShares)
                      }}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            )
          : (
              <div className="ml-auto flex h-8 w-1/2 justify-end gap-2">
                {BUY_CHIPS.map((chip) => {
                  const label = chip > 0 ? `+${chip}` : `${chip}`
                  return (
                    <Button
                      type="button"
                      key={chip}
                      size="sm"
                      variant="outline"
                      className="px-2 text-xs"
                      onClick={() => updateLimitShares(limitSharesNumber + chip)}
                    >
                      {label}
                    </Button>
                  )
                })}
              </div>
            )}
        {matchingSharesLabel && (
          <div className="mt-2 ml-auto flex w-1/2 justify-end">
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className={cn(`
                    inline-flex items-center gap-1 rounded-md bg-yes/15 p-1 text-xs font-semibold text-yes-foreground
                    transition-colors
                  `)}
                >
                  <InfoIcon className="size-3" aria-hidden />
                  <span>{t('{shares} matching', { shares: matchingSharesLabel })}</span>
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-48" side="bottom">
                {t('{shares} shares from this order will be executed immediatelly', { shares: matchingSharesLabel })}
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>

      <div className="my-4 border-b border-border" />

      <div className="mt-4 space-y-4">
        <div className="flex items-center justify-between text-sm font-semibold text-muted-foreground">
          <span>{t('Expires')}</span>
          <DropdownMenu open={isExpirationMenuOpen} onOpenChange={setIsExpirationMenuOpen} modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(`
                  group flex max-w-40 cursor-pointer items-center gap-1 bg-transparent text-sm font-semibold
                  text-muted-foreground transition-colors duration-200
                  focus:outline-none
                  focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none
                `, { 'text-foreground': isExpirationMenuOpen })}
                aria-haspopup="menu"
                aria-expanded={isExpirationMenuOpen}
              >
                <span className="truncate text-right">{selectedExpirationLabel}</span>
                <ChevronDownIcon
                  className={cn(
                    `size-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180`,
                    { 'text-foreground': isExpirationMenuOpen },
                  )}
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-fit" portalled={false}>
              {expirationOptions.map(({ value, label }) => {
                const isSelected = value === limitExpirationOption
                return (
                  <DropdownMenuItem
                    key={value}
                    className={cn('cursor-pointer', { 'font-semibold text-foreground': isSelected })}
                    onSelect={() => handleExpirationOptionSelect(value)}
                  >
                    <span>{label}</span>
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="mt-4 space-y-1">
        {side === ORDER_SIDE.SELL
          ? (
              <div className="flex items-center justify-between text-lg font-bold text-foreground">
                <span>{t('You\'ll receive')}</span>
                <span className="inline-flex items-center gap-2 text-xl font-bold text-yes">
                  <Image
                    src="/images/trade/money.svg"
                    alt=""
                    width={20}
                    height={14}
                    className="h-4 w-6"
                  />
                  {potentialWinLabel}
                </span>
              </div>
            )
          : (
              <>
                <div className="flex items-center justify-between text-lg font-bold text-foreground">
                  <span>{t('Total')}</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="border-b border-dotted border-primary font-semibold text-primary">
                        {safeTotalValueLabel}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      className="w-52 p-3"
                    >
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="h-4 w-1.5 rounded-full bg-blue-500" />
                            <span>{t('Price')}</span>
                          </div>
                          <span className="text-base font-bold">
                            {limitPriceNumber.toFixed(1)}
                            ¢
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="h-4 w-1.5 rounded-full bg-amber-400" />
                            <span>{t('American')}</span>
                          </div>
                          <span className="text-base font-bold">
                            {americanOddsLabel}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="h-4 w-1.5 rounded-full bg-yes" />
                            <span>{t('Decimal')}</span>
                          </div>
                          <span className="text-base font-bold">
                            {decimalOddsLabel}
                          </span>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="flex items-center justify-between text-lg font-bold">
                  <span className="flex items-center gap-2 text-foreground">
                    {t('To win')}
                    <Image
                      src="/images/trade/money.svg"
                      alt=""
                      width={20}
                      height={14}
                      className="h-4 w-6"
                    />
                  </span>
                  <span className="text-xl font-bold text-yes">
                    {potentialWinLabel}
                  </span>
                </div>
              </>
            )}
      </div>
      {showMinimumSharesWarning && (
        <div className="flex items-center justify-center gap-2 pt-2 text-sm font-semibold text-orange-500">
          <TriangleAlertIcon className="size-4" />
          {t('Minimum {min} shares for limit orders', { min: MIN_LIMIT_ORDER_SHARES.toString() })}
        </div>
      )}

      {isMobile
        ? (
            <Drawer open={isExpirationModalOpen} onOpenChange={handleExpirationModalChange}>
              <DrawerContent className="max-h-[90vh] w-full bg-background px-4 pt-4 pb-6">
                <DrawerHeader className="space-y-2 p-0 text-left">
                  <DrawerTitle>{t('Select expiration')}</DrawerTitle>
                </DrawerHeader>
                {isExpirationModalOpen && (
                  <EventLimitExpirationCalendar
                    className="max-w-none min-w-0 border-0 shadow-none"
                    value={draftExpiration ?? undefined}
                    onChange={(nextDate) => {
                      if (nextDate) {
                        setDraftExpiration(nextDate)
                      }
                    }}
                    onCancel={() => setIsExpirationModalOpen(false)}
                    onApply={handleApplyExpiration}
                  />
                )}
              </DrawerContent>
            </Drawer>
          )
        : (
            <Dialog open={isExpirationModalOpen} onOpenChange={handleExpirationModalChange}>
              <DialogContent className="w-fit border-0 bg-transparent p-0 shadow-none">
                {isExpirationModalOpen && (
                  <EventLimitExpirationCalendar
                    title={t('Select expiration')}
                    value={draftExpiration ?? undefined}
                    onChange={(nextDate) => {
                      if (nextDate) {
                        setDraftExpiration(nextDate)
                      }
                    }}
                    onCancel={() => setIsExpirationModalOpen(false)}
                    onApply={handleApplyExpiration}
                  />
                )}
              </DialogContent>
            </Dialog>
          )}
    </div>
  )
}
