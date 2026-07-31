'use client'

import { useExtracted } from 'next-intl'
import Form from 'next/form'
import { useActionState, useEffect, useMemo, useRef, useState } from 'react'

import type { AdminThemeSettingsFormProps } from '@/app/[locale]/admin/theme/_components/admin-theme-utils'
import type { ThemeOverrides } from '@/lib/theme'

import { updateThemeSettingsAction } from '@/app/[locale]/admin/theme/_actions/update-theme-settings'
import RadiusControl from '@/app/[locale]/admin/theme/_components/RadiusControl'
import ThemePreviewCard from '@/app/[locale]/admin/theme/_components/ThemePreviewCard'
import ThemeTokenMatrix from '@/app/[locale]/admin/theme/_components/ThemeTokenMatrix'
import { Button } from '@/components/ui/button'
import { InputError } from '@/components/ui/input-error'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/components/ui/toast'
import {
  buildThemeCssText,
  DEFAULT_THEME_PRESET_ID,
  formatThemeOverridesJson,
  parseThemeOverridesJson,
  validateThemePresetId,
  validateThemeRadius,
} from '@/lib/theme'

const initialState = {
  error: null,
}

function AdminThemeSettingsFormInner({
  presetOptions,
  initialThemeSettings,
  initialThemeSiteSettings,
}: AdminThemeSettingsFormProps) {
  const t = useExtracted()
  const initialPreset = initialThemeSettings.preset
  const initialRadius = initialThemeSettings.radius
  const initialLightJson = initialThemeSettings.lightJson
  const initialDarkJson = initialThemeSettings.darkJson
  const siteName = initialThemeSiteSettings.siteName
  const logoSvg = initialThemeSiteSettings.logoSvg
  const logoImageUrl = initialThemeSiteSettings.logoImageUrl

  const [state, formAction, isPending] = useActionState(updateThemeSettingsAction, initialState)
  const wasPendingRef = useRef(isPending)
  const persistedThemeRef = useRef<{ preset: string | null; cssText: string | null } | null>(null)

  const [preset, setPreset] = useState<string>(initialPreset)
  const [radius, setRadius] = useState(initialRadius)

  const initialLightParse = useMemo(
    () => parseThemeOverridesJson(initialLightJson, t('Light theme colors')),
    [initialLightJson, t],
  )
  const initialDarkParse = useMemo(
    () => parseThemeOverridesJson(initialDarkJson, t('Dark theme colors')),
    [initialDarkJson, t],
  )

  const [lightOverrides, setLightOverrides] = useState<ThemeOverrides>(initialLightParse.data ?? {})
  const [darkOverrides, setDarkOverrides] = useState<ThemeOverrides>(initialDarkParse.data ?? {})
  const parsedPreset = useMemo(() => validateThemePresetId(preset) ?? DEFAULT_THEME_PRESET_ID, [preset])
  const radiusValidation = useMemo(() => validateThemeRadius(radius, t('Corner roundness')), [radius, t])

  const lightJsonValue = useMemo(() => formatThemeOverridesJson(lightOverrides), [lightOverrides])

  const darkJsonValue = useMemo(() => formatThemeOverridesJson(darkOverrides), [darkOverrides])
  const draftCssText = useMemo(
    () => buildThemeCssText(lightOverrides, darkOverrides, radiusValidation.value),
    [darkOverrides, lightOverrides, radiusValidation.value],
  )

  function handlePresetChange(nextPreset: string) {
    setPreset(nextPreset)
    setLightOverrides({})
    setDarkOverrides({})
  }

  function applyThemeToDocument(nextPreset: string, cssText: string) {
    const rootElement = document.documentElement
    rootElement.setAttribute('data-theme-preset', nextPreset)

    const currentThemeStyle = document.getElementById('theme-vars')
    if (cssText) {
      const styleElement =
        currentThemeStyle instanceof HTMLStyleElement ? currentThemeStyle : document.createElement('style')

      styleElement.id = 'theme-vars'
      styleElement.textContent = cssText

      if (!currentThemeStyle) {
        document.body.prepend(styleElement)
      }
      return
    }

    if (currentThemeStyle) {
      currentThemeStyle.remove()
    }
  }

  useEffect(function capturePersistedTheme() {
    const rootElement = document.documentElement
    const currentThemeStyle = document.getElementById('theme-vars')

    persistedThemeRef.current = {
      preset: rootElement.getAttribute('data-theme-preset'),
      cssText: currentThemeStyle instanceof HTMLStyleElement ? (currentThemeStyle.textContent ?? '') : null,
    }

    return function restorePersistedTheme() {
      const persistedTheme = persistedThemeRef.current
      if (!persistedTheme) {
        return
      }

      if (persistedTheme.preset) {
        rootElement.setAttribute('data-theme-preset', persistedTheme.preset)
      } else {
        rootElement.removeAttribute('data-theme-preset')
      }

      const latestThemeStyle = document.getElementById('theme-vars')
      if (persistedTheme.cssText !== null) {
        const styleElement =
          latestThemeStyle instanceof HTMLStyleElement ? latestThemeStyle : document.createElement('style')

        styleElement.id = 'theme-vars'
        styleElement.textContent = persistedTheme.cssText

        if (!latestThemeStyle) {
          document.body.prepend(styleElement)
        }
      } else if (latestThemeStyle) {
        latestThemeStyle.remove()
      }
    }
  }, [])

  useEffect(
    function syncThemePreview() {
      applyThemeToDocument(parsedPreset, draftCssText)
    },
    [draftCssText, parsedPreset],
  )

  useEffect(
    function handleSubmitResult() {
      const transitionedToIdle = wasPendingRef.current && !isPending

      if (transitionedToIdle && state.error === null) {
        persistedThemeRef.current = {
          preset: parsedPreset,
          cssText: draftCssText || null,
        }

        toast.success(t('Theme settings updated successfully!'))
      } else if (transitionedToIdle && state.error) {
        toast.error(state.error)
      }

      wasPendingRef.current = isPending
    },
    [draftCssText, isPending, parsedPreset, state.error, t],
  )

  return (
    <Form action={formAction} className="grid gap-6 rounded-lg border p-6">
      <input type="hidden" name="preset" value={preset} />
      <input type="hidden" name="radius" value={radius} />
      <input type="hidden" name="light_json" value={lightJsonValue} />
      <input type="hidden" name="dark_json" value={darkJsonValue} />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="grid items-start gap-6 self-start">
          <div className="grid gap-2">
            <Label htmlFor="theme-preset">{t('Preset')}</Label>
            <Select
              items={presetOptions.map((option) => ({ label: option.label, value: option.id }))}
              value={preset}
              onValueChange={(value) => value !== null && handlePresetChange(value)}
              disabled={isPending}
            >
              <SelectTrigger id="theme-preset" className="h-12! w-full">
                <SelectValue placeholder={t('Select preset')} />
              </SelectTrigger>
              <SelectContent>
                {presetOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    <div className="grid gap-0.5 text-left">
                      <span>{option.label}</span>
                      <span className="text-xs text-muted-foreground">{option.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <RadiusControl
            radiusValue={radius}
            disabled={isPending}
            onRadiusChange={setRadius}
            onRadiusReset={() => setRadius('')}
            error={radiusValidation.error}
          />
          <ThemeTokenMatrix
            key={parsedPreset}
            presetId={parsedPreset}
            lightOverrides={lightOverrides}
            darkOverrides={darkOverrides}
            onLightChange={(token, value) => {
              setLightOverrides((prev) => ({ ...prev, [token]: value }))
            }}
            onDarkChange={(token, value) => {
              setDarkOverrides((prev) => ({ ...prev, [token]: value }))
            }}
            onLightReset={(token) => {
              setLightOverrides((prev) => {
                const next = { ...prev }
                delete next[token]
                return next
              })
            }}
            onDarkReset={(token) => {
              setDarkOverrides((prev) => {
                const next = { ...prev }
                delete next[token]
                return next
              })
            }}
            disabled={isPending}
            lightParseError={initialLightParse.error}
            darkParseError={initialDarkParse.error}
          />
          <Button type="submit" className="w-full" disabled={isPending || Boolean(radiusValidation.error)}>
            {isPending ? t('Saving...') : t('Save changes')}
          </Button>
        </div>

        <aside className="grid gap-2 lg:sticky lg:top-12 lg:self-start">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <h3 className="text-sm font-semibold">{t('Preview Light')}</h3>
              <ThemePreviewCard
                presetId={parsedPreset}
                isDark={false}
                overrides={lightOverrides}
                radius={radiusValidation.value}
                siteName={siteName}
                logoSvg={logoSvg}
                logoImageUrl={logoImageUrl}
              />
            </div>
            <div className="grid gap-2">
              <h3 className="text-sm font-semibold">{t('Preview Dark')}</h3>
              <ThemePreviewCard
                presetId={parsedPreset}
                isDark
                overrides={darkOverrides}
                radius={radiusValidation.value}
                siteName={siteName}
                logoSvg={logoSvg}
                logoImageUrl={logoImageUrl}
              />
            </div>
          </div>
        </aside>
      </div>

      {state.error && <InputError message={state.error} />}
    </Form>
  )
}

export default AdminThemeSettingsFormInner
