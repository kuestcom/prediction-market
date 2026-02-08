'use client'

import type { CSSProperties } from 'react'
import type {
  AdminThemePresetOption,
  AdminThemeSettingsInitialState,
  AdminThemeSiteSettingsInitialState,
} from '@/app/[locale]/admin/theme/_types/theme-form-state'
import type { ThemeOverrides, ThemeToken } from '@/lib/theme'
import { ChevronDown, RotateCcw } from 'lucide-react'
import Form from 'next/form'
import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { updateThemeSettingsAction } from '@/app/[locale]/admin/theme/_actions/update-theme-settings'
import SiteLogoIcon from '@/components/SiteLogoIcon'
import { Button } from '@/components/ui/button'
import { InputError } from '@/components/ui/input-error'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  buildThemeCssText,
  DEFAULT_THEME_PRESET_ID,
  formatThemeOverridesJson,
  parseThemeOverridesJson,
  THEME_TOKENS,
  validateThemePresetId,
  validateThemeRadius,
} from '@/lib/theme'
import { cn } from '@/lib/utils'

const initialState = {
  error: null,
}

const COLOR_PICKER_FALLBACK = '#000000'
const DEFAULT_RADIUS_VALUE = '0.625rem'
const RADIUS_PRESETS = [
  { label: 'Sharp', value: '0' },
  { label: 'Soft', value: DEFAULT_RADIUS_VALUE },
  { label: 'Round', value: '16px' },
] as const
const TOKEN_GROUPS: { id: string, label: string, tokens: ThemeToken[] }[] = [
  {
    id: 'core',
    label: 'Core surfaces',
    tokens: [
      'background',
      'foreground',
      'card',
      'card-foreground',
      'card-hover',
      'popover',
      'popover-foreground',
      'border',
      'input',
      'input-hover',
      'ring',
    ],
  },
  {
    id: 'brand',
    label: 'Brand + accents',
    tokens: [
      'primary',
      'primary-foreground',
      'secondary',
      'secondary-foreground',
      'muted',
      'muted-foreground',
      'accent',
      'accent-foreground',
    ],
  },
  {
    id: 'outcomes',
    label: 'Outcome + alerts',
    tokens: [
      'yes',
      'yes-foreground',
      'no',
      'no-foreground',
      'destructive',
      'destructive-foreground',
    ],
  },
  {
    id: 'chart',
    label: 'Chart palette',
    tokens: [
      'chart-1',
      'chart-2',
      'chart-3',
      'chart-4',
      'chart-5',
    ],
  },
]
interface AdminThemeSettingsFormProps {
  presetOptions: AdminThemePresetOption[]
  initialThemeSettings: AdminThemeSettingsInitialState
  initialThemeSiteSettings: AdminThemeSiteSettingsInitialState
}

function buildPreviewStyle(variables: ThemeOverrides, radius: string | null): CSSProperties {
  const style: Record<string, string> = {}

  if (radius) {
    style['--radius'] = radius
  }

  THEME_TOKENS.forEach((token) => {
    const value = variables[token]
    if (typeof value === 'string') {
      style[`--${token}`] = value
    }
  })

  return style as CSSProperties
}

function clampChannel(value: number) {
  if (Number.isNaN(value)) {
    return 0
  }
  return Math.min(255, Math.max(0, value))
}

function normalizeHexColor(value: string): string | null {
  const trimmed = value.trim().toLowerCase()
  if (!trimmed.startsWith('#')) {
    return null
  }
  const hex = trimmed.slice(1)
  if (hex.length === 3) {
    const expanded = hex.split('').map(char => char + char).join('')
    return `#${expanded}`
  }
  if (hex.length === 6) {
    return `#${hex}`
  }
  if (hex.length === 8) {
    return `#${hex.slice(0, 6)}`
  }
  return null
}

