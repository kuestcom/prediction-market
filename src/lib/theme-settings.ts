import type { ResolvedThemeConfig, ThemeOverrides, ThemePresetId } from '@/lib/theme'
import { SettingsRepository } from '@/lib/db/queries/settings'
import {
  buildResolvedThemeConfig,
  DEFAULT_THEME_PRESET_ID,
  formatThemeOverridesJson,
  parseThemeOverridesJson,
  resolveThemePreset,
  sortThemeOverrides,
} from '@/lib/theme'

const THEME_SETTINGS_GROUP = 'theme'
const THEME_PRESET_KEY = 'preset'
const THEME_LIGHT_JSON_KEY = 'light_json'
const THEME_DARK_JSON_KEY = 'dark_json'

type SettingsGroup = Record<string, { value: string, updated_at: string }>
interface SettingsMap {
  [group: string]: SettingsGroup | undefined
}

interface NormalizedThemeConfig {
  presetId: ThemePresetId
  lightOverrides: ThemeOverrides
  darkOverrides: ThemeOverrides
  lightJson: string
  darkJson: string
}

type RuntimeThemeSource = 'settings' | 'default'

export interface RuntimeThemeState {
  theme: ResolvedThemeConfig
  source: RuntimeThemeSource
}

export interface ThemeSettingsFormState {
  preset: ThemePresetId
  lightJson: string
  darkJson: string
}

export interface ThemeSettingsValidationResult {
  data: NormalizedThemeConfig | null
  error: string | null
}

function normalizeThemeConfig(params: {
  presetValue: string | null | undefined
  lightJsonValue: string | null | undefined
  darkJsonValue: string | null | undefined
  presetErrorLabel: string
  lightErrorLabel: string
  darkErrorLabel: string
}): ThemeSettingsValidationResult {
  const presetResolution = resolveThemePreset(params.presetValue)
  if (presetResolution.usedFallbackPreset && presetResolution.requestedPresetId) {
    return {
      data: null,
      error: `${params.presetErrorLabel} is invalid.`,
    }
  }

  const lightParsed = parseThemeOverridesJson(params.lightJsonValue, params.lightErrorLabel)
  if (lightParsed.error) {
    return { data: null, error: lightParsed.error }
  }

  const darkParsed = parseThemeOverridesJson(params.darkJsonValue, params.darkErrorLabel)
  if (darkParsed.error) {
    return { data: null, error: darkParsed.error }
  }

  const lightOverrides = sortThemeOverrides(lightParsed.data ?? {})
  const darkOverrides = sortThemeOverrides(darkParsed.data ?? {})

  return {
    data: {
      presetId: presetResolution.preset.id,
      lightOverrides,
      darkOverrides,
      lightJson: formatThemeOverridesJson(lightOverrides),
      darkJson: formatThemeOverridesJson(darkOverrides),
    },
    error: null,
  }
}

function buildDefaultThemeState(): RuntimeThemeState {
  return {
    theme: buildResolvedThemeConfig(DEFAULT_THEME_PRESET_ID),
    source: 'default',
  }
}

function getThemeSettingsGroup(allSettings?: SettingsMap): SettingsGroup | undefined {
  return allSettings?.[THEME_SETTINGS_GROUP]
}

function hasStoredThemeSettings(themeSettings?: SettingsGroup) {
  if (!themeSettings) {
    return false
  }
  return Boolean(
    themeSettings[THEME_PRESET_KEY]?.value?.trim()
    || themeSettings[THEME_LIGHT_JSON_KEY]?.value?.trim()
    || themeSettings[THEME_DARK_JSON_KEY]?.value?.trim(),
  )
}

export function getThemeSettingsFormState(allSettings?: SettingsMap): ThemeSettingsFormState {
  const themeSettings = getThemeSettingsGroup(allSettings)
  const presetResolution = resolveThemePreset(themeSettings?.[THEME_PRESET_KEY]?.value)

  const lightRaw = themeSettings?.[THEME_LIGHT_JSON_KEY]?.value ?? ''
  const darkRaw = themeSettings?.[THEME_DARK_JSON_KEY]?.value ?? ''

  const lightParsed = parseThemeOverridesJson(lightRaw, 'Theme light overrides')
  const darkParsed = parseThemeOverridesJson(darkRaw, 'Theme dark overrides')

  return {
    preset: presetResolution.preset.id,
    lightJson: lightParsed.error ? lightRaw || '{}' : formatThemeOverridesJson(lightParsed.data ?? {}),
    darkJson: darkParsed.error ? darkRaw || '{}' : formatThemeOverridesJson(darkParsed.data ?? {}),
  }
}

export function validateThemeSettingsInput(params: {
  preset: string | null | undefined
  lightJson: string | null | undefined
  darkJson: string | null | undefined
}): ThemeSettingsValidationResult {
  return normalizeThemeConfig({
    presetValue: params.preset,
    lightJsonValue: params.lightJson,
    darkJsonValue: params.darkJson,
    presetErrorLabel: 'Theme preset',
    lightErrorLabel: 'Light theme overrides',
    darkErrorLabel: 'Dark theme overrides',
  })
}

export async function loadRuntimeThemeState(): Promise<RuntimeThemeState> {
  const defaultTheme = buildDefaultThemeState()
  const { data: allSettings, error } = await SettingsRepository.getSettings()

  if (error) {
    return defaultTheme
  }

  const themeSettings = getThemeSettingsGroup(allSettings ?? undefined)
  if (!hasStoredThemeSettings(themeSettings)) {
    return defaultTheme
  }

  const normalizedFromSettings = normalizeThemeConfig({
    presetValue: themeSettings?.[THEME_PRESET_KEY]?.value,
    lightJsonValue: themeSettings?.[THEME_LIGHT_JSON_KEY]?.value,
    darkJsonValue: themeSettings?.[THEME_DARK_JSON_KEY]?.value,
    presetErrorLabel: 'Theme preset in settings',
    lightErrorLabel: 'Theme light_json in settings',
    darkErrorLabel: 'Theme dark_json in settings',
  })

  if (!normalizedFromSettings.data) {
    return defaultTheme
  }

  return {
    theme: buildResolvedThemeConfig(
      normalizedFromSettings.data.presetId,
      normalizedFromSettings.data.lightOverrides,
      normalizedFromSettings.data.darkOverrides,
    ),
    source: 'settings',
  }
}
