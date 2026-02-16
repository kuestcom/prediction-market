import type { ThemeSettingsFormState, ThemeSiteSettingsFormState } from '@/lib/theme-settings'

export type AdminThemeSettingsInitialState = ThemeSettingsFormState

export interface AdminThemeSiteSettingsInitialState extends ThemeSiteSettingsFormState {
  logoImageUrl: string | null
  pwaIcon192Url: string
  pwaIcon512Url: string
}

export interface AdminThemePresetOption {
  id: string
  label: string
  description: string
}
