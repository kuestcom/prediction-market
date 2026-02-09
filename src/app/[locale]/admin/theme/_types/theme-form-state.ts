import type { ThemeSettingsFormState, ThemeSiteSettingsFormState } from '@/lib/theme-settings'

export type AdminThemeSettingsInitialState = ThemeSettingsFormState

export interface AdminThemeSiteSettingsInitialState extends ThemeSiteSettingsFormState {
  logoImageUrl: string | null
}

export interface AdminThemePresetOption {
  id: string
  label: string
  description: string
}
