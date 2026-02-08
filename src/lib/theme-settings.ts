import type { ResolvedThemeConfig, ThemeOverrides, ThemePresetId, ThemeRadius } from '@/lib/theme'
import type { ThemeSiteIdentity, ThemeSiteLogoMode } from '@/lib/theme-site-identity'
import { SettingsRepository } from '@/lib/db/queries/settings'
import { getSupabasePublicAssetUrl } from '@/lib/supabase'
import {
  buildResolvedThemeConfig,
  DEFAULT_THEME_PRESET_ID,
  formatThemeOverridesJson,
  parseThemeOverridesJson,
  resolveThemePreset,
  sortThemeOverrides,
  validateThemeRadius,
} from '@/lib/theme'
import {
  buildSvgDataUri,
  createDefaultThemeSiteIdentity,
  DEFAULT_THEME_SITE_LOGO_SVG,
  sanitizeThemeSiteLogoSvg,
  validateThemeSiteDescription,
  validateThemeSiteLogoImagePath,
  validateThemeSiteLogoMode,
  validateThemeSiteName,
} from '@/lib/theme-site-identity'

const THEME_SETTINGS_GROUP = 'theme'
const THEME_PRESET_KEY = 'preset'
const THEME_LIGHT_JSON_KEY = 'light_json'
const THEME_DARK_JSON_KEY = 'dark_json'
const THEME_RADIUS_KEY = 'radius'
const THEME_SITE_NAME_KEY = 'site_name'
const THEME_SITE_DESCRIPTION_KEY = 'site_description'
const THEME_SITE_LOGO_MODE_KEY = 'site_logo_mode'
const THEME_SITE_LOGO_SVG_KEY = 'site_logo_svg'
const THEME_SITE_LOGO_IMAGE_PATH_KEY = 'site_logo_image_path'

type SettingsGroup = Record<string, { value: string, updated_at: string }>
interface SettingsMap {
  [group: string]: SettingsGroup | undefined
}

interface NormalizedThemeConfig {
  presetId: ThemePresetId
  lightOverrides: ThemeOverrides
  darkOverrides: ThemeOverrides
  radius: ThemeRadius | null
  radiusValue: string
  lightJson: string
  darkJson: string
}

interface NormalizedThemeSiteConfig {
  siteName: string
  siteNameValue: string
  siteDescription: string
  siteDescriptionValue: string
  logoMode: ThemeSiteLogoMode
  logoModeValue: ThemeSiteLogoMode
  logoSvg: string
  logoSvgValue: string
  logoImagePath: string | null
  logoImagePathValue: string
}

type RuntimeThemeSource = 'settings' | 'default'

export interface RuntimeThemeState {
  theme: ResolvedThemeConfig
  site: ThemeSiteIdentity
  source: RuntimeThemeSource
}

export interface ThemeSettingsFormState {
  preset: ThemePresetId
  radius: string
  lightJson: string
  darkJson: string
}

export interface ThemeSiteSettingsFormState {
  siteName: string
  siteDescription: string
  logoMode: ThemeSiteLogoMode
  logoSvg: string
  logoImagePath: string
}

export interface ThemeSettingsValidationResult {
  data: NormalizedThemeConfig | null
  error: string | null
}

export interface ThemeSiteSettingsValidationResult {
  data: NormalizedThemeSiteConfig | null
  error: string | null
}

