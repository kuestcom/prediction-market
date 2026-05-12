import type { CSSProperties } from 'react'
import type {
  AdminThemePresetOption,
  AdminThemeSettingsInitialState,
  AdminThemeSiteSettingsInitialState,
} from '../_types/theme-form-state'
import type { ThemeOverrides } from '@/lib/theme'
import { THEME_TOKENS } from '@/lib/theme'

export const COLOR_PICKER_FALLBACK = '#000000'
export const DEFAULT_RADIUS_VALUE = '0.75rem'
export const RADIUS_PRESETS = [
  { id: 'sharp', value: '0' },
  { id: 'soft', value: DEFAULT_RADIUS_VALUE },
  { id: 'round', value: '16px' },
] as const
export const TOKEN_GROUPS: { id: string, tokens: import('@/lib/theme').ThemeToken[] }[] = [
  {
    id: 'core',
    tokens: [
      'background',
      'foreground',
      'card',
      'card-foreground',
      'popover',
      'popover-foreground',
      'border',
      'input',
      'ring',
    ],
  },
  {
    id: 'brand',
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
    tokens: [
      'chart-1',
      'chart-2',
      'chart-3',
      'chart-4',
      'chart-5',
    ],
  },
]

export interface AdminThemeSettingsFormProps {
  presetOptions: AdminThemePresetOption[]
  initialThemeSettings: AdminThemeSettingsInitialState
  initialThemeSiteSettings: AdminThemeSiteSettingsInitialState
}

export function buildPreviewStyle(variables: ThemeOverrides, radius: string | null): CSSProperties {
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

export function colorToHex(value: string | undefined) {
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

export function parseRadiusPixels(value: string | null | undefined) {
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

export function getRadiusPresetButtonStyle(presetValue: string): CSSProperties {
  if (presetValue === '0') {
    return { borderRadius: '0' }
  }
  if (presetValue === '16px') {
    return { borderRadius: '9999px' }
  }
  return { borderRadius: DEFAULT_RADIUS_VALUE }
}

export function resolveBaseThemeValues(presetId: string) {
  const empty = {
    lightValues: {} as ThemeOverrides,
    darkValues: {} as ThemeOverrides,
  }

  if (typeof window === 'undefined' || !document.body) {
    return empty
  }

  const lightProbe = document.createElement('div')
  lightProbe.setAttribute('data-theme-mode', 'light')
  lightProbe.setAttribute('data-theme-preset', presetId)
  lightProbe.style.position = 'absolute'
  lightProbe.style.visibility = 'hidden'
  lightProbe.style.pointerEvents = 'none'
  lightProbe.style.contain = 'style'

  const darkProbe = document.createElement('div')
  darkProbe.setAttribute('data-theme-mode', 'dark')
  darkProbe.setAttribute('data-theme-preset', presetId)
  darkProbe.style.position = 'absolute'
  darkProbe.style.visibility = 'hidden'
  darkProbe.style.pointerEvents = 'none'
  darkProbe.style.contain = 'style'

  document.body.appendChild(lightProbe)
  document.body.appendChild(darkProbe)

  try {
    const lightStyles = getComputedStyle(lightProbe)
    const darkStyles = getComputedStyle(darkProbe)
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

    return {
      lightValues: nextLight,
      darkValues: nextDark,
    }
  }
  finally {
    lightProbe.remove()
    darkProbe.remove()
  }
}
