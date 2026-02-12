'use server'

import { getExtracted } from 'next-intl/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { ensureEnabledLocales, serializeEnabledLocales } from '@/i18n/locale-settings'
import { SUPPORTED_LOCALES } from '@/i18n/locales'
import { loadOpenRouterProviderSettings } from '@/lib/ai/market-context-config'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { SettingsRepository } from '@/lib/db/queries/settings'
import { UserRepository } from '@/lib/db/queries/user'

export interface LocalesSettingsActionState {
  error: string | null
}

const LocaleSchema = z.enum(SUPPORTED_LOCALES)

function normalizeBoolean(value: string | undefined, fallback: boolean): boolean {
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

const UpdateLocalesSettingsSchema = z.object({
  enabled_locales: z.array(LocaleSchema).optional(),
  automatic_translations_enabled: z.string().optional(),
}).transform(({ enabled_locales, automatic_translations_enabled }) => {
  return {
    enabledLocales: ensureEnabledLocales(enabled_locales ?? []),
    automaticTranslationsEnabled: normalizeBoolean(automatic_translations_enabled, false),
  }
})

export async function updateLocalesSettingsAction(
  _prevState: LocalesSettingsActionState,
  formData: FormData,
): Promise<LocalesSettingsActionState> {
  const t = await getExtracted()
  const user = await UserRepository.getCurrentUser()

  if (!user || !user.is_admin) {
    return { error: t('Unauthenticated.') }
  }

  const rawLocales = formData.getAll('enabled_locales')
    .filter((value): value is string => typeof value === 'string')
  const automaticTranslationsEnabled = typeof formData.get('automatic_translations_enabled') === 'string'
    ? formData.get('automatic_translations_enabled')
    : undefined

  const parsed = UpdateLocalesSettingsSchema.safeParse({
    enabled_locales: rawLocales,
    automatic_translations_enabled: automaticTranslationsEnabled,
  })

  if (!parsed.success) {
    return { error: t('Invalid input.') }
  }

  const value = serializeEnabledLocales(parsed.data.enabledLocales)
  const openRouterSettings = await loadOpenRouterProviderSettings()
  const canEnableAutomaticTranslations = openRouterSettings.configured
  const normalizedAutomaticTranslationsEnabled = canEnableAutomaticTranslations && parsed.data.automaticTranslationsEnabled

  const { error } = await SettingsRepository.updateSettings([
    { group: 'i18n', key: 'enabled_locales', value },
    {
      group: 'i18n',
      key: 'automatic_translations_enabled',
      value: normalizedAutomaticTranslationsEnabled ? 'true' : 'false',
    },
  ])

  if (error) {
    return { error: DEFAULT_ERROR_MESSAGE }
  }

  revalidatePath('/admin/locales')

  return { error: null }
}
