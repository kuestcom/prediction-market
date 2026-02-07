'use client'

import type { CSSProperties } from 'react'
import type { ThemeOverrides } from '@/lib/theme'
import Form from 'next/form'
import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { updateThemeSettingsAction } from '@/app/[locale]/admin/theme/_actions/update-theme-settings'
import { Button } from '@/components/ui/button'
import { InputError } from '@/components/ui/input-error'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  buildThemeCssText,
  DEFAULT_THEME_PRESET_ID,
  parseThemeOverridesJson,
  THEME_TOKENS,
  validateThemePresetId,
} from '@/lib/theme'

const initialState = {
  error: null,
}

interface ThemePresetOption {
  id: string
  label: string
  description: string
}

interface AdminThemeSettingsFormProps {
  presetOptions: ThemePresetOption[]
  initialPreset: string
  initialLightJson: string
  initialDarkJson: string
}

function buildPreviewStyle(variables: ThemeOverrides): CSSProperties {
  const style: Record<string, string> = {}

  THEME_TOKENS.forEach((token) => {
    const value = variables[token]
    if (typeof value === 'string') {
      style[`--${token}`] = value
    }
  })

  return style as CSSProperties
}

function ThemePreviewCard({
  title,
  presetId,
  isDark,
  overrides,
}: {
  title: string
  presetId: string
  isDark: boolean
  overrides: ThemeOverrides
}) {
  const style = useMemo(() => buildPreviewStyle(overrides), [overrides])

  return (
    <div
      data-theme-preset={presetId}
      data-theme-mode={isDark ? 'dark' : 'light'}
      style={style}
      className="grid gap-4 rounded-lg border border-border bg-background p-4 text-foreground"
    >
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="rounded-md border border-border bg-card p-3">
        <p className="text-sm font-medium">Market card</p>
        <p className="mt-1 text-xs text-muted-foreground">This block previews background, card and text tokens.</p>
        <div className="mt-3 flex items-center gap-2">
          <span className="inline-flex rounded-sm bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground">
            Primary
          </span>
          <span className="
            inline-flex rounded-sm bg-secondary px-2 py-1 text-xs font-semibold text-secondary-foreground
          "
          >
            Secondary
          </span>
        </div>
      </div>
      <div className="grid gap-2">
        <p className="text-xs text-muted-foreground">Chart palette</p>
        <div className="grid grid-cols-5 gap-1">
          <span className="h-2 rounded-sm" style={{ backgroundColor: 'var(--chart-1)' }} />
          <span className="h-2 rounded-sm" style={{ backgroundColor: 'var(--chart-2)' }} />
          <span className="h-2 rounded-sm" style={{ backgroundColor: 'var(--chart-3)' }} />
          <span className="h-2 rounded-sm" style={{ backgroundColor: 'var(--chart-4)' }} />
          <span className="h-2 rounded-sm" style={{ backgroundColor: 'var(--chart-5)' }} />
        </div>
      </div>
    </div>
  )
}

