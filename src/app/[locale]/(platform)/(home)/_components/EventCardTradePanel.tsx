import type { SelectedOutcome } from '@/types/EventCardTypes'
import { DollarSignIcon, GripVerticalIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { Button } from '@/components/ui/button'
import { useOutcomeLabel } from '@/hooks/useOutcomeLabel'
import { MAX_AMOUNT_INPUT, sanitizeNumericInput } from '@/lib/amount-input'
import { formatAmountInputValue } from '@/lib/formatters'
import { cn } from '@/lib/utils'

interface EventCardTradePanelProps {
  activeOutcome: SelectedOutcome
  formattedTradeAmount: string
  amountNumber: number
  availableBalance: number
  isLoading: boolean
  canValidateBalance: boolean
  isSingleMarket: boolean
  toWinLabel: string
  onAmountChange: (value: string) => void
  onConfirmTrade: (mouseEvent?: MouseEvent) => void
  onCancelTrade: () => void
}

export default function EventCardTradePanel({
  activeOutcome,
  formattedTradeAmount,
  amountNumber,
  availableBalance,
  isLoading,
  canValidateBalance,
  isSingleMarket: _isSingleMarket,
  toWinLabel,
  onAmountChange,
  onConfirmTrade,
  onCancelTrade,
}: EventCardTradePanelProps) {
  const t = useExtracted()
  const normalizeOutcomeLabel = useOutcomeLabel()
  const buyButtonClassName = activeOutcome.variant === 'yes'
    ? 'bg-yes-foreground text-white hover:bg-yes-foreground/90 dark:bg-yes dark:hover:bg-yes/90'
    : 'bg-no-foreground text-white hover:bg-no-foreground/90 dark:bg-no dark:hover:bg-no/90'
  const sliderMax = canValidateBalance
    ? Math.min(MAX_AMOUNT_INPUT, Math.max(availableBalance, 0))
    : MAX_AMOUNT_INPUT
  const sliderValue = sliderMax > 0
    ? Math.min(Math.max(amountNumber, 0), sliderMax)
    : 0
  const sliderPercent = sliderMax > 0
    ? Math.min(100, Math.max(0, (sliderValue / sliderMax) * 100))
    : 0

  function handleTradeAmountInputChange(rawValue: string) {
    const cleaned = sanitizeNumericInput(rawValue)

    if (cleaned === '') {
      onAmountChange('')
      return
    }

    const numericValue = Number.parseFloat(cleaned)
    if (Number.isNaN(numericValue)) {
      onAmountChange('')
      return
    }

    if (numericValue > MAX_AMOUNT_INPUT) {
      return
    }

    onAmountChange(cleaned)
  }

  function handleSliderChange(rawValue: string) {
    const numericValue = Number.parseFloat(rawValue)
    if (!Number.isFinite(numericValue)) {
      return
    }
    onAmountChange(formatAmountInputValue(numericValue))
  }

  function handleQuickAdd(delta: number) {
    const nextValue = Math.min(MAX_AMOUNT_INPUT, Math.max(0, amountNumber + delta))
    onAmountChange(formatAmountInputValue(nextValue))
  }

  return (
    <div className="flex-1 space-y-3">
      <div className="grid grid-cols-5 gap-4">
        <div
          className={
            cn(`
              relative col-span-3 flex items-center gap-0 rounded-md border px-2 py-2.5 transition-colors
              ${amountNumber > availableBalance ? 'border-red-500' : 'border-border/70'}
              bg-background
              focus-within:border-border focus-within:ring-0
            `)
          }
        >
          <DollarSignIcon className="size-3 text-foreground" />
          <input
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={formattedTradeAmount}
            onChange={event => handleTradeAmountInputChange(event.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && amountNumber > 0) {
                e.preventDefault()
                onConfirmTrade()
              }
              else if (e.key === 'Escape') {
                e.preventDefault()
                onCancelTrade()
              }
            }}
            className={
              `
                w-full min-w-0 [appearance:textfield] bg-transparent pr-9 text-sm font-medium text-foreground
                placeholder:text-muted-foreground
                focus:outline-none
                [&::-webkit-inner-spin-button]:appearance-none
                [&::-webkit-outer-spin-button]:appearance-none
              `
            }
            onClick={e => e.stopPropagation()}
            autoFocus
          />
          <div className="absolute top-1/2 right-1.5 flex -translate-y-1/2 items-center gap-0.5">
            <button
              type="button"
              className={`
                h-6 rounded-sm bg-muted px-0.5 text-xs leading-none font-medium text-muted-foreground transition-colors
                hover:text-foreground
              `}
              onClick={() => handleQuickAdd(1)}
            >
              +1
            </button>
            <button
              type="button"
              className={`
                h-6 rounded-sm bg-muted px-0.5 text-xs leading-none font-medium text-muted-foreground transition-colors
                hover:text-foreground
              `}
              onClick={() => handleQuickAdd(10)}
            >
              +10
            </button>
          </div>
        </div>

        <div className="relative col-span-2 flex items-center">
          <div className="relative h-2 w-full rounded-full bg-border/60">
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                width: `${sliderPercent}%`,
                background: 'linear-gradient(90deg, #7dd3fc 0%, #a855f7 100%)',
              }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2"
              style={{ left: `${sliderPercent}%` }}
            >
              <div className="flex size-6 -translate-x-1/2 items-center justify-center rounded-full bg-white shadow-sm">
                <GripVerticalIcon className="size-3 text-muted-foreground" />
              </div>
            </div>
          </div>
          <input
            type="range"
            min="0"
            max={sliderMax}
            step="0.01"
            value={sliderValue}
            onChange={event => handleSliderChange(event.target.value)}
            className="absolute inset-0 h-6 w-full cursor-pointer opacity-0"
            disabled={sliderMax <= 0}
            aria-label="Trade amount slider"
          />
        </div>
      </div>

      <Button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onConfirmTrade(e.nativeEvent)
        }}
        disabled={
          isLoading
          || amountNumber <= 0
          || (canValidateBalance && amountNumber > availableBalance)
        }
        size="outcomeLg"
        variant={activeOutcome.variant}
        className={`w-full text-white *:text-white ${buyButtonClassName}`}
      >
        {isLoading
          ? (
              <div className="flex items-center justify-center gap-2">
                <div
                  className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                >
                </div>
                <span>Processing...</span>
              </div>
            )
          : (
              <div className="line-clamp-3 text-center text-xs">
                <div className="text-sm font-bold">
                  {t('Buy')}
                  {' '}
                  {normalizeOutcomeLabel(activeOutcome.outcome.outcome_text) ?? activeOutcome.outcome.outcome_text}
                </div>
                <div className="text-xs opacity-90">
                  To win $
                  {toWinLabel}
                </div>
              </div>
            )}
      </Button>
    </div>
  )
}
