import { MinusIcon, PlusIcon } from 'lucide-react'
import * as React from 'react'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

function formatNumberInputValue(value: number) {
  if (!Number.isFinite(value) || value === 0) {
    return ''
  }

  return value.toFixed(1).replace(/\.0$/, '')
}

export function NumberInput({
  value,
  onChange,
  step = 0.1,
}: {
  value: number
  onChange: (val: number) => void
  step?: number
}) {
  const MAX = 99.9
  const [isEditing, setIsEditing] = useState(false)
  const [inputValue, setInputValue] = useState<string>(() => formatNumberInputValue(value))

  const displayValue = isEditing ? inputValue : formatNumberInputValue(value)

  const inputRef = useRef<HTMLInputElement>(null)
  const hasValue = displayValue.trim() !== ''
  const inputSize = displayValue.trim() ? Math.max(displayValue.length, 1) : 3

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target
    const raw = input.value
    const selectionStart = input.selectionStart ?? raw.length
    const prev = displayValue
    const dotIndex = prev.indexOf('.')
    const isDelete = prev.length > raw.length

    if (
      dotIndex !== -1
      && selectionStart > dotIndex + 1
      && !isDelete
    ) {
      setInputValue(prev)
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.setSelectionRange(selectionStart - 1, selectionStart - 1)
        }
      }, 0)
      return
    }

    const rawDigits = raw.replace(/\D/g, '')
    let formatted = ''
    if (!rawDigits) {
      formatted = ''
    }
    else if (rawDigits.length === 1) {
      formatted = rawDigits
    }
    else if (rawDigits.length === 2) {
      formatted = rawDigits
    }
    else if (rawDigits.length >= 3) {
      const before = rawDigits.slice(-3, -1)
      const after = rawDigits.slice(-1)
      formatted = `${before}.${after}`
    }
    if (formatted && !Number.isNaN(Number(formatted)) && Number(formatted) > MAX) {
      setInputValue(MAX.toFixed(1))
      onChange(MAX)
      return
    }
    setInputValue(formatted)
  }

  function commitInput(val: string) {
    const num = Number.parseFloat(val)
    let clamped = num
    if (!Number.isNaN(num)) {
      clamped = Math.min(num, MAX)
      onChange(Number(clamped.toFixed(1)))
    }
    else {
      onChange(0)
    }
    setInputValue(formatNumberInputValue(clamped))
  }

  function handleStep(delta: number) {
    let newValue = Number((value + delta).toFixed(1))
    newValue = Math.max(0, Math.min(newValue, MAX))
    onChange(newValue)
    setInputValue(formatNumberInputValue(newValue))
  }

  return (
    <div className="flex w-1/2 items-center rounded-md border">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-10 rounded-none rounded-l-sm border-none px-2"
        onClick={() => handleStep(-step)}
      >
        <MinusIcon className="size-4" />
      </Button>

      <div className="flex flex-1 items-center justify-center">
        <Input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={displayValue}
          onFocus={() => {
            setInputValue(formatNumberInputValue(value))
            setIsEditing(true)
          }}
          onChange={handleInputChange}
          onBlur={() => {
            commitInput(displayValue)
            setIsEditing(false)
          }}
          maxLength={5}
          placeholder="0.0"
          className={`
            h-10 w-auto rounded-none border-none bg-transparent! px-0 text-right text-lg! font-bold shadow-none
            focus-visible:ring-0 focus-visible:ring-offset-0
          `}
          style={{ width: `${inputSize}ch` }}
        />
        <span
          className={cn(`text-lg font-bold ${hasValue ? 'text-foreground' : 'text-muted-foreground'}`)}
        >
          ¢
        </span>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-10 rounded-none rounded-r-sm border-none px-2"
        onClick={() => handleStep(step)}
      >
        <PlusIcon className="size-4" />
      </Button>
    </div>
  )
}
