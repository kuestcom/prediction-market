type ThemeTokenTuple = readonly [
  'yes',
  'yes-foreground',
  'no',
  'no-foreground',
  'background',
  'foreground',
  'card',
  'card-foreground',
  'card-hover',
  'popover',
  'popover-foreground',
  'primary',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'muted',
  'muted-foreground',
  'accent',
  'accent-foreground',
  'destructive',
  'destructive-foreground',
  'border',
  'input',
  'input-hover',
  'ring',
  'chart-1',
  'chart-2',
  'chart-3',
  'chart-4',
  'chart-5',
  'sidebar',
  'sidebar-foreground',
  'sidebar-primary',
  'sidebar-primary-foreground',
  'sidebar-accent',
  'sidebar-accent-foreground',
  'sidebar-border',
  'sidebar-ring',
]

export const THEME_TOKENS: ThemeTokenTuple = [
  'yes',
  'yes-foreground',
  'no',
  'no-foreground',
  'background',
  'foreground',
  'card',
  'card-foreground',
  'card-hover',
  'popover',
  'popover-foreground',
  'primary',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'muted',
  'muted-foreground',
  'accent',
  'accent-foreground',
  'destructive',
  'destructive-foreground',
  'border',
  'input',
  'input-hover',
  'ring',
  'chart-1',
  'chart-2',
  'chart-3',
  'chart-4',
  'chart-5',
  'sidebar',
  'sidebar-foreground',
  'sidebar-primary',
  'sidebar-primary-foreground',
  'sidebar-accent',
  'sidebar-accent-foreground',
  'sidebar-border',
  'sidebar-ring',
]

const THEME_TOKEN_SET = new Set(THEME_TOKENS)

export type ThemeToken = ThemeTokenTuple[number]
export type ThemeOverrides = Partial<Record<ThemeToken, string>>

const NUMBER_PATTERN = '[+-]?(?:\\d+(?:\\.\\d+)?|\\.\\d+)'
const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const OKLCH_COLOR_PATTERN = new RegExp(
  `^oklch\\(\\s*${NUMBER_PATTERN}%?\\s+${NUMBER_PATTERN}\\s+${NUMBER_PATTERN}(?:\\s*\\/\\s*${NUMBER_PATTERN}%?)?\\s*\\)$`,
  'i',
)

export interface ThemePreset {
  id: ThemePresetId
  label: string
  description: string
  lightOverrides: ThemeOverrides
  darkOverrides: ThemeOverrides
}

const midnightLightOverrides: ThemeOverrides = {
  'primary': 'oklch(0.52 0.18 262)',
  'chart-1': 'oklch(0.59 0.24 290)',
  'chart-2': 'oklch(0.57 0.18 240)',
  'chart-3': 'oklch(0.48 0.16 215)',
  'chart-4': 'oklch(0.72 0.16 310)',
}

const midnightDarkOverrides: ThemeOverrides = {
  'background': 'oklch(0.22 0.03 266)',
  'card': 'oklch(0.26 0.03 262)',
  'card-hover': 'oklch(0.3 0.04 262)',
  'popover': 'oklch(0.22 0.03 266)',
  'primary': 'oklch(0.76 0.18 285)',
  'primary-foreground': 'oklch(0.16 0.02 270)',
  'ring': 'oklch(0.62 0.08 285)',
  'chart-1': 'oklch(0.7 0.19 300)',
  'chart-2': 'oklch(0.66 0.17 255)',
  'chart-3': 'oklch(0.64 0.17 225)',
  'chart-4': 'oklch(0.72 0.16 330)',
  'chart-5': 'oklch(0.76 0.14 200)',
}

const limeLightOverrides: ThemeOverrides = {
  'primary': 'oklch(0.67 0.2 145)',
  'primary-foreground': 'oklch(0.2 0.03 145)',
  'yes': 'oklch(0.74 0.2 146)',
  'yes-foreground': 'oklch(0.28 0.07 147)',
  'ring': 'oklch(0.64 0.11 146)',
  'chart-1': 'oklch(0.72 0.23 145)',
  'chart-2': 'oklch(0.66 0.19 175)',
  'chart-3': 'oklch(0.57 0.15 205)',
  'chart-4': 'oklch(0.77 0.2 120)',
}