function parseRgbChannel(value: string) {
  const trimmed = value.trim()
  if (trimmed.endsWith('%')) {
    const percent = Number.parseFloat(trimmed.slice(0, -1))
    return clampChannel(Math.round((percent / 100) * 255))
  }
  return clampChannel(Math.round(Number.parseFloat(trimmed)))
}

function parseRgbColor(value: string): [number, number, number] | null {
  const match = value.match(/rgba?\(([^)]+)\)/i)
  if (!match) {
    return null
  }
  const parts = match[1]
    .trim()
    .split(/[\s,/]+/)
    .filter(Boolean)
  if (parts.length < 3) {
    return null
  }
  const r = parseRgbChannel(parts[0])
  const g = parseRgbChannel(parts[1])
  const b = parseRgbChannel(parts[2])
  return [r, g, b]
}

function parseOklchColor(value: string): { l: number, c: number, h: number } | null {
  const match = value.match(/oklch\(\s*([+-]?[\d.]+%?)\s+([+-]?[\d.]+)\s+([+-]?[\d.]+)(?:\s*\/\s*([+-]?[\d.]+%?))?\s*\)/i)
  if (!match) {
    return null
  }
  let l = Number.parseFloat(match[1])
  if (match[1].includes('%') || l > 1) {
    l = l / 100
  }
  const c = Number.parseFloat(match[2])
  const h = Number.parseFloat(match[3])
  if (Number.isNaN(l) || Number.isNaN(c) || Number.isNaN(h)) {
    return null
  }
  return { l, c, h }
}

function oklchToRgb({ l, c, h }: { l: number, c: number, h: number }): [number, number, number] {
  const hRad = (h * Math.PI) / 180
  const a = c * Math.cos(hRad)
  const b = c * Math.sin(hRad)

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b
  const s_ = l - 0.0894841775 * a - 1.291485548 * b

  const l3 = l_ ** 3
  const m3 = m_ ** 3
  const s3 = s_ ** 3

  const rLinear = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3
  const gLinear = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3
  const bLinear = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3

  function toSrgb(channel: number) {
    const clamped = Math.min(1, Math.max(0, channel))
    return clamped <= 0.0031308
      ? 12.92 * clamped
      : 1.055 * clamped ** (1 / 2.4) - 0.055
  }

  return [
    clampChannel(Math.round(toSrgb(rLinear) * 255)),
    clampChannel(Math.round(toSrgb(gLinear) * 255)),
    clampChannel(Math.round(toSrgb(bLinear) * 255)),
  ]
}

function rgbToHex([r, g, b]: [number, number, number]) {
  function toHex(channel: number) {
    return clampChannel(channel).toString(16).padStart(2, '0')
  }
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function colorToHex(value: string | undefined) {
  if (!value) {
    return null
  }
  const normalized = value.trim()
  const hex = normalizeHexColor(normalized)
  if (hex) {
    return hex
  }
  const rgb = parseRgbColor(normalized)
  if (rgb) {
    return rgbToHex(rgb)
  }
  const oklch = parseOklchColor(normalized)
  if (oklch) {
    return rgbToHex(oklchToRgb(oklch))
  }
  return null
}

function parseRadiusPixels(value: string | null | undefined) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (!normalized) {
    return null
  }
  if (normalized === '0') {
    return 0
  }

  const match = normalized.match(/^([+-]?(?:\d+(?:\.\d+)?|\.\d+))(px|rem|em)$/)
  if (!match) {
    return null
  }

  const numericValue = Number.parseFloat(match[1])
  if (Number.isNaN(numericValue)) {
    return null
  }

  if (match[2] === 'px') {
    return numericValue
  }

  return numericValue * 16
}

