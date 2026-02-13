import { MinusIcon, PlusIcon } from 'lucide-react'
import * as React from 'react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

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
  const initialString = value === 0 ? '' : value.toFixed(1).replace(/\.0$/, '')
  const [inputValue, setInputValue] = useState<string>(initialString)
  const inputRef = useRef<HTMLInputElement>(null)
  const hasValue = inputValue.trim() !== ''
  const inputSize = inputValue.trim() ? Math.max(inputValue.length, 1) : 3

  useEffect(() => {
    const newVal = value === 0 ? '' : value.toFixed(1).replace(/\.0$/, '')
    if (newVal !== inputValue) {
      setInputValue(newVal)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target
    const raw = input.value
    const selectionStart = input.selectionStart ?? raw.length
    const prev = inputValue
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
    if (!Number.isNaN(clamped) && clamped !== 0) {
      setInputValue(clamped.toFixed(1).replace(/\.0$/, ''))
    }
    else {
      setInputValue('')
    }
  }

  function handleBlur() {
    commitInput(inputValue)
  }

  function handleStep(delta: number) {
    let newValue = Number((value + delta).toFixed(1))
    newValue = Math.max(0, Math.min(newValue, MAX))
    onChange(newValue)
    if (newValue !== 0) {
      setInputValue(newValue.toFixed(1).replace(/\.0$/, ''))
    }
    else {
      setInputValue('')
    }
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
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleBlur}
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
