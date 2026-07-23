import {
  DEFAULT_THEME_SITE_LOGO_SVG,
  DEFAULT_THEME_SITE_NAME,
} from '@/lib/theme-site-identity'

export const KUEST_SUPPORT_SETTINGS_GROUP = 'integrations'
export const KUEST_SUPPORT_ENABLED_KEY = 'kuest_support_enabled'
export const KUEST_SUPPORT_POSITION_KEY = 'kuest_support_position'
export const ADMIN_ONBOARDING_SETTINGS_GROUP = 'admin_onboarding'
export const ADMIN_SUPPORT_SETTINGS_GROUP = 'admin_support'
export const ADMIN_SUPPORT_ANNOUNCEMENT_DISMISSED_AT_KEY = 'announcement_dismissed_at'

const ADMIN_ONBOARDING_TASK_IDS = [
  'brand',
  'fee-wallet',
  'openrouter',
  'endpoints',
] as const

export type AdminOnboardingTaskId = typeof ADMIN_ONBOARDING_TASK_IDS[number]
export type KuestSupportPosition = 'left' | 'right'

type SettingsMap = Record<string, Record<string, { value: string, updated_at?: string }>>

function parseBoolean(value: string | null | undefined, fallback = false) {
  if (value == null || !value.trim()) {
    return fallback
  }

  return ['true', '1', 'yes', 'on', 'enabled'].includes(value.trim().toLowerCase())
}

export function isAdminOnboardingTaskId(value: unknown): value is AdminOnboardingTaskId {
  return typeof value === 'string'
    && (ADMIN_ONBOARDING_TASK_IDS as readonly string[]).includes(value)
}

export function parseKuestSupportPosition(value: string | null | undefined): KuestSupportPosition {
  return value?.trim().toLowerCase() === 'left' ? 'left' : 'right'
}

export function getKuestSupportSettings(settings?: SettingsMap | null) {
  const group = settings?.[KUEST_SUPPORT_SETTINGS_GROUP]

  return {
    enabled: parseBoolean(group?.[KUEST_SUPPORT_ENABLED_KEY]?.value, true),
    position: parseKuestSupportPosition(group?.[KUEST_SUPPORT_POSITION_KEY]?.value),
  }
}

export function getCompletedAdminOnboardingTasks(settings?: SettingsMap | null) {
  const completed = new Set<AdminOnboardingTaskId>()
  const onboarding = settings?.[ADMIN_ONBOARDING_SETTINGS_GROUP]

  for (const taskId of ADMIN_ONBOARDING_TASK_IDS) {
    if (parseBoolean(onboarding?.[taskId]?.value)) {
      completed.add(taskId)
    }
  }

  const general = settings?.general
  const siteName = general?.site_name?.value?.trim() ?? ''
  const logoSvg = general?.site_logo_svg?.value?.trim() ?? ''
  const logoImagePath = general?.site_logo_image_path?.value?.trim() ?? ''
  const hasCustomSiteName = Boolean(siteName && siteName !== DEFAULT_THEME_SITE_NAME)
  const hasCustomLogo = Boolean(
    logoImagePath
    || (logoSvg && logoSvg !== DEFAULT_THEME_SITE_LOGO_SVG),
  )
  if (hasCustomSiteName && hasCustomLogo) {
    completed.add('brand')
  }
  if (general?.fee_recipient_wallet?.value?.trim()) {
    completed.add('fee-wallet')
  }
  if (settings?.ai?.openrouter_api_key?.value?.trim()) {
    completed.add('openrouter')
  }

  return [...completed]
}

export function getSupportAnnouncementDismissedAt(settings?: SettingsMap | null) {
  const rawValue = settings?.[ADMIN_SUPPORT_SETTINGS_GROUP]
    ?.[ADMIN_SUPPORT_ANNOUNCEMENT_DISMISSED_AT_KEY]?.value.trim()

  if (!rawValue || !Number.isFinite(Date.parse(rawValue))) {
    return null
  }

  return new Date(rawValue).toISOString()
}
