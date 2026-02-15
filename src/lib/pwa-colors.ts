import type { ResolvedThemeConfig } from '@/lib/theme'

const FALLBACK_LIGHT_COLOR = '#ffffff'
const FALLBACK_DARK_COLOR = '#0f172a'

function normalizeColor(value: string | undefined, fallback: string) {
  const normalized = value?.trim()
  return normalized && normalized.length > 0 ? normalized : fallback
}

export function resolvePwaThemeColors(theme: ResolvedThemeConfig) {
  const lightSurface = normalizeColor(theme.light.background, FALLBACK_LIGHT_COLOR)
  const darkSurface = normalizeColor(theme.dark.background, FALLBACK_DARK_COLOR)

  return {
    lightSurface,
    darkSurface,
  }
}