function getRadiusPresetButtonStyle(presetValue: string): CSSProperties {
  if (presetValue === '0') {
    return { borderRadius: '0' }
  }
  if (presetValue === '16px') {
    return { borderRadius: '9999px' }
  }
  return { borderRadius: DEFAULT_RADIUS_VALUE }
}

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
          <h3 className="text-sm font-semibold">Corner roundness</h3>
          <p className="text-xs text-muted-foreground">
            Adjust how rounded buttons, cards, and inputs look.
          </p>
        </div>
        <button
          type="button"
          onClick={onRadiusReset}
          disabled={disabled || !normalizedRadius}
          className={`
            text-muted-foreground transition
            hover:text-foreground
            disabled:cursor-not-allowed disabled:opacity-40
          `}
          title="Use default"
          aria-label="Use default roundness"
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
            {preset.label}
          </Button>
        ))}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

function ThemePreviewCard({
  presetId,
  isDark,
  overrides,
  radius,
  siteName,
  logoSvg,
  logoImageUrl,
}: {
  presetId: string
  isDark: boolean
  overrides: ThemeOverrides
  radius: string | null
  siteName: string
  logoSvg: string
  logoImageUrl: string | null
}) {
  const style = useMemo(() => buildPreviewStyle(overrides, radius), [overrides, radius])

  return (
    <div
      data-theme-preset={presetId}
      data-theme-mode={isDark ? 'dark' : 'light'}
      style={style}
      className="grid gap-4 rounded-lg border border-border bg-background p-4 text-foreground"
    >
      <div className="flex items-center gap-2">
        <SiteLogoIcon
          logoSvg={logoSvg}
          logoImageUrl={logoImageUrl}
          alt={`${siteName} logo`}
          className="size-[1em] text-foreground [&_svg]:size-[1em] [&_svg_*]:fill-current [&_svg_*]:stroke-current"
          imageClassName="size-[1em] object-contain"
          size={20}
        />
        <span className="text-sm font-semibold">{siteName}</span>
      </div>
      <div className="rounded-md border border-border bg-card p-3">
        <p className="text-sm font-medium">Market card</p>
        <p className="mt-1 text-xs text-muted-foreground">This block previews background, card, and text colors.</p>
        <div className="mt-3 flex items-center gap-2">
          <span className="inline-flex rounded-sm bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground">
            Primary
          </span>
          <span className={`
            inline-flex rounded-sm bg-secondary px-2 py-1 text-xs font-semibold text-secondary-foreground
          `}
          >
            Secondary
          </span>
          <span className="inline-flex rounded-sm bg-yes px-2 py-1 text-xs font-semibold text-white">
            Yes
          </span>
          <span className="inline-flex rounded-sm bg-no px-2 py-1 text-xs font-semibold text-white">
            No
          </span>
        </div>
        <div className="mt-3 grid gap-2">
          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">Input</label>
            <input
              type="text"
              placeholder="Type here"
              className={`
                h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground shadow-none
                ring-offset-background outline-none
                focus-visible:ring-2 focus-visible:ring-ring
              `}
            />
          </div>
          <div className="rounded-md border border-border bg-popover p-2 text-xs">
            <p className="font-medium text-foreground">Popover</p>
            <p className="mt-0.5 text-muted-foreground">Muted sample text</p>
          </div>
        </div>
      </div>
      <div className="grid gap-2">
        <p className="text-xs text-muted-foreground">Chart palette</p>
        <div className="h-12 rounded-md bg-transparent px-1">
          <svg
            viewBox="0 0 120 48"
            preserveAspectRatio="none"
            className="h-12 w-full"
            aria-hidden="true"
          >
            <path
              d="M2 7 C 22 4, 38 10, 58 6 S 92 10, 118 7"
              stroke="var(--chart-1)"
              strokeWidth="1.4"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M2 16 C 22 13, 38 19, 58 15 S 92 19, 118 16"
              stroke="var(--chart-2)"
              strokeWidth="1.4"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M2 25 C 22 22, 38 28, 58 24 S 92 28, 118 25"
              stroke="var(--chart-3)"
              strokeWidth="1.4"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M2 34 C 22 31, 38 37, 58 33 S 92 37, 118 34"
              stroke="var(--chart-4)"
              strokeWidth="1.4"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M2 43 C 22 40, 38 46, 58 42 S 92 46, 118 43"
              stroke="var(--chart-5)"
              strokeWidth="1.4"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>
    </div>
  )
}

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
          onChange={event => onChange(event.target.value)}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />
      </div>
      <div className="flex size-5 items-center justify-center">
        {showReset && onReset
          ? (
              <button
                type="button"
                onClick={onReset}
                disabled={disabled}
                className="text-muted-foreground transition hover:text-foreground"
                title="Reset"
                aria-label="Reset color"
              >
                <RotateCcw className="size-3" />
              </button>
            )
          : (
              <span aria-hidden className="size-3" />
            )}
      </div>
    </div>
  )
}

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
  const lightProbeRef = useRef<HTMLDivElement>(null)
  const darkProbeRef = useRef<HTMLDivElement>(null)
  const [baseLightValues, setBaseLightValues] = useState<ThemeOverrides>({})
  const [baseDarkValues, setBaseDarkValues] = useState<ThemeOverrides>({})
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initialState: Record<string, boolean> = {}
    TOKEN_GROUPS.forEach((group) => {
      initialState[group.id] = group.id === 'core'
    })
    return initialState
  })

  useEffect(() => {
    if (!lightProbeRef.current || !darkProbeRef.current) {
      return
    }
    const lightStyles = getComputedStyle(lightProbeRef.current)
    const darkStyles = getComputedStyle(darkProbeRef.current)
    const nextLight: ThemeOverrides = {}
    const nextDark: ThemeOverrides = {}

    THEME_TOKENS.forEach((token) => {
      const lightValue = lightStyles.getPropertyValue(`--${token}`).trim()
      const darkValue = darkStyles.getPropertyValue(`--${token}`).trim()
      if (lightValue) {
        nextLight[token] = lightValue
      }
      if (darkValue) {
        nextDark[token] = darkValue
      }
    })

    setBaseLightValues(nextLight)
    setBaseDarkValues(nextDark)
  }, [presetId])

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={lightProbeRef}
        data-theme-mode="light"
        data-theme-preset={presetId}
        className="sr-only"
      />
      <div
        ref={darkProbeRef}
        data-theme-mode="dark"
        data-theme-preset={presetId}
        className="sr-only"
      />

      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold">Theme tokens</h3>
        {(lightParseError || darkParseError) && (
          <div className="grid gap-1 text-xs text-destructive">
            {lightParseError && (
              <p>
                Light overrides:
                {lightParseError}
              </p>
            )}
            {darkParseError && (
              <p>
                Dark overrides:
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
                    isOpen ? 'border-b border-border/40' : '',
                  )}
                >
                  <span className="leading-tight">{group.label}</span>
                  <ChevronDown
                    className={`size-5 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`}
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
                        <span>Token</span>
                        <span className="text-left">Light</span>
                        <span className="text-left">Dark</span>
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
                                label={`${token} light color`}
                                disabled={disabled}
                                onChange={value => onLightChange(token, value)}
                                onReset={() => onLightReset(token)}
                                showReset={Boolean(lightOverride)}
                              />
                              <ColorPickerSwatch
                                presetId={presetId}
                                value={darkValue}
                                label={`${token} dark color`}
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

export default function AdminThemeSettingsForm({
  presetOptions,
  initialThemeSettings,
  initialThemeSiteSettings,
}: AdminThemeSettingsFormProps) {
  const initialPreset = initialThemeSettings.preset
  const initialRadius = initialThemeSettings.radius
  const initialLightJson = initialThemeSettings.lightJson
  const initialDarkJson = initialThemeSettings.darkJson
  const siteName = initialThemeSiteSettings.siteName
  const logoSvg = initialThemeSiteSettings.logoSvg
  const logoImageUrl = initialThemeSiteSettings.logoImageUrl

  const [state, formAction, isPending] = useActionState(updateThemeSettingsAction, initialState)
  const wasPendingRef = useRef(isPending)

  const [preset, setPreset] = useState<string>(initialPreset)
  const [radius, setRadius] = useState(initialRadius)

  const initialLightParse = useMemo(
    () => parseThemeOverridesJson(initialLightJson, 'Light theme colors'),
    [initialLightJson],
  )
  const initialDarkParse = useMemo(
    () => parseThemeOverridesJson(initialDarkJson, 'Dark theme colors'),
    [initialDarkJson],
  )

  const [lightOverrides, setLightOverrides] = useState<ThemeOverrides>(initialLightParse.data ?? {})
  const [darkOverrides, setDarkOverrides] = useState<ThemeOverrides>(initialDarkParse.data ?? {})

  useEffect(() => {
    setPreset(initialPreset)
  }, [initialPreset])

  useEffect(() => {
    setRadius(initialRadius)
  }, [initialRadius])

  useEffect(() => {
    setLightOverrides(initialLightParse.data ?? {})
  }, [initialLightParse.data])

  useEffect(() => {
    setDarkOverrides(initialDarkParse.data ?? {})
  }, [initialDarkParse.data])
  const parsedPreset = useMemo(
    () => validateThemePresetId(preset) ?? DEFAULT_THEME_PRESET_ID,
    [preset],
  )
  const radiusValidation = useMemo(
    () => validateThemeRadius(radius, 'Corner roundness'),
    [radius],
  )

  const lightJsonValue = useMemo(
    () => formatThemeOverridesJson(lightOverrides),
    [lightOverrides],
  )

  const darkJsonValue = useMemo(
    () => formatThemeOverridesJson(darkOverrides),
    [darkOverrides],
  )

  useEffect(() => {
    const transitionedToIdle = wasPendingRef.current && !isPending

    if (transitionedToIdle && state.error === null) {
      const rootElement = document.documentElement
      rootElement.setAttribute('data-theme-preset', parsedPreset)

      const cssText = buildThemeCssText(lightOverrides, darkOverrides, radiusValidation.value)
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
  }, [darkOverrides, isPending, lightOverrides, parsedPreset, radiusValidation.value, state.error])

  return (
    <Form action={formAction} className="grid gap-6 rounded-lg border p-6">
      <input type="hidden" name="preset" value={preset} />
      <input type="hidden" name="radius" value={radius} />
      <input type="hidden" name="light_json" value={lightJsonValue} />
      <input type="hidden" name="dark_json" value={darkJsonValue} />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="grid items-start gap-6 self-start">
          <div className="grid gap-2">
            <Label htmlFor="theme-preset">Preset</Label>
            <Select value={preset} onValueChange={setPreset} disabled={isPending}>
              <SelectTrigger id="theme-preset" className="h-12! w-full">
                <SelectValue placeholder="Select preset" />
              </SelectTrigger>
              <SelectContent>
                {presetOptions.map(option => (
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
            presetId={parsedPreset}
            lightOverrides={lightOverrides}
            darkOverrides={darkOverrides}
            onLightChange={(token, value) => {
              setLightOverrides(prev => ({ ...prev, [token]: value }))
            }}
            onDarkChange={(token, value) => {
              setDarkOverrides(prev => ({ ...prev, [token]: value }))
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
          <Button
            type="submit"
            className="w-full"
            disabled={isPending || Boolean(radiusValidation.error)}
          >
            {isPending ? 'Saving...' : 'Save changes'}
          </Button>
        </div>

        <aside className="grid gap-2 lg:sticky lg:top-12 lg:self-start">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <h3 className="text-sm font-semibold">Preview Light</h3>
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
              <h3 className="text-sm font-semibold">Preview Dark</h3>
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
