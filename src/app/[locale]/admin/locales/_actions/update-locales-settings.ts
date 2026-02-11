'use server'

import { getExtracted } from 'next-intl/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { ensureEnabledLocales, serializeEnabledLocales } from '@/i18n/locale-settings'
import { SUPPORTED_LOCALES } from '@/i18n/locales'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { SettingsRepository } from '@/lib/db/queries/settings'
import { UserRepository } from '@/lib/db/queries/user'

export interface LocalesSettingsActionState {
  error: string | null
}

const LocaleSchema = z.enum(SUPPORTED_LOCALES)
const UpdateLocalesSettingsSchema = z.object({
  enabled_locales: z.array(LocaleSchema).optional(),
}).transform(({ enabled_locales }) => {
  return {
    enabledLocales: ensureEnabledLocales(enabled_locales ?? []),
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

  const parsed = UpdateLocalesSettingsSchema.safeParse({
    enabled_locales: rawLocales,
  })

  if (!parsed.success) {
    return { error: t('Invalid input.') }
  }

  const value = serializeEnabledLocales(parsed.data.enabledLocales)

  const { error } = await SettingsRepository.updateSettings([
    { group: 'i18n', key: 'enabled_locales', value },
  ])

  if (error) {
    return { error: DEFAULT_ERROR_MESSAGE }
  }

  revalidatePath('/admin/locales')

  return { error: null }
}