const limeDarkOverrides: ThemeOverrides = {
  'background': 'oklch(0.24 0.03 165)',
  'card': 'oklch(0.28 0.03 165)',
  'card-hover': 'oklch(0.31 0.04 165)',
  'popover': 'oklch(0.24 0.03 165)',
  'primary': 'oklch(0.78 0.2 145)',
  'primary-foreground': 'oklch(0.2 0.03 145)',
  'secondary': 'oklch(0.37 0.04 162)',
  'muted': 'oklch(0.37 0.04 162)',
  'accent': 'oklch(0.37 0.04 162)',
  'ring': 'oklch(0.67 0.12 145)',
  'chart-1': 'oklch(0.75 0.23 146)',
  'chart-2': 'oklch(0.7 0.2 170)',
  'chart-3': 'oklch(0.66 0.16 200)',
  'chart-4': 'oklch(0.78 0.2 120)',
  'chart-5': 'oklch(0.68 0.19 90)',
}

const THEME_PRESET_IDS = ['kuest', 'midnight', 'lime'] as const
export type ThemePresetId = typeof THEME_PRESET_IDS[number]
const THEME_PRESET_ID_SET = new Set<string>(THEME_PRESET_IDS)
export const DEFAULT_THEME_PRESET_ID: ThemePresetId = 'kuest'

const THEME_PRESETS: Record<ThemePresetId, ThemePreset> = {
  kuest: {
    id: 'kuest',
    label: 'Kuest',
    description: 'Default Kuest palette.',
    lightOverrides: {},
    darkOverrides: {},
  },
  midnight: {
    id: 'midnight',
    label: 'Midnight',
    description: 'Cool blue-purple tones with deeper dark surfaces.',
    lightOverrides: midnightLightOverrides,
    darkOverrides: midnightDarkOverrides,
  },
  lime: {
    id: 'lime',
    label: 'Lime',
    description: 'High-energy green accent palette.',
    lightOverrides: limeLightOverrides,
    darkOverrides: limeDarkOverrides,
  },
}

export interface ThemeOverridesParseResult {
  data: ThemeOverrides | null
  error: string | null
}

export interface ResolvedThemeConfig {
  presetId: ThemePresetId
  light: ThemeOverrides
  dark: ThemeOverrides
  cssText: string
}

export interface ResolvedThemePreset {
  preset: ThemePreset
  requestedPresetId: string | null
  usedFallbackPreset: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isValidThemeTokenValue(value: string) {
  return HEX_COLOR_PATTERN.test(value) || OKLCH_COLOR_PATTERN.test(value)
}

function normalizeThemeTokenKey(value: string): ThemeToken | null {
  const trimmed = value.trim()
  const normalized = trimmed.startsWith('--') ? trimmed.slice(2) : trimmed
  if (!THEME_TOKEN_SET.has(normalized as ThemeToken)) {
    return null
  }
  return normalized as ThemeToken
}

export function isThemePresetId(value: string): value is ThemePresetId {
  return THEME_PRESET_ID_SET.has(value)
}

export function getThemePresetOptions() {
  return THEME_PRESET_IDS.map(id => ({
    id,
    label: THEME_PRESETS[id].label,
    description: THEME_PRESETS[id].description,
  }))
}

export function validateThemePresetId(value: string | null | undefined): ThemePresetId | null {
  const trimmed = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (!trimmed || !isThemePresetId(trimmed)) {
    return null
  }
  return trimmed
}

export function resolveThemePreset(value: string | null | undefined): ResolvedThemePreset {
  const requestedPresetId = typeof value === 'string' ? value.trim().toLowerCase() : null
  const presetId = validateThemePresetId(requestedPresetId)

  if (presetId) {
    return {
      preset: THEME_PRESETS[presetId],
      requestedPresetId,
      usedFallbackPreset: false,
    }
  }

  return {
    preset: THEME_PRESETS[DEFAULT_THEME_PRESET_ID],
    requestedPresetId,
    usedFallbackPreset: Boolean(requestedPresetId),
  }
}

function parseThemeOverrides(value: unknown, sourceLabel: string): ThemeOverridesParseResult {
  if (value === null || value === undefined) {
    return { data: {}, error: null }
  }

  if (!isRecord(value)) {
    return { data: null, error: `${sourceLabel} must be a JSON object.` }
  }

  const parsed: ThemeOverrides = {}
  const sortedEntries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right))

  for (const [rawKey, rawValue] of sortedEntries) {
    const key = normalizeThemeTokenKey(rawKey)
    if (!key) {
      return { data: null, error: `Unsupported theme token: "${rawKey}".` }
    }

    if (typeof rawValue !== 'string') {
      return { data: null, error: `Theme token "${rawKey}" must be a string value.` }
    }

    const normalizedValue = rawValue.trim()
    if (!isValidThemeTokenValue(normalizedValue)) {
      return {
        data: null,
        error: `Invalid color for "${rawKey}". Supported formats: hex and oklch().`,
      }
    }

    parsed[key] = normalizedValue
  }

  return { data: sortThemeOverrides(parsed), error: null }
}

