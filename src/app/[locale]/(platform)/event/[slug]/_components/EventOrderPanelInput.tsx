import type { RefObject } from 'react'
import type { OrderSide } from '@/types'
import { useExtracted, useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDisplayAmount, getAmountSizeClass, MAX_AMOUNT_INPUT, sanitizeNumericInput } from '@/lib/amount-input'
import { ORDER_SIDE } from '@/lib/constants'
import { formatAmountInputValue } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { usePortfolioValueVisibility } from '@/stores/usePortfolioValueVisibility'

interface BalanceSummary {
  raw: number
  text: string
  symbol?: string
}

interface EventOrderPanelInputProps {
  isMobile: boolean
  side: OrderSide
  amount: string
  amountNumber: number
  availableShares: number
  balance: BalanceSummary
  isBalanceLoading?: boolean
  inputRef: RefObject<HTMLInputElement | null>
  onAmountChange: (value: string) => void
  shouldShake?: boolean
}

const BUY_CHIPS_DESKTOP = ['+$5', '+$25', '+$100']
const BUY_CHIPS_MOBILE = ['+$1', '+$20', '+$100']

export default function EventOrderPanelInput({
  isMobile,
  side,
  amount,
  amountNumber,
  availableShares,
  balance,
  isBalanceLoading = false,
  inputRef,
  onAmountChange,
  shouldShake,
}: EventOrderPanelInputProps) {
  const t = useExtracted()
  const areValuesHidden = usePortfolioValueVisibility(state => state.isHidden)

  function focusInput() {
    inputRef?.current?.focus()
  }

  function handleInputChange(rawValue: string) {
    const cleaned = sanitizeNumericInput(rawValue)

    if (side === ORDER_SIDE.SELL) {
      onAmountChange(cleaned)
      return
    }

    const numericValue = Number.parseFloat(cleaned)

    if (cleaned === '' || numericValue <= MAX_AMOUNT_INPUT) {
      onAmountChange(cleaned)
    }
  }

  function handleBlur(value: string) {
    const cleaned = sanitizeNumericInput(value)
    const numeric = Number.parseFloat(cleaned)

    if (!cleaned || Number.isNaN(numeric)) {
      onAmountChange('')
      return
    }

    const clampedValue = side === ORDER_SIDE.SELL
      ? numeric
      : Math.min(numeric, MAX_AMOUNT_INPUT)

    onAmountChange(formatAmountInputValue(clampedValue))
  }

  function incrementAmount(delta: number) {
    const nextValue = amountNumber + delta

    if (side === ORDER_SIDE.SELL) {
      onAmountChange(formatAmountInputValue(nextValue))
      return
    }

    const limitedValue = Math.min(nextValue, MAX_AMOUNT_INPUT)
    onAmountChange(formatAmountInputValue(limitedValue))
  }

  function decrementAmount(delta: number) {
    const nextValue = Math.max(0, amountNumber - delta)
    onAmountChange(formatAmountInputValue(nextValue))
  }

  function handleBalanceClick() {
    if (side === ORDER_SIDE.SELL) {
      return
    }

    const maxBalance = Number.isFinite(balance.raw) ? balance.raw : 0
    const limitedBalance = Math.min(maxBalance, MAX_AMOUNT_INPUT)
    onAmountChange(formatAmountInputValue(limitedBalance, { roundingMode: 'floor' }))
    focusInput()
  }

  function renderActionButtons() {
    if (side === ORDER_SIDE.SELL) {
      const isDisabled = availableShares <= 0
      return ['25%', '50%', '75%'].map(percentage => (
        <Button
          type="button"
          key={percentage}
          size="sm"
          variant="outline"
          className={cn(
            'text-xs',
            isDisabled && 'cursor-not-allowed opacity-50',
          )}
          disabled={isDisabled}
          onClick={() => {
            if (isDisabled) {
              return
            }

            const percentValue = Number.parseInt(percentage.replace('%', ''), 10) / 100
            const newValue = availableShares * percentValue
            onAmountChange(formatAmountInputValue(newValue))
            focusInput()
          }}
        >
          {percentage}
        </Button>
      ))
    }

    const chipValues = isMobile ? BUY_CHIPS_MOBILE : BUY_CHIPS_DESKTOP
    return chipValues.map(chip => (
      <Button
        type="button"
        key={chip}
        size="sm"
        variant="outline"
        className="text-xs"
        onClick={() => {
          const chipValue = Number.parseInt(chip.substring(2), 10)
          const newValue = amountNumber + chipValue

          const limitedValue = Math.min(newValue, MAX_AMOUNT_INPUT)
          onAmountChange(formatAmountInputValue(limitedValue))
          focusInput()
        }}
      >
        {chip}
      </Button>
    ))
  }

  const locale = useLocale()
  const amountSizeClass = getAmountSizeClass(amount)
  const formattedBalanceText = Number.isFinite(balance.raw)
    ? balance.raw.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0.00'

  const formattedAmount = formatDisplayAmount(amount)
  const inputValue = side === ORDER_SIDE.SELL
    ? formattedAmount
    : formattedAmount ? `$${formattedAmount}` : ''
  return (
    <>
      {isMobile
        ? (
            <div className="mb-4">
              <div className="mb-4 flex items-center justify-center gap-4">
                <Button
                  type="button"
                  onClick={() => decrementAmount(side === ORDER_SIDE.SELL ? 0.1 : 1)}
                  size="icon"
                  variant="ghost"
                >
                  −
                </Button>
                <div className="flex-1 text-center">
                  <input
                    ref={inputRef}
                    type="text"
                    className={cn(
                      `
                        w-full [appearance:textfield] border-0 bg-transparent text-center font-semibold text-foreground
                        placeholder-muted-foreground outline-hidden
                        [&::-webkit-inner-spin-button]:appearance-none
                        [&::-webkit-outer-spin-button]:appearance-none
                      `,
                      amountSizeClass,
                      shouldShake && 'animate-order-shake',
                    )}
                    placeholder={side === ORDER_SIDE.SELL ? '0' : '$0'}
                    value={inputValue}
                    onChange={e => handleInputChange(e.target.value)}
                    onBlur={e => handleBlur(e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  onClick={() => incrementAmount(side === ORDER_SIDE.SELL ? 0.1 : 1)}
                  size="icon"
                  variant="ghost"
                >
                  +
                </Button>
              </div>
            </div>
          )
        : (
            <div className="mb-2 flex items-center gap-3">
              <div className="shrink-0">
                <div className="text-lg font-medium">
                  {side === ORDER_SIDE.SELL ? t('Shares') : t('Amount')}
                </div>
                <div className="text-xs text-muted-foreground">
                  {side === ORDER_SIDE.SELL
                    ? null
                    : isBalanceLoading
                      ? <Skeleton className="inline-block h-3 w-16 align-middle" />
                      : (
                          <button
                            type="button"
                            className={`
                              cursor-pointer bg-transparent p-0 text-left transition-colors
                              hover:text-foreground
                            `}
                            onClick={handleBalanceClick}
                          >
                            {t('Balance')}
                            {' '}
                            {areValuesHidden ? '****' : `$${formattedBalanceText}`}
                          </button>
                        )}
                </div>
              </div>
              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  type="text"
                  className={cn(
                    `
                      h-14 w-full [appearance:textfield] border-0 bg-transparent text-right font-semibold text-slate-700
                      placeholder-slate-400 outline-hidden
                      dark:text-slate-300 dark:placeholder-slate-500
                      [&::-webkit-inner-spin-button]:appearance-none
                      [&::-webkit-outer-spin-button]:appearance-none
                    `,
                    amountSizeClass,
                    shouldShake && 'animate-order-shake',
                  )}
                  placeholder={side === ORDER_SIDE.SELL ? '0' : '$0'}
                  value={inputValue}
                  onChange={e => handleInputChange(e.target.value)}
                  onBlur={e => handleBlur(e.target.value)}
                />
              </div>
            </div>
          )}

      <div
        className={cn(
          'mb-3 flex gap-2',
          isMobile ? 'justify-center' : 'justify-end',
        )}
      >
        {renderActionButtons()}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={cn(
            'text-xs',
            side === ORDER_SIDE.SELL && availableShares <= 0 && 'cursor-not-allowed opacity-50',
          )}
          disabled={side === ORDER_SIDE.SELL && availableShares <= 0}
          onClick={() => {
            if (side === ORDER_SIDE.SELL) {
              if (availableShares <= 0) {
                return
              }
              onAmountChange(formatAmountInputValue(availableShares, { roundingMode: 'floor' }))
            }
            else {
              const maxBalance = balance.raw
              const limitedBalance = Math.min(maxBalance, MAX_AMOUNT_INPUT)
              onAmountChange(formatAmountInputValue(limitedBalance, { roundingMode: 'floor' }))
            }
            focusInput()
          }}
        >
          {t('Max')}
        </Button>
      </div>
    </>
  )
}
