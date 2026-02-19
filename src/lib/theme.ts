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
]

const THEME_TOKEN_SET = new Set(THEME_TOKENS)

export type ThemeToken = ThemeTokenTuple[number]
export type ThemeOverrides = Partial<Record<ThemeToken, string>>
export type ThemeRadius = string

const NUMBER_PATTERN = '[+-]?(?:\\d+(?:\\.\\d+)?|\\.\\d+)'
const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const RADIUS_PATTERN = /^(?:0|(?:\d+(?:\.\d+)?|\.\d+)(?:px|rem|em))$/i
const OKLCH_COLOR_PATTERN = new RegExp(
  `^oklch\\(\\s*${NUMBER_PATTERN}%?\\s+${NUMBER_PATTERN}\\s+${NUMBER_PATTERN}(?:\\s*\\/\\s*${NUMBER_PATTERN}%?)?\\s*\\)$`,
  'i',
)

export interface ThemePreset {
  id: ThemePresetId
  label: string
  description: string
}

const THEME_PRESET_IDS = ['default', 'midnight', 'lime', 'amber'] as const
export type ThemePresetId = typeof THEME_PRESET_IDS[number]
const THEME_PRESET_ID_SET = new Set<string>(THEME_PRESET_IDS)
export const DEFAULT_THEME_PRESET_ID: ThemePresetId = 'default'

const THEME_PRESETS: Record<ThemePresetId, ThemePreset> = {
  default: {
    id: 'default',
    label: 'Default',
    description: 'Default theme palette.',
  },
  midnight: {
    id: 'midnight',
    label: 'Midnight',
    description: 'Cool blue-purple tones inspired by Discord.',
  },
  lime: {
    id: 'lime',
    label: 'Lime',
    description: 'High-energy green accent palette.',
  },
  amber: {
    id: 'amber',
    label: 'Amber',
    description: 'Warm amber palette inspired by Binance.',
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
  radius: ThemeRadius | null
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
  const normalizedValue = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (!normalizedValue || !isThemePresetId(normalizedValue)) {
    return null
  }
  return normalizedValue
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

export function validateThemeRadius(value: string | null | undefined, sourceLabel: string) {
  const normalized = typeof value === 'string' ? value.trim() : ''
  if (!normalized) {
    return { value: null, error: null }
  }

  if (!RADIUS_PATTERN.test(normalized)) {
    return {
      value: null,
      error: `${sourceLabel} must be a valid CSS length (0, px, rem, or em).`,
    }
  }

  return { value: normalized, error: null }
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

function buildThemeConfig(
  presetId: ThemePresetId,
  light: ThemeOverrides,
  dark: ThemeOverrides,
  radius: ThemeRadius | null = null,
): ResolvedThemeConfig {
  const normalizedLight = sortThemeOverrides(light)
  const normalizedDark = sortThemeOverrides(dark)

  return {
    presetId,
    light: normalizedLight,
    dark: normalizedDark,
    radius,
    cssText: buildThemeCssText(normalizedLight, normalizedDark, radius),
  }
}

export function buildResolvedThemeConfig(
  presetId: ThemePresetId,
  lightOverrides: ThemeOverrides = {},
  darkOverrides: ThemeOverrides = {},
  radius: ThemeRadius | null = null,
): ResolvedThemeConfig {
  return buildThemeConfig(presetId, lightOverrides, darkOverrides, radius)
}

export function buildThemeCssText(light: ThemeOverrides, dark: ThemeOverrides, radius: ThemeRadius | null = null) {
  const normalizedRadius = typeof radius === 'string' ? radius.trim() : ''
  const lightLines = THEME_TOKENS.flatMap((token) => {
    const value = light[token]
    return typeof value === 'string' ? [`  --${token}: ${value};`] : []
  })
  const darkLines = THEME_TOKENS.flatMap((token) => {
    const value = dark[token]
    return typeof value === 'string' ? [`  --${token}: ${value};`] : []
  })

  const blocks: string[] = []
  if (normalizedRadius) {
    lightLines.unshift(`  --radius: ${normalizedRadius};`)
  }
  if (lightLines.length > 0) {
    blocks.push(`:root {\n${lightLines.join('\n')}\n}`)
  }
  if (darkLines.length > 0) {
    blocks.push(
      `
.dark,
[data-theme-mode='dark'],
.dark[data-theme-preset],
[data-theme-mode='dark'][data-theme-preset] {
${darkLines.join('\n')}
}`.trim(),
    )
  }

  return blocks.join('\n')
}