function normalizeThemeConfig(params: {
  presetValue: string | null | undefined
  radiusValue: string | null | undefined
  lightJsonValue: string | null | undefined
  darkJsonValue: string | null | undefined
  presetErrorLabel: string
  radiusErrorLabel: string
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
  const radiusValidated = validateThemeRadius(params.radiusValue, params.radiusErrorLabel)
  if (radiusValidated.error) {
    return { data: null, error: radiusValidated.error }
  }

  return {
    data: {
      presetId: presetResolution.preset.id,
      lightOverrides,
      darkOverrides,
      radius: radiusValidated.value,
      radiusValue: radiusValidated.value ?? '',
      lightJson: formatThemeOverridesJson(lightOverrides),
      darkJson: formatThemeOverridesJson(darkOverrides),
    },
    error: null,
  }
}

function resolveLogoSvgOrDefault(value: string | null | undefined, sourceLabel: string) {
  const normalized = typeof value === 'string' ? value.trim() : ''
  if (!normalized) {
    return { value: DEFAULT_THEME_SITE_LOGO_SVG, error: null as string | null }
  }

  return sanitizeThemeSiteLogoSvg(normalized, sourceLabel)
}

function normalizeThemeSiteConfig(params: {
  siteNameValue: string | null | undefined
  siteDescriptionValue: string | null | undefined
  logoModeValue: string | null | undefined
  logoSvgValue: string | null | undefined
  logoImagePathValue: string | null | undefined
  siteNameErrorLabel: string
  siteDescriptionErrorLabel: string
  logoModeErrorLabel: string
  logoSvgErrorLabel: string
  logoImagePathErrorLabel: string
}): ThemeSiteSettingsValidationResult {
  const siteNameValidated = validateThemeSiteName(params.siteNameValue, params.siteNameErrorLabel)
  if (siteNameValidated.error) {
    return { data: null, error: siteNameValidated.error }
  }

  const siteDescriptionValidated = validateThemeSiteDescription(params.siteDescriptionValue, params.siteDescriptionErrorLabel)
  if (siteDescriptionValidated.error) {
    return { data: null, error: siteDescriptionValidated.error }
  }

  const logoModeValidated = validateThemeSiteLogoMode(params.logoModeValue, params.logoModeErrorLabel)
  if (logoModeValidated.error) {
    return { data: null, error: logoModeValidated.error }
  }

  const logoImagePathValidated = validateThemeSiteLogoImagePath(params.logoImagePathValue, params.logoImagePathErrorLabel)
  if (logoImagePathValidated.error) {
    return { data: null, error: logoImagePathValidated.error }
  }

  const logoSvgResolved = resolveLogoSvgOrDefault(params.logoSvgValue, params.logoSvgErrorLabel)
  if (logoSvgResolved.error) {
    return { data: null, error: logoSvgResolved.error }
  }

  if (logoModeValidated.value === 'image' && !logoImagePathValidated.value) {
    return {
      data: null,
      error: `${params.logoImagePathErrorLabel} is required when image logo is selected.`,
    }
  }

  return {
    data: {
      siteName: siteNameValidated.value!,
      siteNameValue: siteNameValidated.value!,
      siteDescription: siteDescriptionValidated.value!,
      siteDescriptionValue: siteDescriptionValidated.value!,
      logoMode: logoModeValidated.value!,
      logoModeValue: logoModeValidated.value!,
      logoSvg: logoSvgResolved.value!,
      logoSvgValue: logoSvgResolved.value!,
      logoImagePath: logoImagePathValidated.value,
      logoImagePathValue: logoImagePathValidated.value ?? '',
    },
    error: null,
  }
}

function buildThemeSiteIdentity(config: NormalizedThemeSiteConfig): ThemeSiteIdentity {
  const logoImageUrl = config.logoMode === 'image'
    ? getSupabasePublicAssetUrl(config.logoImagePath)
    : null

  const useImageLogo = config.logoMode === 'image' && Boolean(logoImageUrl)

  return {
    name: config.siteName,
    description: config.siteDescription,
    logoMode: useImageLogo ? 'image' : 'svg',
    logoSvg: config.logoSvg,
    logoImagePath: useImageLogo ? config.logoImagePath : null,
    logoImageUrl: useImageLogo ? logoImageUrl : null,
    logoUrl: useImageLogo && logoImageUrl ? logoImageUrl : buildSvgDataUri(config.logoSvg),
  }
}

function buildDefaultThemeState(): RuntimeThemeState {
  return {
    theme: buildResolvedThemeConfig(DEFAULT_THEME_PRESET_ID),
    site: createDefaultThemeSiteIdentity(),
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
    || themeSettings[THEME_RADIUS_KEY]?.value?.trim()
    || themeSettings[THEME_LIGHT_JSON_KEY]?.value?.trim()
    || themeSettings[THEME_DARK_JSON_KEY]?.value?.trim(),
  )
}

function hasStoredThemeSiteSettings(themeSettings?: SettingsGroup) {
  if (!themeSettings) {
    return false
  }

  return Boolean(
    themeSettings[THEME_SITE_NAME_KEY]?.value?.trim()
    || themeSettings[THEME_SITE_DESCRIPTION_KEY]?.value?.trim()
    || themeSettings[THEME_SITE_LOGO_MODE_KEY]?.value?.trim()
    || themeSettings[THEME_SITE_LOGO_SVG_KEY]?.value?.trim()
    || themeSettings[THEME_SITE_LOGO_IMAGE_PATH_KEY]?.value?.trim(),
  )
}

export function getThemeSettingsFormState(allSettings?: SettingsMap): ThemeSettingsFormState {
  const themeSettings = getThemeSettingsGroup(allSettings)
  const presetResolution = resolveThemePreset(themeSettings?.[THEME_PRESET_KEY]?.value)
  const radiusRaw = themeSettings?.[THEME_RADIUS_KEY]?.value ?? ''

  const lightRaw = themeSettings?.[THEME_LIGHT_JSON_KEY]?.value ?? ''
  const darkRaw = themeSettings?.[THEME_DARK_JSON_KEY]?.value ?? ''

  const radiusValidated = validateThemeRadius(radiusRaw, 'Theme radius')
  const lightParsed = parseThemeOverridesJson(lightRaw, 'Theme light overrides')
  const darkParsed = parseThemeOverridesJson(darkRaw, 'Theme dark overrides')

  return {
    preset: presetResolution.preset.id,
    radius: radiusValidated.error ? radiusRaw.trim() : (radiusValidated.value ?? ''),
    lightJson: lightParsed.error ? lightRaw || '{}' : formatThemeOverridesJson(lightParsed.data ?? {}),
    darkJson: darkParsed.error ? darkRaw || '{}' : formatThemeOverridesJson(darkParsed.data ?? {}),
  }
}

export function getThemeSiteSettingsFormState(allSettings?: SettingsMap): ThemeSiteSettingsFormState {
  const defaultSite = createDefaultThemeSiteIdentity()
  const themeSettings = getThemeSettingsGroup(allSettings)

  const normalized = normalizeThemeSiteConfig({
    siteNameValue: themeSettings?.[THEME_SITE_NAME_KEY]?.value ?? defaultSite.name,
    siteDescriptionValue: themeSettings?.[THEME_SITE_DESCRIPTION_KEY]?.value ?? defaultSite.description,
    logoModeValue: themeSettings?.[THEME_SITE_LOGO_MODE_KEY]?.value ?? defaultSite.logoMode,
    logoSvgValue: themeSettings?.[THEME_SITE_LOGO_SVG_KEY]?.value ?? defaultSite.logoSvg,
    logoImagePathValue: themeSettings?.[THEME_SITE_LOGO_IMAGE_PATH_KEY]?.value ?? defaultSite.logoImagePath,
    siteNameErrorLabel: 'Theme site name',
    siteDescriptionErrorLabel: 'Theme site description',
    logoModeErrorLabel: 'Theme logo mode',
    logoSvgErrorLabel: 'Theme logo SVG',
    logoImagePathErrorLabel: 'Theme logo image path',
  })

  if (normalized.data) {
    return {
      siteName: normalized.data.siteNameValue,
      siteDescription: normalized.data.siteDescriptionValue,
      logoMode: normalized.data.logoModeValue,
      logoSvg: normalized.data.logoSvgValue,
      logoImagePath: normalized.data.logoImagePathValue,
    }
  }

  return {
    siteName: defaultSite.name,
    siteDescription: defaultSite.description,
    logoMode: defaultSite.logoMode,
    logoSvg: defaultSite.logoSvg,
    logoImagePath: defaultSite.logoImagePath ?? '',
  }
}

export function validateThemeSettingsInput(params: {
  preset: string | null | undefined
  radius: string | null | undefined
  lightJson: string | null | undefined
  darkJson: string | null | undefined
}): ThemeSettingsValidationResult {
  return normalizeThemeConfig({
    presetValue: params.preset,
    radiusValue: params.radius,
    lightJsonValue: params.lightJson,
    darkJsonValue: params.darkJson,
    presetErrorLabel: 'Theme preset',
    radiusErrorLabel: 'Theme radius',
    lightErrorLabel: 'Light theme overrides',
    darkErrorLabel: 'Dark theme overrides',
  })
}

export function validateThemeSiteSettingsInput(params: {
  siteName: string | null | undefined
  siteDescription: string | null | undefined
  logoMode: string | null | undefined
  logoSvg: string | null | undefined
  logoImagePath: string | null | undefined
}): ThemeSiteSettingsValidationResult {
  return normalizeThemeSiteConfig({
    siteNameValue: params.siteName,
    siteDescriptionValue: params.siteDescription,
    logoModeValue: params.logoMode,
    logoSvgValue: params.logoSvg,
    logoImagePathValue: params.logoImagePath,
    siteNameErrorLabel: 'Site name',
    siteDescriptionErrorLabel: 'Site description',
    logoModeErrorLabel: 'Logo type',
    logoSvgErrorLabel: 'Logo SVG',
    logoImagePathErrorLabel: 'Logo image',
  })
}

export async function loadRuntimeThemeState(): Promise<RuntimeThemeState> {
  const defaults = buildDefaultThemeState()
  const { data: allSettings, error } = await SettingsRepository.getSettings()

  if (error) {
    return defaults
  }

  const themeSettings = getThemeSettingsGroup(allSettings ?? undefined)
  const hasTheme = hasStoredThemeSettings(themeSettings)
  const hasSite = hasStoredThemeSiteSettings(themeSettings)

  const normalizedTheme = hasTheme
    ? normalizeThemeConfig({
        presetValue: themeSettings?.[THEME_PRESET_KEY]?.value,
        radiusValue: themeSettings?.[THEME_RADIUS_KEY]?.value,
        lightJsonValue: themeSettings?.[THEME_LIGHT_JSON_KEY]?.value,
        darkJsonValue: themeSettings?.[THEME_DARK_JSON_KEY]?.value,
        presetErrorLabel: 'Theme preset in settings',
        radiusErrorLabel: 'Theme radius in settings',
        lightErrorLabel: 'Theme light_json in settings',
        darkErrorLabel: 'Theme dark_json in settings',
      })
    : null

  const normalizedSite = hasSite
    ? normalizeThemeSiteConfig({
        siteNameValue: themeSettings?.[THEME_SITE_NAME_KEY]?.value,
        siteDescriptionValue: themeSettings?.[THEME_SITE_DESCRIPTION_KEY]?.value,
        logoModeValue: themeSettings?.[THEME_SITE_LOGO_MODE_KEY]?.value,
        logoSvgValue: themeSettings?.[THEME_SITE_LOGO_SVG_KEY]?.value,
        logoImagePathValue: themeSettings?.[THEME_SITE_LOGO_IMAGE_PATH_KEY]?.value,
        siteNameErrorLabel: 'Theme site name in settings',
        siteDescriptionErrorLabel: 'Theme site description in settings',
        logoModeErrorLabel: 'Theme logo mode in settings',
        logoSvgErrorLabel: 'Theme logo SVG in settings',
        logoImagePathErrorLabel: 'Theme logo image path in settings',
      })
    : null

  const theme = normalizedTheme?.data
    ? buildResolvedThemeConfig(
        normalizedTheme.data.presetId,
        normalizedTheme.data.lightOverrides,
        normalizedTheme.data.darkOverrides,
        normalizedTheme.data.radius,
      )
    : defaults.theme

  const site = normalizedSite?.data
    ? buildThemeSiteIdentity(normalizedSite.data)
    : defaults.site

  return {
    theme,
    site,
    source: normalizedTheme?.data || normalizedSite?.data ? 'settings' : 'default',
  }
}

export async function loadRuntimeThemeSiteName() {
  const runtimeTheme = await loadRuntimeThemeState()
  return runtimeTheme.site.name
}
