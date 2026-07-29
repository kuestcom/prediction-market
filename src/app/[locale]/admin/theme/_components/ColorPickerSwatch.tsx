'use client'

import { RotateCcw } from 'lucide-react'
import { useExtracted } from 'next-intl'

import { COLOR_PICKER_FALLBACK, colorToHex } from '@/app/[locale]/admin/theme/_components/admin-theme-utils'

function ColorPickerSwatch({
  presetId,
  value,
  label,
  disabled,
  onChange,
  onReset,
  showReset,
}: {
  presetId: string
  value: string | undefined
  label: string
  disabled: boolean
  onChange: (value: string) => void
  onReset?: () => void
  showReset?: boolean
}) {
  const t = useExtracted()
  const pickerValue = colorToHex(value) ?? COLOR_PICKER_FALLBACK

  return (
    <div className="flex w-14 items-center justify-start gap-1">
      <div
        className="relative size-7 overflow-hidden rounded-md border border-border"
        style={{ backgroundColor: value ?? pickerValue }}
        data-theme-preset={presetId}
      >
        <input
          type="color"
          aria-label={label}
          value={pickerValue}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />
      </div>
      <div className="flex size-5 items-center justify-center">
        {showReset && onReset ? (
          <button
            type="button"
            onClick={onReset}
            disabled={disabled}
            className="text-muted-foreground transition hover:text-foreground"
            title={t('Reset')}
            aria-label={t('Reset color')}
          >
            <RotateCcw className="size-3" />
          </button>
        ) : (
          <span aria-hidden className="size-3" />
        )}
      </div>
    </div>
  )
}

export default ColorPickerSwatch
