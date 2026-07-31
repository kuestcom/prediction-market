import { NumberField } from '@base-ui/react/number-field'
import { MinusIcon, PlusIcon } from 'lucide-react'
import { useRef } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const MIN_PRICE_CENTS = 0.1
const MAX_PRICE_CENTS = 99.9

interface NumberInputProps {
  value: number
  onChange: (value: number) => void
  ariaLabel: string
  step?: number
}

function parsePredictionPriceInput(rawValue: string) {
  const digits = rawValue.replace(/\D/g, '')

  if (!digits) {
    return 0
  }

  if (digits.length <= 2) {
    return Number(digits)
  }

  const priceDigits = digits.slice(-3)
  return Number(`${priceDigits.slice(0, -1)}.${priceDigits.slice(-1)}`)
}

function formatPredictionPrice(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return ''
  }

  return value.toFixed(1).replace(/\.0$/, '')
}

export function NumberInput({ value, onChange, ariaLabel, step = 0.1 }: NumberInputProps) {
  const displayValue = formatPredictionPrice(value)
  const hasNormalizedInputRef = useRef(false)

  function handleValueChange(nextValue: number | null, details: NumberField.Root.ChangeEventDetails) {
    if (details.reason === 'input-change' || details.reason === 'input-paste') {
      const input = details.event.target as HTMLInputElement | null
      const rawValue = input?.value ?? ''
      details.cancel()
      hasNormalizedInputRef.current = true
      onChange(/[.,]\d{2,}$/.test(rawValue) ? value : parsePredictionPriceInput(rawValue))
      return
    }

    if (details.reason === 'input-blur' && hasNormalizedInputRef.current) {
      details.cancel()
      hasNormalizedInputRef.current = false
      return
    }

    if (details.reason === 'keyboard' && hasNormalizedInputRef.current && details.direction !== undefined) {
      details.cancel()
      hasNormalizedInputRef.current = false
      onChange(Math.max(MIN_PRICE_CENTS, Math.min(value + details.direction * step, MAX_PRICE_CENTS)))
      return
    }

    if (
      (details.reason === 'increment-press' || details.reason === 'decrement-press') &&
      hasNormalizedInputRef.current &&
      details.direction === undefined
    ) {
      details.cancel()
      return
    }

    hasNormalizedInputRef.current = false
    onChange(nextValue ?? 0)
  }

  return (
    <NumberField.Root
      value={value > 0 ? value : null}
      onValueChange={handleValueChange}
      min={MIN_PRICE_CENTS}
      max={MAX_PRICE_CENTS}
      step={step}
      smallStep={step}
      largeStep={1}
      snapOnStep
      format={{ maximumFractionDigits: 1 }}
      className="w-1/2"
    >
      <NumberField.Group className="flex w-full items-center rounded-md border">
        <NumberField.Decrement
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 rounded-none rounded-l-sm border-none px-2"
              aria-label={`${ariaLabel} − ${step}¢`}
            />
          }
        >
          <MinusIcon />
        </NumberField.Decrement>

        <div className="flex flex-1 items-center justify-center">
          <NumberField.Input
            render={(props) => <input {...props} value={displayValue} />}
            aria-label={ariaLabel}
            placeholder="0.0"
            className={cn(
              `peer h-10 min-w-0 rounded-none border-none bg-transparent px-0 text-right text-lg font-bold shadow-none outline-none placeholder:text-muted-foreground focus-visible:ring-0 disabled:pointer-events-none disabled:opacity-50`,
            )}
            style={{ width: `${displayValue ? Math.max(displayValue.length, 1) : 3}ch` }}
          />
          <span className="text-lg font-bold text-muted-foreground peer-data-filled:text-foreground">¢</span>
        </div>

        <NumberField.Increment
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 rounded-none rounded-r-sm border-none px-2"
              aria-label={`${ariaLabel} + ${step}¢`}
            />
          }
        >
          <PlusIcon />
        </NumberField.Increment>
      </NumberField.Group>
    </NumberField.Root>
  )
}
