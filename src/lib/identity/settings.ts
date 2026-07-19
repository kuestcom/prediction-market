import type { IdentitySettingsSnapshot } from './types'
import {
  IDENTITY_ENABLED_SETTINGS_KEY,
  IDENTITY_OBSERVE_ONLY_SETTINGS_KEY,
  IDENTITY_POLICY_REVISION_SETTINGS_KEY,
  IDENTITY_SETTINGS_GROUP,
} from './constants'

type SettingsMap = Record<string, Record<string, { value: string, updated_at: string }> | undefined>

function parseBoolean(value: string | null | undefined) {
  return ['1', 'true', 'yes', 'on', 'enabled'].includes(value?.trim().toLowerCase() ?? '')
}

export function parseIdentitySettings(settings?: SettingsMap | null): IdentitySettingsSnapshot {
  const identity = settings?.[IDENTITY_SETTINGS_GROUP]
  const rawRevision = Number.parseInt(identity?.[IDENTITY_POLICY_REVISION_SETTINGS_KEY]?.value ?? '1', 10)

  return {
    enabled: parseBoolean(identity?.[IDENTITY_ENABLED_SETTINGS_KEY]?.value),
    observeOnly: parseBoolean(identity?.[IDENTITY_OBSERVE_ONLY_SETTINGS_KEY]?.value),
    policyRevision: Number.isFinite(rawRevision) && rawRevision > 0 ? rawRevision : 1,
  }
}
