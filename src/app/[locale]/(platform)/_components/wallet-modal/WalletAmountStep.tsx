'use client'

import { ArrowRightIcon } from 'lucide-react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { formatDisplayAmount, getAmountSizeClass, MAX_AMOUNT_INPUT, sanitizeNumericInput } from '@/lib/amount-input'
import { formatAmountInputValue } from '@/lib/formatters'
import { cn } from '@/lib/utils'

function WalletAmountStep({
  onContinue,
  selectedTokenSymbol,
  availableTokenAmount,
  amountValue,
  onAmountChange,
}: {
  onContinue: () => void
  selectedTokenSymbol?: string | null
  availableTokenAmount?: number | null
  amountValue: string
  onAmountChange: (value: string) => void
}) {
  const hasAvailableTokenAmount = typeof availableTokenAmount === 'number' && Number.isFinite(availableTokenAmount)

  function handleInputChange(rawValue: string) {
    const cleaned = sanitizeNumericInput(rawValue)
    const numericValue = Number.parseFloat(cleaned)

    if (cleaned === '' || Number.isNaN(numericValue) || numericValue <= MAX_AMOUNT_INPUT) {
      onAmountChange(cleaned)
    }
  }

  function handleBlur(rawValue: string) {
    const cleaned = sanitizeNumericInput(rawValue)
    const numeric = Number.parseFloat(cleaned)

    if (!cleaned || Number.isNaN(numeric)) {
      onAmountChange('')
      return
    }

    const clampedValue = Math.min(numeric, MAX_AMOUNT_INPUT)
    onAmountChange(formatAmountInputValue(clampedValue))
  }

  function handleQuickFill(label: string) {
    if (!hasAvailableTokenAmount) {
      return
    }

    const baseValue = Math.min(availableTokenAmount ?? 0, MAX_AMOUNT_INPUT)

    if (label === 'Max') {
      onAmountChange(formatAmountInputValue(baseValue, { roundingMode: 'floor' }))
      return
    }

    const percentValue = Number.parseInt(label.replace('%', ''), 10) / 100
    const nextValue = baseValue * percentValue
    onAmountChange(formatAmountInputValue(nextValue))
  }

  const amountNumber = Number.parseFloat(amountValue || '0')
  const isAmountExceedingBalance = hasAvailableTokenAmount && amountNumber > (availableTokenAmount ?? 0)
  const isAmountInvalid = !amountValue.trim() || !Number.isFinite(amountNumber) || amountNumber <= 0
  const availableTokenLabel = hasAvailableTokenAmount
    ? (availableTokenAmount as number).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })
    : null
  const amountSizeClass = getAmountSizeClass(amountValue, {
    large: 'text-6xl',
    medium: 'text-5xl',
    small: 'text-4xl',
  })
  const inputValue = formatDisplayAmount(amountValue)
  const quickLabels = ['25%', '50%', '75%', 'Max']
  const placeholderText = '0.00'
  const minChWidth = placeholderText.length + 1

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center gap-2 text-center">
        <input
          type="text"
          inputMode="decimal"
          value={inputValue}
          onChange={(event) => {
            handleInputChange(event.target.value)
          }}
          onBlur={(event) => {
            handleBlur(event.target.value)
          }}
          placeholder={placeholderText}
          className={cn(`
            min-h-[1.2em] bg-transparent pb-1 text-center leading-tight font-semibold text-foreground outline-none
            placeholder:leading-tight
            ${amountSizeClass}
          `)}
          style={{ width: `${Math.max(inputValue.length, minChWidth)}ch`, maxWidth: '70vw' }}
        />
        {selectedTokenSymbol && (
          <span className="pb-1 text-xl/tight font-semibold text-muted-foreground">
            {selectedTokenSymbol}
          </span>
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {quickLabels.map(label => (
          <button
            key={label}
            type="button"
            className={cn('rounded-md bg-muted/60 px-4 py-2 text-sm text-foreground transition hover:bg-muted', { 'cursor-not-allowed opacity-50': !hasAvailableTokenAmount })}
            disabled={!hasAvailableTokenAmount}
            onClick={() => handleQuickFill(label)}
          >
            {label}
          </button>
        ))}
      </div>
      {isAmountExceedingBalance && (
        <p className="text-center text-sm font-medium text-destructive">
          Amount exceeds the available balance
          {selectedTokenSymbol ? ` for ${selectedTokenSymbol}` : ''}
          {availableTokenLabel ? ` (${availableTokenLabel} ${selectedTokenSymbol ?? ''})` : ''}
          .
        </p>
      )}
      <div className="flex items-center justify-center">
        <div className="flex items-center gap-3 rounded-full bg-muted/60 px-4 py-2">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Image
                src="/images/deposit/transfer/polygon_dark.png"
                alt="POL"
                width={30}
                height={30}
                className="rounded-full"
              />
              <span className="absolute -right-1 -bottom-1 rounded-full bg-background p-0.5">
                <Image
                  src="/images/deposit/transfer/polygon_dark.png"
                  alt="Polygon"
                  width={14}
                  height={14}
                  className="rounded-full"
                />
              </span>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">You send</p>
              <p className="text-sm font-semibold text-foreground">{selectedTokenSymbol ?? 'Token'}</p>
            </div>
          </div>
          <ArrowRightIcon className="size-4 text-muted-foreground" />
          <div className="flex items-center gap-3">
            <div className="relative">
              <Image
                src="/images/deposit/transfer/usdc_dark.png"
                alt="USDC"
                width={30}
                height={30}
                className="rounded-full"
              />
              <span className="absolute -right-1 -bottom-1 rounded-full bg-background p-0.5">
                <Image
                  src="/images/deposit/transfer/polygon_dark.png"
                  alt="Polygon"
                  width={14}
                  height={14}
                  className="rounded-full"
                />
              </span>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">You receive</p>
              <p className="text-sm font-semibold text-foreground">USDC</p>
            </div>
          </div>
        </div>
      </div>
      <Button
        type="button"
        className="h-12 w-full"
        onClick={onContinue}
        disabled={isAmountExceedingBalance || isAmountInvalid}
      >
        Continue
      </Button>
    </div>
  )
}

export default WalletAmountStep
