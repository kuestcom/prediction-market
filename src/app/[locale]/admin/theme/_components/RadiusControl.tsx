'use client'

import { RotateCcw } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useMemo } from 'react'
import { DEFAULT_RADIUS_VALUE, getRadiusPresetButtonStyle, parseRadiusPixels, RADIUS_PRESETS } from '@/app/[locale]/admin/theme/_components/admin-theme-utils'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function RadiusControl({
  radiusValue,
  disabled,
  onRadiusChange,
  onRadiusReset,
  error,
}: {
  radiusValue: string
  disabled: boolean
  onRadiusChange: (radius: string) => void
  onRadiusReset: () => void
  error: string | null
}) {
  const t = useExtracted()
  const normalizedRadius = radiusValue.trim()
  const effectiveRadius = normalizedRadius || DEFAULT_RADIUS_VALUE
  const selectedPresetValue = useMemo(() => {
    const normalizedPreset = parseRadiusPixels(effectiveRadius)
    if (normalizedPreset === null) {
      return null
    }

    const matchedPreset = RADIUS_PRESETS.find((preset) => {
      const presetPixels = parseRadiusPixels(preset.value)
      return presetPixels !== null && Math.abs(presetPixels - normalizedPreset) < 0.5
    })

    return matchedPreset?.value ?? null
  }, [effectiveRadius])

  return (
    <div className="grid gap-3 rounded-md border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="grid gap-0.5">
          <h3 className="text-sm font-semibold">{t('Corner roundness')}</h3>
          <p className="text-xs text-muted-foreground">
            {t('Adjust how rounded buttons, cards, and inputs look.')}
          </p>
        </div>
        <button
          type="button"
          onClick={onRadiusReset}
          disabled={disabled || !normalizedRadius}
          className={cn(`
            text-muted-foreground transition
            hover:text-foreground
            disabled:cursor-not-allowed disabled:opacity-40
          `)}
          title={t('Use default')}
          aria-label={t('Use default roundness')}
        >
          <RotateCcw className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {RADIUS_PRESETS.map(preset => (
          <Button
            key={preset.value}
            type="button"
            size="sm"
            variant={selectedPresetValue === preset.value ? 'default' : 'outline'}
            onClick={() => onRadiusChange(preset.value)}
            disabled={disabled}
            className="h-11 justify-center"
            style={getRadiusPresetButtonStyle(preset.value)}
          >
            {preset.id === 'sharp'
              ? t('Sharp')
              : preset.id === 'soft'
                ? t('Soft')
                : t('Round')}
          </Button>
        ))}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

export default RadiusControl
