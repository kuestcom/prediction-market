import { SettingsRepository } from '@/lib/db/queries/settings'

export const EVENTS_SETTINGS_GROUP = 'events'
export const AUTO_DEPLOY_NEW_EVENTS_KEY = 'auto_deploy_new_events'

type SettingsGroup = Record<string, { value: string, updated_at: string }>
interface SettingsMap {
  [group: string]: SettingsGroup | undefined
}

function normalizeBooleanSetting(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback
  }

  const normalized = value.trim().toLowerCase()
  if (['true', '1', 'yes', 'on', 'enabled'].includes(normalized)) {
    return true
  }
  if (['false', '0', 'no', 'off', 'disabled'].includes(normalized)) {
    return false
  }

  return fallback
}

export function getAutoDeployNewEventsEnabledFromSettings(settings?: SettingsMap): boolean {
  const rawValue = settings?.[EVENTS_SETTINGS_GROUP]?.[AUTO_DEPLOY_NEW_EVENTS_KEY]?.value
  return normalizeBooleanSetting(rawValue, true)
}

export async function loadAutoDeployNewEventsEnabled(): Promise<boolean> {
  const { data } = await SettingsRepository.getSettings()
  return getAutoDeployNewEventsEnabledFromSettings(data ?? undefined)
}
