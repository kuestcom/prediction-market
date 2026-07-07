import { oklchToRenderableColor } from '@/lib/color'

const THEME_PRESET_PRIMARY_COLOR = {
  amber: 'oklch(0.881 0.168 94.237)',
  default: 'oklch(0.55 0.2 255)',
  lime: 'oklch(0.67 0.2 145)',
  midnight: 'oklch(0.577 0.209 273.85)',
} as const

export function normalizeOgText(value: string | null | undefined, maxLength: number) {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) {
    return null
  }

  if (trimmed.length <= maxLength) {
    return trimmed
  }

  return `${trimmed.slice(0, maxLength - 1)}…`
}

export function resolveOgThemePrimaryColor(
  primaryValue: string | null | undefined,
  presetId: string,
  fallback = '#3468d6',
) {
  const normalizedPrimary = primaryValue?.trim()
  if (normalizedPrimary) {
    const normalizedPrimaryLowerCase = normalizedPrimary.toLowerCase()
    if (normalizedPrimary.startsWith('#') || normalizedPrimaryLowerCase.startsWith('rgb')) {
      return normalizedPrimary
    }

    const converted = oklchToRenderableColor(normalizedPrimary)
    if (converted) {
      return converted
    }
  }

  const presetFallback = THEME_PRESET_PRIMARY_COLOR[presetId as keyof typeof THEME_PRESET_PRIMARY_COLOR]
    ?? THEME_PRESET_PRIMARY_COLOR.default

  return oklchToRenderableColor(presetFallback) ?? fallback
}