export default function AdminThemeSettingsForm({
  presetOptions,
  initialPreset,
  initialLightJson,
  initialDarkJson,
}: AdminThemeSettingsFormProps) {
  const [state, formAction, isPending] = useActionState(updateThemeSettingsAction, initialState)
  const wasPendingRef = useRef(isPending)

  const [preset, setPreset] = useState(initialPreset)
  const [lightJson, setLightJson] = useState(initialLightJson)
  const [darkJson, setDarkJson] = useState(initialDarkJson)

  useEffect(() => {
    setPreset(initialPreset)
  }, [initialPreset])

  useEffect(() => {
    setLightJson(initialLightJson)
  }, [initialLightJson])

  useEffect(() => {
    setDarkJson(initialDarkJson)
  }, [initialDarkJson])

  const lightParseResult = useMemo(
    () => parseThemeOverridesJson(lightJson, 'Light theme overrides'),
    [lightJson],
  )
  const darkParseResult = useMemo(
    () => parseThemeOverridesJson(darkJson, 'Dark theme overrides'),
    [darkJson],
  )
  const parsedPreset = useMemo(
    () => validateThemePresetId(preset) ?? DEFAULT_THEME_PRESET_ID,
    [preset],
  )

  useEffect(() => {
    const transitionedToIdle = wasPendingRef.current && !isPending

    if (transitionedToIdle && state.error === null) {
      const rootElement = document.documentElement
      rootElement.setAttribute('data-theme-preset', parsedPreset)

      const cssText = buildThemeCssText(lightParseResult.data ?? {}, darkParseResult.data ?? {})
      const currentThemeStyle = document.getElementById('theme-vars')

      if (cssText) {
        const styleElement = currentThemeStyle instanceof HTMLStyleElement
          ? currentThemeStyle
          : document.createElement('style')

        styleElement.id = 'theme-vars'
        styleElement.textContent = cssText

        if (!currentThemeStyle) {
          document.body.prepend(styleElement)
        }
      }
      else if (currentThemeStyle) {
        currentThemeStyle.remove()
      }

      toast.success('Theme settings updated successfully!')
    }
    else if (transitionedToIdle && state.error) {
      toast.error(state.error)
    }

    wasPendingRef.current = isPending
  }, [darkParseResult.data, isPending, lightParseResult.data, parsedPreset, state.error])

  const hasPreviewError = Boolean(lightParseResult.error || darkParseResult.error)

  return (
    <Form action={formAction} className="grid gap-6 rounded-lg border p-6">
      <input type="hidden" name="preset" value={preset} />

      <div className="grid gap-2">
        <Label htmlFor="theme-preset">Preset</Label>
        <Select value={preset} onValueChange={setPreset} disabled={isPending}>
          <SelectTrigger id="theme-preset" className="w-full max-w-sm">
            <SelectValue placeholder="Select preset" />
          </SelectTrigger>
          <SelectContent>
            {presetOptions.map(option => (
              <SelectItem key={option.id} value={option.id}>
                <div className="grid gap-0.5">
                  <span>{option.label}</span>
                  <span className="text-xs text-muted-foreground">{option.description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="light-json">Light overrides JSON</Label>
          <Textarea
            id="light-json"
            name="light_json"
            rows={16}
            value={lightJson}
            onChange={event => setLightJson(event.target.value)}
            spellCheck={false}
            disabled={isPending}
          />
          {lightParseResult.error && (
            <p className="text-xs text-destructive">{lightParseResult.error}</p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="dark-json">Dark overrides JSON</Label>
          <Textarea
            id="dark-json"
            name="dark_json"
            rows={16}
            value={darkJson}
            onChange={event => setDarkJson(event.target.value)}
            spellCheck={false}
            disabled={isPending}
          />
          {darkParseResult.error && (
            <p className="text-xs text-destructive">{darkParseResult.error}</p>
          )}
        </div>
      </div>

      <div className="grid gap-2">
        <Label>Preview</Label>
        {!hasPreviewError
          ? (
              <div className="grid gap-4 md:grid-cols-2">
                <ThemePreviewCard
                  title="Light"
                  presetId={parsedPreset}
                  isDark={false}
                  overrides={lightParseResult.data ?? {}}
                />
                <ThemePreviewCard
                  title="Dark"
                  presetId={parsedPreset}
                  isDark
                  overrides={darkParseResult.data ?? {}}
                />
              </div>
            )
          : (
              <p className="text-sm text-destructive">
                Preview unavailable until JSON is valid.
              </p>
            )}
      </div>

      {state.error && <InputError message={state.error} />}

      <Button
        type="submit"
        className="ms-auto w-40"
        disabled={isPending || Boolean(lightParseResult.error || darkParseResult.error)}
      >
        {isPending ? 'Saving...' : 'Save changes'}
      </Button>
    </Form>
  )
}