export function parseThemeOverridesJson(rawValue: string | null | undefined, sourceLabel: string): ThemeOverridesParseResult {
  const normalized = typeof rawValue === 'string' ? rawValue.trim() : ''
  if (!normalized) {
    return { data: {}, error: null }
  }

  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(normalized)
  }
  catch {
    return { data: null, error: `${sourceLabel} must be valid JSON.` }
  }

  return parseThemeOverrides(parsedJson, sourceLabel)
}

export function sortThemeOverrides(overrides: ThemeOverrides): ThemeOverrides {
  const sorted: ThemeOverrides = {}

  THEME_TOKENS.forEach((token) => {
    if (typeof overrides[token] === 'string') {
      sorted[token] = overrides[token]
    }
  })

  return sorted
}

export function formatThemeOverridesJson(overrides: ThemeOverrides) {
  return JSON.stringify(sortThemeOverrides(overrides), null, 2)
}

function mergeThemeOverrides(base: ThemeOverrides, overrides: ThemeOverrides): ThemeOverrides {
  const merged: ThemeOverrides = { ...base }

  THEME_TOKENS.forEach((token) => {
    if (typeof overrides[token] === 'string') {
      merged[token] = overrides[token]
    }
  })

  return sortThemeOverrides(merged)
}

function buildThemeConfig(
  presetId: ThemePresetId,
  light: ThemeOverrides,
  dark: ThemeOverrides,
): ResolvedThemeConfig {
  const normalizedLight = sortThemeOverrides(light)
  const normalizedDark = sortThemeOverrides(dark)

  return {
    presetId,
    light: normalizedLight,
    dark: normalizedDark,
    cssText: buildThemeCssText(normalizedLight, normalizedDark),
  }
}

export function buildResolvedThemeConfig(
  presetId: ThemePresetId,
  lightOverrides: ThemeOverrides = {},
  darkOverrides: ThemeOverrides = {},
): ResolvedThemeConfig {
  return buildThemeConfig(presetId, lightOverrides, darkOverrides)
}

export function buildPreviewThemeConfig(
  presetId: ThemePresetId,
  lightOverrides: ThemeOverrides = {},
  darkOverrides: ThemeOverrides = {},
): ResolvedThemeConfig {
  const preset = THEME_PRESETS[presetId]
  const light = mergeThemeOverrides(preset.lightOverrides, lightOverrides)
  const dark = mergeThemeOverrides(preset.darkOverrides, darkOverrides)

  return buildThemeConfig(presetId, light, dark)
}

export function buildThemeCssText(light: ThemeOverrides, dark: ThemeOverrides) {
  const lightLines = THEME_TOKENS.flatMap((token) => {
    const value = light[token]
    return typeof value === 'string' ? [`  --${token}: ${value};`] : []
  })
  const darkLines = THEME_TOKENS.flatMap((token) => {
    const value = dark[token]
    return typeof value === 'string' ? [`  --${token}: ${value};`] : []
  })

  const blocks: string[] = []
  if (lightLines.length > 0) {
    blocks.push(`:root {\n${lightLines.join('\n')}\n}`)
  }
  if (darkLines.length > 0) {
    blocks.push(`.dark {\n${darkLines.join('\n')}\n}`)
  }

  return blocks.join('\n')
}
