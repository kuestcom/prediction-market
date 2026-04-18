'use client'

import type { ThemeOverrides, ThemeToken } from '@/lib/theme'
import { ChevronDown } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useMemo, useState } from 'react'
import { resolveBaseThemeValues, TOKEN_GROUPS } from '@/app/[locale]/admin/theme/_components/admin-theme-utils'
import ColorPickerSwatch from '@/app/[locale]/admin/theme/_components/ColorPickerSwatch'
import { cn } from '@/lib/utils'

function ThemeTokenMatrix({
  presetId,
  lightOverrides,
  darkOverrides,
  onLightChange,
  onDarkChange,
  onLightReset,
  onDarkReset,
  disabled,
  lightParseError,
  darkParseError,
}: {
  presetId: string
  lightOverrides: ThemeOverrides
  darkOverrides: ThemeOverrides
  onLightChange: (token: ThemeToken, value: string) => void
  onDarkChange: (token: ThemeToken, value: string) => void
  onLightReset: (token: ThemeToken) => void
  onDarkReset: (token: ThemeToken) => void
  disabled: boolean
  lightParseError: string | null
  darkParseError: string | null
}) {
  const t = useExtracted()
  const { lightValues: baseLightValues, darkValues: baseDarkValues } = useMemo(
    () => resolveBaseThemeValues(presetId),
    [presetId],
  )
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initialState: Record<string, boolean> = {}
    TOKEN_GROUPS.forEach((group) => {
      initialState[group.id] = group.id === 'core'
    })
    return initialState
  })

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold">{t('Theme tokens')}</h3>
        {(lightParseError || darkParseError) && (
          <div className="grid gap-1 text-xs text-destructive">
            {lightParseError && (
              <p>
                {t('Light overrides:')}
                {lightParseError}
              </p>
            )}
            {darkParseError && (
              <p>
                {t('Dark overrides:')}
                {darkParseError}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2">
          {TOKEN_GROUPS.map((group) => {
            const isOpen = openGroups[group.id]

            return (
              <div key={group.id} className="overflow-hidden rounded-md border border-border">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={`theme-group-${group.id}`}
                  onClick={() => {
                    setOpenGroups(prev => ({ ...prev, [group.id]: !isOpen }))
                  }}
                  className={cn(
                    `
                      flex h-12 w-full items-center justify-between px-3 text-left text-base font-medium text-foreground
                      transition-colors
                      hover:bg-muted/50
                      focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
                      focus-visible:ring-offset-background focus-visible:outline-none
                    `,
                    { 'border-b border-border/40': isOpen },
                  )}
                >
                  <span className="leading-tight">
                    {group.id === 'core'
                      ? t('Core surfaces')
                      : group.id === 'brand'
                        ? t('Brand + accents')
                        : group.id === 'outcomes'
                          ? t('Outcome + alerts')
                          : t('Chart palette')}
                  </span>
                  <ChevronDown
                    className={cn('size-5 text-muted-foreground transition-transform', { 'rotate-180': isOpen })}
                  />
                </button>
                {isOpen && (
                  <div id={`theme-group-${group.id}`} className="p-2">
                    <div className="grid gap-1">
                      <div className={`
                        grid grid-cols-[minmax(0,1fr)_3.5rem_3.5rem] items-center gap-2 px-2 text-2xs
                        text-muted-foreground uppercase
                      `}
                      >
                        <span>{t('Token')}</span>
                        <span className="text-left">{t('Light')}</span>
                        <span className="text-left">{t('Dark')}</span>
                      </div>
                      <div className="grid gap-1.5">
                        {group.tokens.map((token) => {
                          const lightOverride = lightOverrides[token]
                          const darkOverride = darkOverrides[token]
                          const lightValue = lightOverride ?? baseLightValues[token]
                          const darkValue = darkOverride ?? baseDarkValues[token]

                          return (
                            <div
                              key={token}
                              className={`
                                grid grid-cols-[minmax(0,1fr)_3.5rem_3.5rem] items-center gap-2 rounded-md border
                                border-border px-2 py-1.5
                              `}
                            >
                              <code className="text-xs font-medium text-foreground">{token}</code>
                              <ColorPickerSwatch
                                presetId={presetId}
                                value={lightValue}
                                label={t('{token} light color', { token })}
                                disabled={disabled}
                                onChange={value => onLightChange(token, value)}
                                onReset={() => onLightReset(token)}
                                showReset={Boolean(lightOverride)}
                              />
                              <ColorPickerSwatch
                                presetId={presetId}
                                value={darkValue}
                                label={t('{token} dark color', { token })}
                                disabled={disabled}
                                onChange={value => onDarkChange(token, value)}
                                onReset={() => onDarkReset(token)}
                                showReset={Boolean(darkOverride)}
                              />
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default ThemeTokenMatrix
